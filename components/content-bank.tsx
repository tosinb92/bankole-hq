"use client";
import { useMemo, useState } from "react";

type GeneratedPiece={title:string;format:string;hook:string;concept:string;caption:string;cta:string;productionBrief:string;purpose:string;skillsUsed:string[];evidenceUsed?:string[]};
type Generation={brand:string;objective:string;strategy:string;skillsUsed:string[];evidenceSummary:string;pieces:GeneratedPiece[]};

const brands=["Bubble Leisure","SAYAH","Lucky Studios","Brilliant AI Automation","FireComplianceUK","Bankole & Associates","TradeCompare","TripleMMM"];
const goals=[
 ["Get customers","Create conversion-focused social content that turns attention into enquiries, calls, bookings or qualified leads."],
 ["Grow audience","Create high-retention, shareable social content that attracts the right audience and gives them a reason to follow."],
 ["Build authority","Create useful proof-led content that demonstrates expertise, trust and a clear point of view without unsupported claims."],
 ["Launch / promote","Create a coordinated launch campaign with teasers, reveal content, proof, objection handling and direct response posts."],
 ["30-day content plan","Create a practical 30-day social content system balancing reach, trust, conversion and repeatable series."]
];

export default function ContentBank({initialBrand,initialObjective,onMake}:{initialBrand?:string;initialObjective?:string;onMake?:(brand:string,title:string,brief:string)=>void}){
 const [brand,setBrand]=useState(initialBrand||"Bubble Leisure");
 const [objective,setObjective]=useState(initialObjective||goals[0][1]);
 const [count,setCount]=useState(10);
 const [generation,setGeneration]=useState<Generation|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState<string|null>(null);
 const [status,setStatus]=useState<Record<number,string>>({});
 const pieces=useMemo(()=>generation?.pieces??[],[generation]);

 const generate=async()=>{
  setBusy(true);setError(null);setGeneration(null);setStatus({});
  try{
   const response=await fetch("/api/content-bank/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({brand,objective,count})});
   const data=await response.json() as {generation?:Generation;error?:string};
   if(!response.ok||!data.generation) throw new Error(data.error??"Content generation failed.");
   setGeneration(data.generation);
  }catch(cause){setError(cause instanceof Error?cause.message:"Content generation failed.");}
  finally{setBusy(false);}
 };
 const copy=(x:GeneratedPiece)=>navigator.clipboard?.writeText(`${x.hook}\n\n${x.caption}\n\nCTA: ${x.cta}\n\nPRODUCTION: ${x.productionBrief}`);

 return <><section className="exec-hero"><div><p className="eyebrow">CREATE · SOCIAL CONTENT ENGINE</p><h2>Tell HQ the result you want. Get content you can actually post.</h2><p>Choose a business and outcome. HQ uses that business's approved Skills to build the strategy, hooks, captions and production instructions. You should not need to understand or manage the Skills yourself.</p></div><strong>{pieces.length} ready ideas</strong></section>
 <section className="panel wide"><div className="panel-title"><h2>1. What are we trying to achieve?</h2><span>{brand}</span></div>
 <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:10,marginBottom:16}}>{goals.map(([label,value])=><button key={label} onClick={()=>setObjective(value)} className={objective===value?"primary":""} style={{textAlign:"left",padding:14}}><b>{label}</b></button>)}</div>
 <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:12}}>
 <label>Business<select value={brand} onChange={e=>setBrand(e.target.value)}>{brands.map(x=><option key={x}>{x}</option>)}</select></label>
 <label>How many ideas?<select value={count} onChange={e=>setCount(Number(e.target.value))}>{[5,10,20,50,100].map(x=><option key={x}>{x}</option>)}</select></label>
 </div>
 <label style={{display:"block",marginTop:14}}>Brief / outcome<textarea value={objective} onChange={e=>setObjective(e.target.value)} rows={3} style={{width:"100%"}}/></label>
 <div className="output-actions"><button className="primary" onClick={generate} disabled={busy||!objective.trim()}>{busy?"Building your campaign…":`Build ${count} posts for ${brand} →`}</button></div>
 <p className="note">HQ handles Skill selection in the background. Generated work will show the reasoning and provenance underneath, but you do not need to operate the Skills Library.</p></section>
 {error&&<section className="creative-error"><b>HQ cannot generate yet.</b><br/>{error}</section>}
 {generation&&<section className="panel wide"><div className="panel-title"><h2>2. Campaign direction</h2><span>{generation.skillsUsed.length} approved Skills applied</span></div><p>{generation.strategy}</p><details><summary>Show evidence and Skills used</summary><p>{generation.evidenceSummary}</p><p><b>Skills · </b>{generation.skillsUsed.join(" · ")}</p></details></section>}
 {pieces.length>0&&<section className="panel wide"><div className="panel-title"><h2>3. Your ready-to-produce content</h2><span>{pieces.length} ideas</span></div><div style={{display:"grid",gap:12}}>{pieces.map((x,i)=><article key={i} style={{border:"1px solid rgba(255,255,255,.12)",borderRadius:14,padding:16}}><div style={{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}><span className="mono">#{i+1} · {x.format} · {x.purpose}</span><span className="badge needs-approval">{status[i]||"READY TO REVIEW"}</span></div><h3 style={{margin:"10px 0 6px"}}>{x.title}</h3><p><b>Opening / hook · </b>{x.hook}</p><p><b>What happens · </b>{x.concept}</p><p><b>Caption · </b>{x.caption}</p><p><b>CTA · </b>{x.cta}</p><details><summary>How to make this</summary><p>{x.productionBrief}</p><p><b>Skills · </b>{x.skillsUsed?.join(" · ")||generation?.skillsUsed.join(" · ")}</p>{x.evidenceUsed?.length?<p><b>Evidence · </b>{x.evidenceUsed.join(" · ")}</p>:null}</details><div className="output-actions"><button onClick={()=>copy(x)}>Copy post</button><button onClick={()=>setStatus(s=>({...s,[i]:"SHORTLISTED"}))}>Save</button><button className="primary" onClick={()=>make(x)} disabled={!onMake}>Make this →</button><button onClick={()=>setStatus(s=>({...s,[i]:"POSTED"}))}>Posted</button></div></article>)}</div></section>}
 </>;
}