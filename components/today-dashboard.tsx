"use client";

type Props={openBusiness:(name:string)=>void;openCreate:(brand?:string,objective?:string)=>void;openIntelligence:()=>void};

const priorities=[
 {business:"Bubble Leisure",goal:"Get bookings",signal:"Content + lead conversion",action:"Build this week's booking campaign",why:"Create the offer, posts and production plan around enquiries and bookings.",cta:"Create campaign",kind:"create"},
 {business:"SAYAH",goal:"Grow audience",signal:"Connected Instagram performance",action:"Turn audience signals into the next 10 concepts",why:"Use owned performance evidence, then combine it with competitor/inspiration intelligence as that source is connected.",cta:"Create next content",kind:"create"},
 {business:"Bankole & Associates",goal:"Move deals forward",signal:"Mandates + follow-ups",action:"Review deal actions and counterparties",why:"Keep diligence, commitments, outreach and economics tied to each live transaction.",cta:"Open business",kind:"business"},
 {business:"FireComplianceUK",goal:"Find revenue opportunities",signal:"Procurement + supplier matching",action:"Review opportunities and supplier fit",why:"Move from discovered opportunity to qualified supplier, outreach and bid preparation.",cta:"Open intelligence",kind:"intel"}
];

export default function TodayDashboard({openBusiness,openCreate,openIntelligence}:Props){
 const act=(p:(typeof priorities)[number])=>p.kind==="create"?openCreate(p.business,p.goal==="Get bookings"?"Create a conversion-focused weekly campaign designed to generate qualified enquiries and bookings.":"Create the next 10 audience-growth concepts using available performance evidence and clearly identify where competitor evidence is still missing."):p.kind==="intel"?openIntelligence():openBusiness(p.business);
 return <><section className="exec-hero"><div><p className="eyebrow">TODAY · OUTCOMES FIRST</p><h2>What should move forward today?</h2><p>HQ should turn your goals, business data, intelligence and Skills into the next useful action. The tools stay underneath; you work from outcomes.</p></div><button className="primary" onClick={()=>openCreate()}>Create something →</button></section>
 <section className="metric-grid"><Metric label="Businesses needing action" value="4" hint="Prioritised below"/><Metric label="Content engine" value="Live" hint="Outcome-led generation"/><Metric label="Intelligence loop" value="Building" hint="Owned + competitor evidence"/><Metric label="Execution rule" value="Approve" hint="You remain in control"/></section>
 <section className="panel wide"><div className="panel-title"><h2>Your priority queue</h2><span>Goal → evidence → recommendation → action → result</span></div>
 <div style={{display:"grid",gap:12}}>{priorities.map(p=><article key={p.business} style={{border:"1px solid rgba(255,255,255,.12)",borderRadius:14,padding:16,display:"grid",gridTemplateColumns:"minmax(180px,.8fr) minmax(260px,2fr) auto",gap:16,alignItems:"center"}}><div><span className="mono">{p.business}</span><h3 style={{margin:"6px 0"}}>{p.goal}</h3><small>{p.signal}</small></div><div><b>{p.action}</b><p style={{marginBottom:0}}>{p.why}</p></div><button className="primary" onClick={()=>act(p)}>{p.cta} →</button></article>)}</div></section>
 <section className="split"><div className="panel"><div className="panel-title"><h2>How HQ should work</h2></div><div className="workflow"><span>Your goal</span><i/><span>Business context</span><i/><span>Evidence</span><i/><span className="current">Best Skills</span><i/><span>Action</span></div><p className="note">You should not have to choose Skills, models or integrations for normal work.</p></div>
 <div className="panel"><div className="panel-title"><h2>Evidence status</h2><button onClick={openIntelligence}>Open Intelligence →</button></div><p><b>SAYAH · </b>Instagram account data is available through the connected analytics source; automatic ingestion into HQ is the next data-layer step.</p><p><b>Competitors · </b>Public competitor/inspiration capture still needs to be wired into the same evidence store.</p><p><b>Other ventures · </b>Each business needs its own operational source connections before HQ can claim live recommendations.</p></div></section></>;
}

function Metric({label,value,hint}:{label:string;value:string;hint:string}){return <div className="metric"><span>{label}</span><strong>{value}</strong><small>{hint}</small></div>}
