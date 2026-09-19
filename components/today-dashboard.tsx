"use client";
import { useEffect,useState } from "react";
type Props={openBusiness:(name:string)=>void;openCreate:(brand?:string,objective?:string)=>void;openIntelligence:()=>void};
type Item={id:string;business:string;type:string;title:string;detail:string;action:string};
type Today={generatedAt:string;metrics:{ventures:number;openTasks:number;activeLeads:number;activeDeals:number;opportunities:number;approvals:number};queue:Item[]};
export default function TodayDashboard({openBusiness,openCreate,openIntelligence}:Props){
 const [data,setData]=useState<Today|null>(null);const [error,setError]=useState("");
 useEffect(()=>{fetch("/api/today",{cache:"no-store"}).then(async r=>{const x=await r.json();if(!r.ok)throw new Error(x.error||"Could not load HQ data.");setData(x)}).catch(e=>setError(e.message))},[]);
 const act=(x:Item)=>x.action==="intelligence"?openIntelligence():x.business!=="HQ"?openBusiness(x.business):undefined;
 return <><section className="exec-hero"><div><p className="eyebrow">TODAY · LIVE HQ</p><h2>What actually needs your attention?</h2><p>This queue is read from HQ records. If HQ has no evidence for something, it should not invent a priority.</p></div><button className="primary" onClick={()=>openCreate()}>Create something →</button></section>
 {error&&<section className="creative-error"><b>Today cannot read HQ records.</b><br/>{error}</section>}
 {data&&<><section className="metric-grid"><Metric label="Open tasks" value={data.metrics.openTasks}/><Metric label="Active leads" value={data.metrics.activeLeads}/><Metric label="Active deals" value={data.metrics.activeDeals}/><Metric label="Opportunities" value={data.metrics.opportunities}/><Metric label="Awaiting approval" value={data.metrics.approvals}/></section>
 <section className="panel wide"><div className="panel-title"><h2>Your real priority queue</h2><span>From database records · refreshed on load</span></div>
 {data.queue.length?<div style={{display:"grid",gap:12}}>{data.queue.map(x=><article key={x.id} style={{border:"1px solid rgba(255,255,255,.12)",borderRadius:14,padding:16,display:"grid",gridTemplateColumns:"minmax(160px,.7fr) minmax(260px,2fr) auto",gap:16,alignItems:"center"}}><div><span className="mono">{x.business}</span><small style={{display:"block"}}>{x.type}</small></div><div><b>{x.title}</b><p style={{marginBottom:0}}>{x.detail}</p></div>{x.action==="intelligence"?<button onClick={openIntelligence}>Review →</button>:x.business!=="HQ"?<button onClick={()=>act(x)}>Open →</button>:<span className="note">Needs venture assignment</span>}</article>)}</div>:<div className="create-empty">No actionable records are currently stored in HQ. This is intentionally empty rather than filled with demo priorities.</div>}</section></>}
 {!data&&!error&&<section className="panel wide"><p>Reading HQ records…</p></section>}</>;
}
function Metric({label,value}:{label:string;value:number}){return <div className="metric"><span>{label}</span><strong>{value}</strong><small>Live HQ record count</small></div>}