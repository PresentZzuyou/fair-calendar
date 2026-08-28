import {readFile,writeFile} from "node:fs/promises";
const dataFile=new URL("../app/fairs.generated.json",import.meta.url);
const reportFile=new URL("../app/crawl-report.generated.json",import.meta.url);
const fairs=JSON.parse(await readFile(dataFile,"utf8"));
const checkedAt=new Date().toISOString(),pageCache=new Map();
const strip=html=>html.replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/&nbsp;/g," ").replace(/&#?[a-z0-9]+;/gi," ").replace(/\s+/g," ");
const datePatterns=(date,end)=>{if(!date)return[];const[y,m,d]=date.split("-").map(Number),endDay=end?Number(end.split("-")[2]):d,months=["January","February","March","April","May","June","July","August","September","October","November","December"],month=months[m-1],short=month.slice(0,3);return[date,`${y}.${String(m).padStart(2,"0")}.${String(d).padStart(2,"0")}`,`${y}. ${m}. ${d}.`,`${m}/${d}`,`${m}월 ${d}일`,`${y}年${m}月${d}日`,`${d} ${month} ${y}`,`${d} ${short} ${y}`,`${month} ${d}, ${y}`,`${short} ${d}, ${y}`,`${d}-${endDay} ${month} ${y}`,`${d}-${endDay} ${month}, ${y}`,`${d}-${endDay} ${short} ${y}`,`${d}-${endDay} ${short}, ${y}`,`${month} ${d}-${endDay}, ${y}`,`${month} ${d}-${endDay}`,`${d} to ${endDay} ${month}`]};
const normalize=value=>value.toLowerCase().replace(/\s+/g,"").replace(/[·._-]/g,"");
const fetchText=async url=>{if(pageCache.has(url))return pageCache.get(url);const task=fetch(encodeURI(url),{headers:{"user-agent":"ContentFairCalendar/1.1 (+official-event-verification; one request per source)"}}).then(r=>{if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.text()}).then(strip);pageCache.set(url,task);return task};
const duplicateKeys=new Map();
for(const fair of fairs){const key=`${normalize(fair.title)}|${fair.start}`;duplicateKeys.set(key,(duplicateKeys.get(key)||0)+1)}
const results=[];
for(const fair of fairs){
 const key=`${normalize(fair.title)}|${fair.start}`;
 if(duplicateKeys.get(key)>1){results.push({title:fair.title,status:"duplicate",source:fair.source});continue}
 try{
  const text=await fetchText(fair.source),titleTokens=(fair.crawlKeywords||[fair.short]).flatMap(value=>value.split(/\s+/)).filter(w=>w.length>1);
  const titleFound=titleTokens.some(word=>normalize(text).includes(normalize(word)));
  const dateFound=!fair.start||datePatterns(fair.start,fair.end).some(pattern=>text.includes(pattern));
  const status=titleFound&&dateFound?"verified":titleFound?"date-review":"needs-review";
  if(status==="verified")fair.verifiedAt=checkedAt.slice(0,10);
  results.push({title:fair.title,status,source:fair.source});
 }catch(error){results.push({title:fair.title,status:"unreachable",source:fair.source,error:String(error.message||error)})}
}
fairs.sort((a,b)=>(a.start||"9999").localeCompare(b.start||"9999")||a.title.localeCompare(b.title,"ko"));
fairs.forEach((fair,index)=>fair.id=index+1);
const summary=results.reduce((all,item)=>({...all,[item.status]:(all[item.status]||0)+1}),{});
await writeFile(dataFile,JSON.stringify(fairs,null,2)+"\n");
await writeFile(reportFile,JSON.stringify({checkedAt,summary,results},null,2)+"\n");
console.table(results);console.log("Summary",summary);
if(results.every(item=>item.status==="unreachable"))process.exitCode=1;
