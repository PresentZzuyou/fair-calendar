import {appendFile,readFile,writeFile} from "node:fs/promises";
const dataFile=new URL("../app/fairs.generated.json",import.meta.url);
const reportFile=new URL("../app/crawl-report.generated.json",import.meta.url);
const annualAuditFile=new URL("../app/annual-audit.generated.json",import.meta.url);
const fairs=JSON.parse(await readFile(dataFile,"utf8"));
const checkedAt=new Date().toISOString(),fullAudit=["1","true"].includes(String(process.env.FULL_AUDIT).toLowerCase()),targetYear=new Date().getUTCFullYear()+1,pageCache=new Map();
const strip=html=>html.replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/&nbsp;/g," ").replace(/&#?[a-z0-9]+;/gi," ").replace(/\s+/g," ");
const normalize=value=>value.toLowerCase().replace(/\s+/g,"").replace(/[·._-]/g,"");
const seriesOf=fair=>fair.seriesKey||(/코믹월드/i.test(fair.title)?"comic-world":/일러스타\s*페스/i.test(fair.title)?"illustar-fes":normalize(fair.title.replace(/20\d{2}/g,"").replace(/제\s*\d+\s*회/g,"").replace(/v\.?\s*\d+/gi,"").replace(/\b\d{2,3}\b/g,"")));
const editionOf=value=>Number(value.match(/제\s*(\d+)\s*회/)?.[1]||value.match(/v\.?\s*(\d+)/i)?.[1]||value.match(/(?:코믹월드|일러스타\s*페스)\s*(\d+)/i)?.[1]||0);
const editionStyle=value=>/제\s*\d+\s*회/.test(value)?"ordinal":/v\.?\s*\d+/i.test(value)?"version":/코믹월드\s*\d+/i.test(value)?"comic-world":/일러스타\s*페스\s*\d+/i.test(value)?"illustar-fes":null;
const discoveryName=fair=>fair.discoveryQuery||(/코믹월드/i.test(fair.title)?"코믹월드":/일러스타\s*페스/i.test(fair.title)?"일러스타 페스":(fair.crawlKeywords?.[0]||fair.title||fair.short).replace(/20\d{2}/g,"").replace(/제\s*\d+\s*회/g,"").replace(/v\.?\s*\d+/gi,"").trim());
const discoveryPlan=fair=>{const seriesKey=seriesOf(fair),existing=fairs.filter(item=>seriesOf(item)===seriesKey),latestYear=Math.max(new Date().getUTCFullYear()-1,...existing.map(item=>Number(item.start?.slice(0,4)||item.title.match(/20\d{2}/)?.[0]||0))),latestEdition=Math.max(0,...existing.map(item=>editionOf(item.title))),style=existing.map(item=>editionStyle(item.title)).find(Boolean)||null,nextMarker=latestEdition?(/comic-world|illustar-fes/.test(style||"")?String(latestEdition+1):style==="version"?`V.${latestEdition+1}`:`제${latestEdition+1}회`):String(latestYear+1),query=`${discoveryName(fair)} ${nextMarker}`.trim();return{seriesKey,latestYear,latestEdition,style,nextMarker,query,url:`https://search.naver.com/search.naver?where=nexearch&query=${encodeURIComponent(query)}`}};
const titleForYear=(value,year)=>/20\d{2}/.test(value)?value.replace(/20\d{2}/,year):`${value} ${year}`;
const titleForEdition=(value,edition)=>/제\s*\d+\s*회/.test(value)?value.replace(/제\s*\d+\s*회/,`제${edition}회`):/v\.?\s*\d+/i.test(value)?value.replace(/v\.?\s*\d+/i,`V.${edition}`):/(코믹월드|일러스타\s*페스)\s*\d+/i.test(value)?value.replace(/((?:코믹월드|일러스타\s*페스)\s*)\d+/i,`$1${edition}`):value;
const iso=(y,m,d)=>`${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
const months={january:1,february:2,march:3,april:4,may:5,june:6,july:7,august:8,september:9,october:10,november:11,december:12,jan:1,feb:2,mar:3,apr:4,jun:6,jul:7,aug:8,sep:9,sept:9,oct:10,nov:11,dec:12};
const extractDateRanges=text=>{
 const found=[];
 const add=(y,m,d,ey,em,ed)=>{const start=iso(Number(y),Number(m),Number(d)),end=iso(Number(ey||y),Number(em||m),Number(ed||d));if(Number(y)>=2025&&Number(y)<=new Date().getUTCFullYear()+3&&start<=end)found.push({start,end})};
 for (const match of text.matchAll(/(20\d{2})\.(\d{1,2})\.(\d{1,2})\s*-\s*(20\d{2})\.(\d{1,2})\.(\d{1,2})/g)) {
  add(...match.slice(1));
 }
 for(const match of text.matchAll(/(20\d{2})\s*[.\/-]\s*(\d{1,2})\s*[.\/-]\s*(\d{1,2})\s*(?:[.\s]|[^\d]){0,12}[~～–—]\s*(?:(20\d{2})\s*[.\/-]\s*)?(?:(\d{1,2})\s*[.\/-]\s*)?(\d{1,2})/g))add(match[1],match[2],match[3],match[4],match[5],match[6]);
 for(const match of text.matchAll(/(20\d{2})年\s*(\d{1,2})月\s*(\d{1,2})日[^\d]{0,20}[~～–—-]\s*(?:(20\d{2})年)?\s*(?:(\d{1,2})月)?\s*(\d{1,2})日/g))add(match[1],match[2],match[3],match[4],match[5],match[6]);
 for(const match of text.matchAll(/(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+(\d{1,2})(?:st|nd|rd|th)?\s*[-–—]\s*(\d{1,2})(?:st|nd|rd|th)?[,]?\s*(20\d{2})/gi))add(match[4],months[match[1].toLowerCase()],match[2],null,null,match[3]);
 for(const match of text.matchAll(/(\d{1,2})\s*[-–—]\s*(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[,]?\s*(20\d{2})/gi))add(match[4],months[match[3].toLowerCase()],match[1],null,null,match[2]);
 return [...new Map(found.map(item=>[`${item.start}|${item.end}`,item])).values()];
};
const linksFrom=(html,base)=>[...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].flatMap(match=>{try{const url=new URL(match[1].replaceAll("&amp;","&"),base).href,label=strip(match[2]);return /^https?:/.test(url)&&label?[{url,label}]:[]}catch{return[]}});
const fetchPage=async url=>{if(pageCache.has(url))return pageCache.get(url);const task=fetch(new URL(url),{signal:AbortSignal.timeout(8000),headers:{"user-agent":"ContentFairCalendar/1.4 (+official-event-monitoring; automatic-discovery)",accept:"text/html,application/xhtml+xml","accept-language":"ko-KR,ko;q=0.9,en;q=0.7"}}).then(async r=>{if(!r.ok)throw new Error(`HTTP ${r.status}`);const html=await r.text();return{text:strip(html),links:linksFrom(html,url)}});pageCache.set(url,task);return task};
const isSearchUrl=url=>{try{return /(^|\.)search\.naver\.com$|(^|\.)search\.daum\.net$|(^|\.)bing\.com$/.test(new URL(url).hostname)}catch{return false}};
const officialDiscoveryUrls=fair=>{const configured=[fair.source,...(fair.crawlSources||[]),...(fair.discoverySources||[])].filter(url=>url&&!isSearchUrl(url)),derived=configured.flatMap(url=>{try{const parsed=new URL(url),urls=[`${parsed.origin}/`];if(parsed.hostname==="www.coex.co.kr"&&parsed.pathname.includes("/exhibitions/"))urls.push(`${parsed.origin}/event/full-schedules/`);return urls}catch{return[]}});return[...new Set([...configured,...derived])]};
const knownDetailPage = plan => {
 if (plan.style === "comic-world") return `https://comicw.net/e/${plan.nextMarker}`;
 const slugs = {
  "서울일러스트레이션페어": `서울일러스트레이션페어${plan.nextMarker.toLowerCase().replace(".", "-")}`,
  "character-licensing-fair-korea": `캐릭터-라이선싱-페어-${plan.nextMarker}`,
 };
 const slug = slugs[plan.seriesKey];
 return slug ? new URL(`/exhibitions/${slug}/`, "https://www.coex.co.kr").href : null;
};
const inspectSource = async url => {
 const kind = isSearchUrl(url) ? "search" : "official";
 try {
  return {url, kind, status: "ok", ...await fetchPage(url)};
 } catch (error) {
  return {url, kind, status: "unreachable", error: error.message};
 }
};

