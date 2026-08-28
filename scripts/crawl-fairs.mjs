import {readFile,writeFile} from "node:fs/promises";
const dataFile=new URL("../app/fairs.generated.json",import.meta.url);
const reportFile=new URL("../app/crawl-report.generated.json",import.meta.url);
const fairs=JSON.parse(await readFile(dataFile,"utf8"));
const checkedAt=new Date().toISOString(),pageCache=new Map();
const strip=html=>html.replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/&nbsp;/g," ").replace(/&#?[a-z0-9]+;/gi," ").replace(/\s+/g," ");
const datePatterns=(date,end)=>{if(!date)return[];const[y,m,d]=date.split("-").map(Number),endDay=end?Number(end.split("-")[2]):d,monthNames=["January","February","March","April","May","June","July","August","September","October","November","December"],month=monthNames[m-1],short=month.slice(0,3);return[date,`${y}.${String(m).padStart(2,"0")}.${String(d).padStart(2,"0")}`,`${y}. ${m}. ${d}.`,`${m}/${d}`,`${m}월 ${d}일`,`${y}年${m}月${d}日`,`${d} ${month} ${y}`,`${d} ${short} ${y}`,`${month} ${d}, ${y}`,`${short} ${d}, ${y}`,`${d}-${endDay} ${month} ${y}`,`${d}-${endDay} ${month}, ${y}`,`${d}-${endDay} ${short} ${y}`,`${d}-${endDay} ${short}, ${y}`,`${month} ${d}-${endDay}, ${y}`,`${month} ${d}-${endDay}`,`${d} to ${endDay} ${month}`]};
const normalize=value=>value.toLowerCase().replace(/\s+/g,"").replace(/[·._-]/g,"");
const seriesOf=fair=>fair.seriesKey||normalize(fair.title.replace(/20\d{2}/g,"").replace(/제\s*\d+\s*회/g,"").replace(/v\.?\s*\d+/gi,"").replace(/\b\d{2,3}\b/g,""));
const titleForYear=(value,year)=>/20\d{2}/.test(value)?value.replace(/20\d{2}/,year):`${value} ${year}`;
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
const fetchText=async url=>{if(pageCache.has(url))return pageCache.get(url);const task=fetch(encodeURI(url),{signal:AbortSignal.timeout(8000),headers:{"user-agent":"ContentFairCalendar/1.2 (+official-event-monitoring; one request per source)"}}).then(r=>{if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.text()}).then(strip);pageCache.set(url,task);return task};
const fetchSources=async fair=>Promise.all([...new Set([fair.source,...(fair.crawlSources||[])])].map(async url=>{try{return{url,status:"ok",text:await fetchText(url)}}catch(error){return{url,status:"unreachable",error:String(error.message||error)}}}));
const duplicateKeys=new Map();
for(const fair of fairs){const key=`${normalize(fair.title)}|${fair.start}`;duplicateKeys.set(key,(duplicateKeys.get(key)||0)+1)}
const results=[],discovered=[];
for(const fair of [...fairs]){
 const key=`${normalize(fair.title)}|${fair.start}`;
 if(duplicateKeys.get(key)>1){results.push({title:fair.title,status:"duplicate",source:fair.source});continue}
 const checks=await fetchSources(fair),texts=checks.filter(item=>item.status==="ok").map(item=>item.text),titleKeywords=fair.crawlKeywords||[fair.short];
 const titleFound=texts.some(text=>titleKeywords.some(keyword=>normalize(text).includes(normalize(keyword))));
 const dateFound=!fair.start||texts.some(text=>datePatterns(fair.start,fair.end).some(pattern=>text.includes(pattern)));
 const status=!texts.length?"unreachable":titleFound&&dateFound?"verified":titleFound?"date-review":"needs-review";
 if(status==="verified")fair.verifiedAt=checkedAt.slice(0,10);
 results.push({title:fair.title,status,source:fair.source,sourceChecks:checks.map(({url,status,error})=>({url,status,...(error?{error}: {})}))});
 if(titleFound){
  const seriesKey=seriesOf(fair),existing=fairs.filter(item=>seriesOf(item)===seriesKey),latestYear=Math.max(...existing.map(item=>Number(item.start?.slice(0,4)||item.title.match(/20\d{2}/)?.[0]||0))),contexts=texts.flatMap(text=>keywordContexts(text,titleKeywords)),candidates=contexts.flatMap(extractDateRanges).filter(item=>Number(item.start.slice(0,4))>latestYear).sort((a,b)=>a.start.localeCompare(b.start));
  if(candidates[0]){const next=candidates[0],nextYear=next.start.slice(0,4),clone={...fair,id:0,title:titleForYear(fair.title,nextYear),short:titleForYear(fair.short,nextYear),start:next.start,end:next.end,venue:fair.variableVenue?"세부 행사장 공식 발표 확인":fair.venue,annual:true,seriesKey,verifiedAt:checkedAt.slice(0,10)};fairs.push(clone);discovered.push({seriesKey,title:clone.title,start:clone.start,end:clone.end})}
 }
}
fairs.sort((a,b)=>(a.start||"9999").localeCompare(b.start||"9999")||a.title.localeCompare(b.title,"ko"));
fairs.forEach((fair,index)=>fair.id=index+1);
const summary=results.reduce((all,item)=>({...all,[item.status]:(all[item.status]||0)+1}),{});
await writeFile(dataFile,JSON.stringify(fairs,null,2)+"\n");
await writeFile(reportFile,JSON.stringify({checkedAt,summary,discovered,results},null,2)+"\n");
console.table(results.map(({title,status})=>({title,status})));console.log("Discovered",discovered);console.log("Summary",summary);
if(results.every(item=>item.status==="unreachable"))process.exitCode=1;
