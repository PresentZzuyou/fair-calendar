import {readFile,writeFile} from "node:fs/promises";
const dataFile=new URL("../app/fairs.generated.json",import.meta.url);
const reportFile=new URL("../app/crawl-report.generated.json",import.meta.url);
const fairs=JSON.parse(await readFile(dataFile,"utf8"));
const checkedAt=new Date().toISOString(),pageCache=new Map();
const strip=html=>html.replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/&nbsp;/g," ").replace(/&#?[a-z0-9]+;/gi," ").replace(/\s+/g," ");
const datePatterns=(date,end)=>{if(!date)return[];const[y,m,d]=date.split("-").map(Number),endDay=end?Number(end.split("-")[2]):d,monthNames=["January","February","March","April","May","June","July","August","September","October","November","December"],month=monthNames[m-1],short=month.slice(0,3);return[date,`${y}.${String(m).padStart(2,"0")}.${String(d).padStart(2,"0")}`,`${y}. ${m}. ${d}.`,`${m}/${d}`,`${m}월 ${d}일`,`${y}年${m}月${d}日`,`${d} ${month} ${y}`,`${d} ${short} ${y}`,`${month} ${d}, ${y}`,`${short} ${d}, ${y}`,`${d}-${endDay} ${month} ${y}`,`${d}-${endDay} ${month}, ${y}`,`${d}-${endDay} ${short} ${y}`,`${d}-${endDay} ${short}, ${y}`,`${month} ${d}-${endDay}, ${y}`,`${month} ${d}-${endDay}`,`${d} to ${endDay} ${month}`]};
const normalize=value=>value.toLowerCase().replace(/\s+/g,"").replace(/[·._-]/g,"");
const seriesOf=fair=>fair.seriesKey||(/코믹월드/i.test(fair.title)?"comic-world":/일러스타\s*페스/i.test(fair.title)?"illustar-fes":normalize(fair.title.replace(/20\d{2}/g,"").replace(/제\s*\d+\s*회/g,"").replace(/v\.?\s*\d+/gi,"").replace(/\b\d{2,3}\b/g,"")));
const editionOf=value=>Number(value.match(/제\s*(\d+)\s*회/)?.[1]||value.match(/v\.?\s*(\d+)/i)?.[1]||value.match(/(?:코믹월드|일러스타\s*페스)\s*(\d+)/i)?.[1]||0);
const editionStyle=value=>/제\s*\d+\s*회/.test(value)?"ordinal":/v\.?\s*\d+/i.test(value)?"version":/코믹월드\s*\d+/i.test(value)?"comic-world":/일러스타\s*페스\s*\d+/i.test(value)?"illustar-fes":null;
const editionsIn=(text,style)=>style==="ordinal"?[...text.matchAll(/제\s*(\d+)\s*회/gi)].map(match=>Number(match[1])):style==="version"?[...text.matchAll(/v\.?\s*(\d+)/gi)].map(match=>Number(match[1])):style==="comic-world"?[...text.matchAll(/코믹월드\s*(\d+)/gi)].map(match=>Number(match[1])):style==="illustar-fes"?[...text.matchAll(/일러스타\s*페스\s*(\d+)/gi)].map(match=>Number(match[1])):[];
const discoveryName=fair=>fair.discoveryQuery||(/코믹월드/i.test(fair.title)?"코믹월드":/일러스타\s*페스/i.test(fair.title)?"일러스타 페스":(fair.crawlKeywords?.[0]||fair.title||fair.short).replace(/20\d{2}/g,"").replace(/제\s*\d+\s*회/g,"").replace(/v\.?\s*\d+/gi,"").trim());
const discoveryPlan=fair=>{const seriesKey=seriesOf(fair),existing=fairs.filter(item=>seriesOf(item)===seriesKey),latestYear=Math.max(new Date().getUTCFullYear()-1,...existing.map(item=>Number(item.start?.slice(0,4)||item.title.match(/20\d{2}/)?.[0]||0))),latestEdition=Math.max(0,...existing.map(item=>editionOf(item.title))),style=existing.map(item=>editionStyle(item.title)).find(Boolean)||null,nextMarker=latestEdition?(/comic-world|illustar-fes/.test(style||"")?String(latestEdition+1):style==="version"?`V.${latestEdition+1}`:`제${latestEdition+1}회`):String(latestYear+1),query=`${discoveryName(fair)} ${nextMarker}`.trim();return{seriesKey,latestYear,latestEdition,style,query,url:`https://search.naver.com/search.naver?where=nexearch&query=${encodeURIComponent(query)}`}};
const titleForYear=(value,year)=>/20\d{2}/.test(value)?value.replace(/20\d{2}/,year):`${value} ${year}`;
const titleForEdition=(value,edition)=>/제\s*\d+\s*회/.test(value)?value.replace(/제\s*\d+\s*회/,`제${edition}회`):/v\.?\s*\d+/i.test(value)?value.replace(/v\.?\s*\d+/i,`V.${edition}`):/(코믹월드|일러스타\s*페스)\s*\d+/i.test(value)?value.replace(/((?:코믹월드|일러스타\s*페스)\s*)\d+/i,`$1${edition}`):value;
const keywordContexts=(text,keywords)=>{const lower=text.toLowerCase(),contexts=[];for(const keyword of keywords){let from=0,index;while((index=lower.indexOf(keyword.toLowerCase(),from))!==-1){contexts.push(text.slice(Math.max(0,index-1500),index+keyword.length+1500));from=index+keyword.length}}return contexts};
const iso=(y,m,d)=>`${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
const months={january:1,february:2,march:3,april:4,may:5,june:6,july:7,august:8,september:9,october:10,november:11,december:12,jan:1,feb:2,mar:3,apr:4,jun:6,jul:7,aug:8,sep:9,sept:9,oct:10,nov:11,dec:12};
const extractDateRanges=text=>{
 const found=[];
 const add=(y,m,d,ey,em,ed)=>{const start=iso(Number(y),Number(m),Number(d)),end=iso(Number(ey||y),Number(em||m),Number(ed||d));if(Number(y)>=2025&&Number(y)<=new Date().getUTCFullYear()+3&&start<=end)found.push({start,end})};
 for(const match of text.matchAll(/(20\d{2})\s*[.\/-]\s*(\d{1,2})\s*[.\/-]\s*(\d{1,2})\s*(?:[.\s]|[^\d]){0,12}[~～–—]\s*(?:(20\d{2})\s*[.\/-]\s*)?(?:(\d{1,2})\s*[.\/-]\s*)?(\d{1,2})/g))add(match[1],match[2],match[3],match[4],match[5],match[6]);
 for(const match of text.matchAll(/(20\d{2})年\s*(\d{1,2})月\s*(\d{1,2})日[^\d]{0,20}[~～–—-]\s*(?:(20\d{2})年)?\s*(?:(\d{1,2})月)?\s*(\d{1,2})日/g))add(match[1],match[2],match[3],match[4],match[5],match[6]);
 for(const match of text.matchAll(/(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+(\d{1,2})(?:st|nd|rd|th)?\s*[-–—]\s*(\d{1,2})(?:st|nd|rd|th)?[,]?\s*(20\d{2})/gi))add(match[4],months[match[1].toLowerCase()],match[2],null,null,match[3]);
 for(const match of text.matchAll(/(\d{1,2})\s*[-–—]\s*(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[,]?\s*(20\d{2})/gi))add(match[4],months[match[3].toLowerCase()],match[1],null,null,match[2]);
 return [...new Map(found.map(item=>[`${item.start}|${item.end}`,item])).values()];
};
const linksFrom=(html,base)=>[...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].flatMap(match=>{try{const url=new URL(match[1].replaceAll("&amp;","&"),base).href,label=strip(match[2]);return /^https?:/.test(url)&&label?[{url,label}]:[]}catch{return[]}});
const fetchPage=async(url,refresh=false)=>{if(refresh)pageCache.delete(url);if(pageCache.has(url))return pageCache.get(url);const task=fetch(encodeURI(url),{signal:AbortSignal.timeout(8000),headers:{"user-agent":"ContentFairCalendar/1.4 (+official-event-monitoring; automatic-discovery)",accept:"text/html,application/xhtml+xml","accept-language":"ko-KR,ko;q=0.9,en;q=0.7"}}).then(async r=>{if(!r.ok)throw new Error(`HTTP ${r.status}`);const html=await r.text();return{text:strip(html),links:linksFrom(html,url)}});pageCache.set(url,task);return task};
const fetchSources=async(fair,refresh=false)=>{const discovery=discoveryPlan(fair);return Promise.all([...new Set([fair.source,...(fair.crawlSources||[]),discovery.url])].map(async url=>{const kind=url===discovery.url?"discovery":"official";try{return{url,status:"ok",kind,...await fetchPage(url,refresh&&kind==="official")}}catch(error){return{url,status:"unreachable",kind,error:String(error.message||error)}}}))};
if(process.env.CRAWL_PLAN_ONLY==="1"){
 console.table(fairs.map(fair=>{const plan=discoveryPlan(fair);return{title:fair.title,series:plan.seriesKey,nextSearch:plan.query}}));
 process.exit(0);
}
await Promise.all([...new Set(fairs.map(fair=>discoveryPlan(fair).url))].map(url=>fetchPage(url).catch(()=>null)));
const duplicateKeys=new Map();
for(const fair of fairs){const key=`${normalize(fair.title)}|${fair.start}`;duplicateKeys.set(key,(duplicateKeys.get(key)||0)+1)}
const results=[],discovered=[];
for(const fair of [...fairs]){
 const key=`${normalize(fair.title)}|${fair.start}`;
 if(duplicateKeys.get(key)>1){results.push({title:fair.title,status:"duplicate",source:fair.source});continue}
 const plan=discoveryPlan(fair),titleKeywords=[...new Set([...(fair.crawlKeywords||[]),fair.short,discoveryName(fair)].filter(Boolean))];
 let checks=await fetchSources(fair),officialTexts=checks.filter(item=>item.status==="ok"&&item.kind==="official").map(item=>item.text),titleFound=officialTexts.some(text=>titleKeywords.some(keyword=>normalize(text).includes(normalize(keyword)))),dateFound=!fair.start||officialTexts.some(text=>datePatterns(fair.start,fair.end).some(pattern=>text.includes(pattern)));
 if(!titleFound||!dateFound){checks=await fetchSources(fair,true);officialTexts=checks.filter(item=>item.status==="ok"&&item.kind==="official").map(item=>item.text);titleFound=officialTexts.some(text=>titleKeywords.some(keyword=>normalize(text).includes(normalize(keyword))));dateFound=!fair.start||officialTexts.some(text=>datePatterns(fair.start,fair.end).some(pattern=>text.includes(pattern)))}
 const allTexts=checks.filter(item=>item.status==="ok").map(item=>item.text),contexts=allTexts.flatMap(text=>keywordContexts(text,titleKeywords)),officialContexts=officialTexts.flatMap(text=>keywordContexts(text,titleKeywords)),contextDates=[...new Map(contexts.flatMap(extractDateRanges).map(item=>[`${item.start}|${item.end}`,item])).values()],expectedYear=fair.start?.slice(0,4)||fair.title.match(/20\d{2}/)?.[0]||String(new Date().getUTCFullYear()),sameYearDates=[...new Map(officialContexts.flatMap(extractDateRanges).filter(item=>item.start.startsWith(expectedYear)).map(item=>[`${item.start}|${item.end}`,item])).values()];
 let autoUpdated=null;
 if(titleFound&&sameYearDates.length===1&&!fair.start){fair.start=sameYearDates[0].start;fair.end=sameYearDates[0].end;dateFound=true;autoUpdated={field:"date",start:fair.start,end:fair.end}}
 if(titleFound&&sameYearDates.length===1&&fair.start&&!dateFound&&fair.end>=checkedAt.slice(0,10)&&Math.abs(new Date(sameYearDates[0].start)-new Date(fair.start))<=45*86400000){fair.start=sameYearDates[0].start;fair.end=sameYearDates[0].end;dateFound=true;autoUpdated={field:"date",start:fair.start,end:fair.end}}
 const reason=!officialTexts.length?"source-unreachable":!titleFound?"title-not-found":!dateFound?"date-not-confirmed":null,status=reason?"auto-recheck":"verified";
 if(status==="verified")fair.verifiedAt=checkedAt.slice(0,10);
 results.push({title:fair.title,status,...(reason?{reason,nextCheck:"next scheduled run"}:{}),...(autoUpdated?{autoUpdated}:{}),source:fair.source,discovery:{query:plan.query,url:plan.url,status:checks.find(item=>item.kind==="discovery")?.status||"unreachable"},sourceChecks:checks.map(({url,status,kind,error})=>({url,status,kind,...(error?{error}: {})}))});
 if(titleFound){
  const seriesKey=plan.seriesKey,existing=fairs.filter(item=>seriesOf(item)===seriesKey),latestEnd=existing.map(item=>item.end||item.start||"").sort().at(-1)||"",contextEditions=contexts.flatMap(text=>editionsIn(text,plan.style)),nextEdition=contextEditions.filter(number=>number>plan.latestEdition).sort((a,b)=>a-b)[0],hasEditions=plan.latestEdition>0,candidates=contextDates.filter(item=>hasEditions?(Boolean(nextEdition)&&item.start>latestEnd):Number(item.start.slice(0,4))>plan.latestYear).sort((a,b)=>a.start.localeCompare(b.start));
  if(candidates[0]){const next=candidates[0],nextYear=next.start.slice(0,4),marker=nextEdition?String(nextEdition):nextYear,discoveredLink=checks.filter(item=>item.kind==="discovery"&&item.status==="ok").flatMap(item=>item.links||[]).find(link=>normalize(link.label).includes(normalize(discoveryName(fair)))&&normalize(link.label).includes(normalize(marker))&&!new URL(link.url).hostname.endsWith("search.naver.com")),clone={...fair,id:0,title:nextEdition?titleForEdition(fair.title,nextEdition):titleForYear(fair.title,nextYear),short:nextEdition?titleForEdition(fair.short,nextEdition):titleForYear(fair.short,nextYear),start:next.start,end:next.end,venue:fair.variableVenue||/코믹월드|일러스타\s*페스/i.test(fair.title)?"세부 행사장 공식 발표 확인":fair.venue,source:discoveredLink?.url||fair.source,crawlSources:[...new Set([...(fair.crawlSources||[]),fair.source,discoveredLink?.url].filter(Boolean))],annual:true,seriesKey,verifiedAt:checkedAt.slice(0,10)};fairs.push(clone);discovered.push({seriesKey,title:clone.title,start:clone.start,end:clone.end,source:clone.source,discoveryQuery:plan.query})}
 }
}
fairs.sort((a,b)=>(a.start||"9999").localeCompare(b.start||"9999")||a.title.localeCompare(b.title,"ko"));
fairs.forEach((fair,index)=>fair.id=index+1);
const summary=results.reduce((all,item)=>({...all,[item.status]:(all[item.status]||0)+1}),{});
if(process.env.CRAWL_DRY_RUN!=="1"){
 await writeFile(dataFile,JSON.stringify(fairs,null,2)+"\n");
 await writeFile(reportFile,JSON.stringify({checkedAt,summary,discovered,results},null,2)+"\n");
}
console.table(results.map(({title,status})=>({title,status})));console.log("Discovered",discovered);console.log("Summary",summary);
if(results.every(item=>item.status==="unreachable"))process.exitCode=1;