const fetchSources = async (fair, plan) => {
 const officialUrls = officialDiscoveryUrls(fair);
 const fallbackSearch = `https://search.daum.net/search?q=${encodeURIComponent(plan.query)}`;
 const currentSearch = `https://search.naver.com/search.naver?where=nexearch&query=${encodeURIComponent(fair.title)}`;
 const urls = new Set([...officialUrls, knownDetailPage(plan), currentSearch, ...(fair.crawlSources || []).filter(isSearchUrl), plan.url, fallbackSearch]);
 urls.delete(null);
 const checks = await Promise.all([...urls].map(url => inspectSource(url)));
 const officialHosts = new Set(officialUrls.map(url => new URL(url).hostname.replace(/^www\./, "")));
 const relevantLinks = checks.filter(check => check.status === "ok").flatMap(check => check.links)
  .filter(link => officialHosts.has(new URL(link.url).hostname.replace(/^www\./, "")) &&
   [plan.query, fair.title].some(title => normalize(link.label).includes(normalize(title))));
 const detailUrls = [...new Set(relevantLinks.map(link => link.url))].filter(url => !urls.has(url));
 const details = await Promise.all(detailUrls.slice(0, 5).map(url => inspectSource(url)));
 return [...checks, ...details];
};
if(process.env.CRAWL_PLAN_ONLY==="1"){
 console.table(fairs.map(fair=>{const plan=discoveryPlan(fair);return{title:fair.title,series:plan.seriesKey,nextSearch:plan.query}}));
 process.exit(0);
}
const registered = fairs.map(fair => ({fair, plan: discoveryPlan(fair)}));
const duplicateKeys = new Map();
for (const {fair} of registered) {
 const key = `${normalize(fair.title)}|${fair.start}`;
 duplicateKeys.set(key, (duplicateKeys.get(key) || 0) + 1);
}

