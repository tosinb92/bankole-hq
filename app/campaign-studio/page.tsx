"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import launch from "../../content/campaign-studio/launch-wave-1.json";
const founder="https://d2ol7oe51mr4n9.cloudfront.net/user_3IabZNH0RerpywVzXhojSNw3wCG/3c653dbd-c347-4b31-942d-e6be63a03787.png";
const tones:Record<string,string>={"BAA":"#85bbff","Bubble Leisure":"#b8ef64","FireComplianceUK":"#e4a09d","Bankole & Associates":"#dfbd7d"};
export default function CampaignStudio(){
 const [avatars,setAvatars]=useState<Record<string,string>>({});
 const [brand,setBrand]=useState("All");
 const [error,setError]=useState("");
 const [loading,setLoading]=useState(true);\n const [copied,setCopied]=useState("");
 useEffect(()=>{fetch("/api/campaign-studio/assets?avatars=1",{cache:"no-store"}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||"Could not load saved avatars");const next:Record<string,string>={};for(const a of d.avatars||[])next[a.brand]=a.imageUrl;setAvatars(next)}).catch(e=>setError(e instanceof Error?e.message:"Avatar loading failed")).finally(()=>setLoading(false))},[]);
 const posts=launch.posts.filter(p=>brand==="All"||p.brand===brand);
 return <main style={{minHeight:"100vh",background:"#0a111c",color:"#f4f6f9",padding:"28px clamp(18px,4vw,64px)",fontFamily:"Inter,Arial,sans-serif"}}>
 <Link href="/" style={{color:"#a9c7e8"}}>← HQ home</Link>
 <header style={{padding:"34px 0 24px",borderBottom:"1px solid #344053"}}>
 <p style={{color:"#b7c5d8",letterSpacing:3,fontSize:12}}>BANKOLE HQ / CUSTOMER ACQUISITION</p>
 <h1 style={{fontSize:"clamp(32px,5vw,56px)",margin:"8px 0"}}>Campaign Studio</h1>
 <p style={{color:"#c0cede",maxWidth:760,lineHeight:1.6}}>Rebranded launch campaigns. Only current approved brand imagery and campaign copy are shown. The previous illustrated concepts and outdated posts have been removed from this page.</p>
 <div style={{display:"flex",gap:12,flexWrap:"wrap",marginTop:22}}><span style={{padding:"12px 16px",background:"#1a2a3a",borderRadius:10}}>4 brands</span><span style={{padding:"12px 16px",background:"#1a2a3a",borderRadius:10}}>10 qualified leads per brand</span><span style={{padding:"12px 16px",background:"#1a2a3a",borderRadius:10}}>40-lead target</span></div>
 </header>
 <section style={{padding:"25px 0"}}><h2 style={{fontSize:24}}>Approved brand identities</h2>{error&&<p role="alert" style={{color:"#ffaaa7"}}>{error}</p>}
 <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))",gap:18}}>
 {["BAA","Bubble Leisure","FireComplianceUK","Bankole & Associates"].map(name=><article key={name} style={{background:"#172332",border:"1px solid #344253",borderTop:"4px solid "+tones[name],borderRadius:16,overflow:"hidden"}}>
 {(avatars[name]||(name==="Bankole & Associates"?founder:null))?<img src={avatars[name]||founder} alt={name+" approved brand presenter"} style={{width:"100%",height:260,objectFit:"cover",objectPosition:"center 28%"}}/>:<div style={{height:260,display:"grid",placeItems:"center",background:"#202e40",padding:16,textAlign:"center"}}>{loading?"Loading approved image…":"Avatar not found in HQ storage — check saved brand assignment"}</div>}
 <div style={{padding:17}}><h3 style={{margin:"0 0 8px"}}>{name}</h3><p style={{fontSize:13,color:"#b8c6d8"}}>{name==="BAA"?"Female AI automation presenter":name==="Bubble Leisure"?"Child activity presenter":name==="FireComplianceUK"?"High-vis brand presenter (not represented as a certified inspector)":"Existing founder photograph retained"}</p></div></article>)}
 </div></section>
 <section style={{padding:"15px 0 50px"}}><h2 style={{fontSize:24}}>Current launch posts</h2><p style={{color:"#b8c6d8"}}>New copy for the rebranded campaigns. These are drafts until approved and published to connected accounts.</p>
 <nav style={{display:"flex",gap:10,flexWrap:"wrap",margin:"22px 0"}}>{["All","BAA","Bubble Leisure","FireComplianceUK","Bankole & Associates"].map(n=><button key={n} onClick={()=>setBrand(n)} style={{background:brand===n?"#b6e6d4":"#1b2b3d",color:brand===n?"#10241f":"white",border:0,borderRadius:24,padding:"11px 17px",cursor:"pointer"}}>{n}</button>)}</nav>
 <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:20}}>{posts.map(p=><article key={p.brand} style={{background:"#172332",border:"1px solid #354459",borderRadius:17,overflow:"hidden"}}>
 {(avatars[p.brand]||(p.brand==="Bankole & Associates"?founder:null))&&<img src={avatars[p.brand]||founder} alt={p.brand+" campaign imagery"} style={{width:"100%",height:320,objectFit:"cover",objectPosition:"center 27%"}}/>}
 <div style={{padding:22}}><p style={{color:tones[p.brand],fontSize:12,letterSpacing:1.4}}>{p.brand.toUpperCase()} · {p.channel}</p><h3 style={{fontSize:24,lineHeight:1.25}}>{p.hook}</h3><p style={{whiteSpace:"pre-wrap",lineHeight:1.6,color:"#d0dae6"}}>{p.caption}</p><p style={{fontWeight:700,color:tones[p.brand]}}>CTA: {p.cta}</p><div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:16}}><button type="button" onClick={async()=>{try{await navigator.clipboard.writeText(p.caption);setCopied(p.brand)}catch{setCopied("Copy unavailable — select caption text")}}} style={{background:"#b6e6d4",color:"#10241f",border:0,borderRadius:9,padding:"12px 16px",fontWeight:700,cursor:"pointer"}}>{copied===p.brand?"Caption copied ✓":"Copy full caption"}</button><a href={avatars[p.brand]||(p.brand==="Bankole & Associates"?founder:"#")} target="_blank" rel="noreferrer" style={{display:"inline-block",border:"1px solid #a6bacd",color:"white",borderRadius:9,padding:"11px 15px",textDecoration:"none"}}>Open approved image</a></div><p style={{fontSize:13,color:"#f2d8a2"}}>Draft · Not yet published</p></div></article>)}</div></section>
 </main>
}