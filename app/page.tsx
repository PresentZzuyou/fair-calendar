"use client";
import {useMemo,useState} from "react";
import fairsData from "./fairs.generated.json";

type Category="일러스트"|"캐릭터"|"IP"|"웹툰";
type Fair={id:number;title:string;short:string;start:string;end:string;venue:string;area:string;category:Category;color:string;text:string;icon:string;fee:string;organizer:string;description:string;source:string;verifiedAt:string};
const fairs=fairsData as Fair[];
const labels=["일","월","화","수","목","금","토"];

export default function Home(){
 const [selected,setSelected]=useState<Fair|null>(null),[area,setArea]=useState("전체 지역"),[type,setType]=useState("모든 페어"),[month,setMonth]=useState(new Date(2026,7,1));
 const visible=useMemo(()=>fairs.filter(f=>(area==="전체 지역"||f.area===area)&&(type==="모든 페어"||f.category===type||(type==="콘텐츠·라이선스"&&(f.category==="캐릭터"||f.category==="IP")))),[area,type]);
 const year=month.getFullYear(),monthNo=month.getMonth(),first=new Date(year,monthNo,1).getDay(),last=new Date(year,monthNo+1,0).getDate(),prevLast=new Date(year,monthNo,0).getDate(),days=Array.from({length:42},(_,i)=>i-first+1);
 const events=(day:number)=>visible.filter(f=>{const d=new Date(year,monthNo,day),s=new Date(f.start+"T00:00:00"),e=new Date(f.end+"T00:00:00");return d>=s&&d<=e});
 const today=new Date(); today.setHours(0,0,0,0);
 const statusOf=(fair:Fair)=>{if(!fair.start)return "진행 예정";const start=new Date(fair.start+"T00:00:00"),end=new Date(fair.end+"T23:59:59");if(today<start)return "진행 예정";if(today>end)return "진행 종료";return "진행 중"};
 const statusGroups=["진행 중","진행 예정"].map(status=>({status,items:visible.filter(f=>statusOf(f)===status).sort((a,b)=>(a.start||"9999").localeCompare(b.start||"9999"))}));
 return <main>
  <header className="topbar"><a className="brand" href="#top"><span className="brand-mark">✦</span><span>콘텐츠 페어 캘린더</span></a><nav><a className="active" href="#calendar">캘린더</a><a href="#list">페어 리스트</a></nav><a className="submit-btn" href="https://www.instagram.com/ps_zzuyou/" target="_blank" rel="noreferrer" aria-label="인스타그램 @ps_zzuyou로 페어 제보하기">페어 제보하기 ↗</a></header>
  <section className="hero" id="top"><div><h1>좋아하는 세계를<br/><em>만나러 가는 날.</em></h1><p className="hero-copy">전국의 창작 콘텐츠 페어 일정을<br/>공식 출처에서 모아보세요.</p></div></section>
  <section className="calendar-section" id="calendar">
   <div className="section-head"><div><span className="mini-label">FAIR CALENDAR</span><div className="month-title"><button onClick={()=>setMonth(new Date(year,monthNo-1,1))}>←</button><h2>{year}년 {monthNo+1}월</h2><button onClick={()=>setMonth(new Date(year,monthNo+1,1))}>→</button></div></div><div className="filters"><select value={area} onChange={e=>setArea(e.target.value)}><option>전체 지역</option><option>서울</option><option>경기</option><option>부산</option><option>울산</option></select><select value={type} onChange={e=>setType(e.target.value)}><option>모든 페어</option><option>일러스트</option><option>캐릭터</option><option>콘텐츠·라이선스</option><option>IP</option><option>웹툰</option></select></div></div>
   <div className="calendar-wrap"><div className="weekdays">{labels.map((l,i)=><div className={i===0?"sun":""} key={l}>{l}</div>)}</div><div className="grid">{days.map((day,i)=>{const valid=day>0&&day<=last;return <div className={"cell "+(!valid?"muted":"")} key={i}><span className={i%7===0?"sun":""}>{valid?day:day<=0?prevLast+day:day-last}</span>{valid&&events(day).map(f=><button key={f.id} className="event" style={{background:f.color,color:f.text}} onClick={()=>setSelected(f)} title={f.title}>{f.short}</button>)}</div>})}</div></div>
   <div className="legend"><span><i className="dot orange"></i>일러스트</span><span><i className="dot yellow"></i>캐릭터</span><span><i className="dot pink"></i>IP</span><span><i className="dot blue"></i>웹툰</span></div>
  </section>
  <section className="list-section" id="list"><div className="section-head"><div><span className="mini-label">FAIR LIST</span><h2>페어 리스트</h2></div><p>진행 상태별로 페어를 확인하세요.</p></div><div className="fair-groups">{statusGroups.map(group=><section className="fair-group" key={group.status}><div className="group-title"><h3>{group.status}</h3><span>{group.items.length}</span></div>{group.items.length?<div className="fair-rows">{group.items.map(f=><button className="fair-row" key={f.id} onClick={()=>setSelected(f)}><i style={{background:f.color}}></i><span className="row-date">{f.start?f.start.slice(5).replace("-",".")+" — "+f.end.slice(5).replace("-","."):"일정 미정"}</span><span className="row-main"><b>{f.title}</b><small>{f.category} · {f.area}</small></span><span className="row-venue">{f.venue}</span><span className="row-arrow">→</span></button>)}</div>:<p className="empty">해당하는 페어가 없습니다.</p>}</section>)}</div></section>
  {selected&&<div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setSelected(null)}}><aside className="detail" role="dialog" aria-modal="true"><button className="close" onClick={()=>setSelected(null)} aria-label="상세 정보 닫기">×</button><div className="detail-poster" style={{background:selected.color,color:selected.text}}><span>{selected.category} FAIR</span><strong>{selected.icon}</strong><b>{selected.short}</b></div><div className="detail-body"><span className="pill">{selected.area} · {selected.category}</span><h2>{selected.title}</h2><p className="desc">{selected.description}</p><dl><div><dt>일정</dt><dd>{selected.start?selected.start+" — "+selected.end:"공식 발표 예정"}</dd></div><div><dt>장소</dt><dd>{selected.venue}</dd></div><div><dt>입장료</dt><dd>{selected.fee}</dd></div><div><dt>주최</dt><dd>{selected.organizer}</dd></div></dl><a className="source-link" href={selected.source} target="_blank" rel="noreferrer">공식 출처에서 확인 ↗</a><p className="notice">마지막 확인 {selected.verifiedAt} · 방문 전 일정 변동 여부를 확인하세요.</p></div></aside></div>}
 </main>
}