const results = [], discovered = [];
for (let offset = 0; offset < registered.length; offset += 6) {
 const batch = registered.slice(offset, offset + 6);
 const sourceChecks = await Promise.all(batch.map(({fair, plan}) => fetchSources(fair, plan)));
 for (const [index, {fair, plan}] of batch.entries()) {
  const key = `${normalize(fair.title)}|${fair.start}`;
  const checks = sourceChecks[index];
  const titleKeywords = [...new Set([fair.title, ...(fair.crawlKeywords || []), fair.short, discoveryName(fair)].filter(Boolean))];
  const officialTexts = checks.filter(check => check.status === "ok" && check.kind === "official").map(check => check.text);
  const titleFound = officialTexts.some(text => titleKeywords.some(keyword => normalize(text).includes(normalize(keyword))));
  const dateFound = Boolean(fair.start) && officialTexts.some(text =>
   normalize(text).includes(normalize(fair.title)) &&
   extractDateRanges(text).some(date => date.start === fair.start && date.end === fair.end));
  const reason = duplicateKeys.get(key) > 1 ? "duplicate" : !officialTexts.length ? "source-unreachable"
   : !titleFound ? "title-not-found" : !dateFound ? "date-not-confirmed" : null;
  const status = reason ? "auto-recheck" : "verified";
  if(status==="verified")fair.verifiedAt=checkedAt.slice(0,10);
  let discoveredEvent=null;
  const detailPages = checks.filter(check => check.status === "ok" && check.kind === "official" &&
   normalize(check.text).includes(normalize(plan.query)));
  const matchingDetails = detailPages.flatMap(page => {
   const dates = extractDateRanges(page.text);
   return dates.length === 1 ? [{page, date: dates[0]}] : [];
  });
  const dateRanges = new Set(matchingDetails.map(({date}) => `${date.start}|${date.end}`));
  const {page: detailPage, date: eventDate} = dateRanges.size === 1 ? matchingDetails[0] : {};
  if(eventDate){
   const {seriesKey, latestEdition, latestYear} = plan;
   const latestEnd = fairs.filter(item => seriesOf(item) === seriesKey)
    .map(item => item.end || item.start || "").sort().at(-1) || "";
   const nextEdition = latestEdition ? latestEdition + 1 : null;
   const nextYear = Number(eventDate.start.slice(0, 4));
   const followsKnownSchedule = nextEdition ? eventDate.start > latestEnd : nextYear > latestYear;
   if (followsKnownSchedule && !discovered.some(event => event.seriesKey === seriesKey)) {
    const latest = registered.filter(item => item.plan.seriesKey === seriesKey).map(item => item.fair)
     .sort((left, right) => (right.start || "").localeCompare(left.start || ""))[0];
    const title = nextEdition ? titleForEdition(latest.title, nextEdition) : titleForYear(latest.title, nextYear);
    const short = nextEdition ? titleForEdition(latest.short, nextEdition) : titleForYear(latest.short, nextYear);
    const clone = {
     ...latest, id: Math.max(...fairs.map(item => item.id)) + 1, title, short, ...eventDate,
     venue: "세부 행사장 공식 발표 확인", fee: "공식 안내 확인", source: detailPage.url,
     crawlSources: [...new Set([...(latest.crawlSources || []), latest.source])],
     annual: true, seriesKey, verifiedAt: checkedAt.slice(0, 10),
    };
    fairs.push(clone);
    discoveredEvent = {seriesKey, title, ...eventDate, source: clone.source, discoveryQuery: plan.query};
    discovered.push(discoveredEvent);
   }
  }
  const searchChecks=checks.filter(item=>item.kind==="search"),officialChecks=checks.filter(item=>item.kind==="official"),searchReachable=searchChecks.some(item=>item.status==="ok"),officialReachable=officialChecks.some(item=>item.status==="ok"),discoveryStatus=discoveredEvent?"found":"needs-review";
  results.push({id:fair.id,title:fair.title,seriesKey:plan.seriesKey,status,...(reason?{reason,nextCheck:"next scheduled run"}:{}),source:fair.source,verification:{status,...(reason?{reason}:{}),officialSourcesChecked:officialChecks.length,officialSourcesReachable:officialChecks.filter(item=>item.status==="ok").length},discovery:{query:plan.query,url:plan.url,status:discoveryStatus,searchStatus:searchReachable?"reachable":searchChecks.length?"blocked":"not-configured",officialFallbackStatus:officialReachable?"checked":"blocked",...(discoveredEvent?{event:discoveredEvent}:{})},sourceChecks:checks.map(({url,status,kind,error})=>({url,status,kind,...(error?{error}: {})}))});
 }
}
fairs.sort((a,b)=>(a.start||"9999").localeCompare(b.start||"9999")||a.title.localeCompare(b.title,"ko"));
const verificationSummary=results.reduce((all,item)=>({...all,[item.status]:(all[item.status]||0)+1}),{}),discoverySummary=results.reduce((all,item)=>({...all,[item.discovery?.status||"not-checked"]:(all[item.discovery?.status||"not-checked"]||0)+1}),{}),summary={verification:verificationSummary,discovery:discoverySummary};
const review = [...new Map(results.filter(result => result.discovery.status === "needs-review")
 .map(result => [result.seriesKey, result.discovery.query])).values()]
 .filter(query => !discovered.some(event => event.discoveryQuery === query));
