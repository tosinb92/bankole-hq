"use client";
import {useEffect,useState} from "react";
type Props={openBusiness:(name:string)=>void;openCreate:(brand?:string,objective?:string)=>void;openIntelligence:()=>void};
type Item={id:string;business:string;type:string;title:string;detail:string;action:string;source?:string};
type Today={generatedAt:string;dataPolicy?:string;metrics:{ventures:number;openTasks:number;activeLeads:number;activeDeals:number;opportunities:number;approvals:number;pipelineValue:number;leadValue:number;recordedRevenue:number};queue:Item[];integrations?:Record<string,string>};
const gbp=(n:number)=>new Intl.NumberFormat("en-GB",{style:"currency",currency:"GBP",maximumFractionDigits:0}).format(n);
export default function TodayDashboard({openBusiness,openCreate,openIntelligence}:Props){
 const [data,setData]=useState<Today|null>(null);const[error,setError]=useState("");
 const load=()=>fetch("/api/today",{cache:"no-store"}).then(async r=>{const x=await r.json();if(!r.ok)throw new Error(x.error||"Could not load HQ data.");setData(x)}).catch(e=>setError(e.message));
 useEffect(()=>{void load();const t=setInterval(()=>void load(),60000);return()=>clearInterval(t)},[]);
 const groups=data?.queue.reduce((a,x)=>{(a[x.business]??=[]).push(x);return a},{} as Record<string,Item[]>)??{};
 const priorities=data?.queue.slice(0,4)??[];
 const go=(x:Item)=>x.action==="intelligence"?openIntelligence():x.business!=="HQ"&&openBusiness(x.business);
 return <><section className="exec-hero command-hero"><div><p className="eyebrow">TODAY · REVENUE COMMAND CENTRE</p><h2>What moves money today?</h2><p>Top priorities across every venture. Live pipeline. Clear next moves.</p></div><button className="primary" onClick={()=>load()}>↻ Refresh</button></section>
 {error&&<section className="creative-error"><b>HQ data unavailable.</b><br/>{error}</section>}
 {data&&<><section className="today-priority-grid">{priorities.map(x=><button key={x.id} className={"today-priority-card "+x.type.toLowerCase()} onClick={()=>go(x)}><small>{x.business} · {x.type}</small><b>{x.title}</b><p>{x.detail}</p><strong>→</strong></button>)}</section>
 <section className="today-metrics"><Mini label="Recorded revenue" value={gbp(data.metrics.recordedRevenue)} hint="HQ entries"/><Mini label="Leads" value={String(data.metrics.activeLeads)} hint={gbp(data.metrics.leadValue)+" est."}/><Mini label="Deals" value={String(data.metrics.activeDeals)} hint={gbp(data.metrics.pipelineValue)+" value"}/><Mini label="Opportunities" value={String(data.metrics.opportunities)} hint="open"/><Mini label="Approvals" value={String(data.metrics.approvals)} hint="need you"/></section>
 <section className="panel wide"><div className="panel-title"><div><p className="eyebrow">BUSINESSES</p><h2>Current picture</h2></div><span className="live-pill">UPDATED {new Date(data.generatedAt).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</span></div><div className="today-business-list">{Object.entries(groups).map(([business,items])=><article className="today-business" key={business}><div className="today-business-head"><h3>{business}</h3><span>{items.length} ACTIVE</span></div>{items.slice(0,3).map(x=><button className="today-compact-row" key={x.id} onClick={()=>go(x)}><i className={"today-dot "+x.type.toLowerCase()}/><span><b>{x.title}</b><small>{x.detail}</small></span><em>{x.type}</em></button>)}</article>)}</div></section>
 <section className="panel wide"><div className="panel-title"><div><p className="eyebrow">CONNECTIONS</p><h2>Live data status</h2></div><span>Auto-refresh 60s</span></div><div className="today-connections">{Object.entries(data.integrations??{}).map(([name,status])=>{const live=status.startsWith("LIVE")||status.startsWith("CONNECTED FOR");return <span key={name} title={status} className={"today-connection "+(live?"live":"partial")}>{live?"●":"◐"} {name.replace(/([A-Z])/g," $1")}</span>})}</div></section></>}
 {!data&&!error&&<section className="panel wide"><p>Reading HQ records…</p></section>}</>
}
function Mini({label,value,hint}:{label:string;value:string;hint:string}){return <div className="today-metric"><p>{label}</p><strong>{value}</strong><small>{hint}</small></div>}