const editionsBySeries = new Map();
for (const {fair, plan} of registered) {
 const edition = editionOf(fair.title);
 if (!edition) continue;
 const editions = editionsBySeries.get(plan.seriesKey) || new Set();
 editions.add(edition);
 editionsBySeries.set(plan.seriesKey, editions);
}
const editionGaps = [...editionsBySeries].flatMap(([seriesKey, editions]) => {
 const sorted = [...editions].sort((a, b) => a - b);
 return sorted.slice(1).flatMap((end, index) => {
  const start = sorted[index] + 1;
  return start < end ? [{seriesKey, start, end: end - 1}] : [];
 });
});
const coverage = {registered: registered.length, checked: results.length, review, editionGaps};
if (coverage.checked !== coverage.registered) throw new Error("Incomplete fair audit");
if (process.env.GITHUB_STEP_SUMMARY) {
 const lines = [
  "## 페어 일정 점검",
  `등록 행사 ${coverage.checked}/${coverage.registered}건 점검 · 신규 ${discovered.length}건`,
  "", "### 다음 회차 공식 일정 재확인", ...review.map(query => `- ${query}`),
  "", "### 회차 번호 공백", ...editionGaps.map(gap => `- ${gap.seriesKey} ${gap.start}~${gap.end}`),
  "", "### 등록 일정 재확인",
  ...results.filter(result => result.reason).map(result => `- ${result.title} (${result.reason})`),
 ];
 await appendFile(process.env.GITHUB_STEP_SUMMARY, lines.join("\n") + "\n");
}
if(process.env.CRAWL_DRY_RUN!=="1"){
 await writeFile(dataFile,JSON.stringify(fairs,null,2)+"\n");
 await writeFile(reportFile,JSON.stringify({checkedAt,runId:process.env.GITHUB_RUN_ID,runAttempt:process.env.GITHUB_RUN_ATTEMPT,summary,coverage,discovered,results},null,2)+"\n");
 if(fullAudit){const series=[...new Set(fairs.map(seriesOf))].map(seriesKey=>{const events=fairs.filter(item=>seriesOf(item)===seriesKey),checks=results.filter(item=>item.seriesKey===seriesKey),targetYearEvents=events.filter(item=>item.start?.startsWith(`${targetYear}-`)),needsManualReview=!checks.length||checks.every(item=>item.discovery?.status==="needs-review");return{seriesKey,title:events.at(-1)?.title||events[0]?.title,targetYearEvents:targetYearEvents.map(item=>({title:item.title,start:item.start,end:item.end,source:item.source})),status:targetYearEvents.length?"scheduled":needsManualReview?"needs-manual-review":"checked-awaiting-announcement",officialSourcesReachable:Math.max(0,...checks.map(item=>item.verification?.officialSourcesReachable||0))}}),auditSummary=series.reduce((all,item)=>({...all,[item.status]:(all[item.status]||0)+1}),{});await writeFile(annualAuditFile,JSON.stringify({checkedAt,mode:"annual-full-audit",targetYear,seriesTotal:series.length,summary:auditSummary,series},null,2)+"\n")}
}
console.table(results.map(({title,status})=>({title,status})));console.log("Discovered",discovered);console.log("Summary",summary);console.log("Coverage",coverage);if(fullAudit)console.log(`Annual full audit completed for ${targetYear}`);
if (results.length && results.every(result => result.sourceChecks.every(check => check.status === "unreachable"))) {
 console.error("No fair sources could be reached.");
 process.exitCode = 1;
}
