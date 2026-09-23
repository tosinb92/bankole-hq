"use client";
import { useEffect, useMemo, useState } from "react";

type Asset = { id:string; title:string; brand:string; kind:"video"|"image"; url:string; caption:string; platforms:string[]; status:"Draft"|"Ready for review"|"Approved"; createdAt:string };
const BRANDS=["Bubble Leisure","FireComplianceUK","Brilliant AI Automation","Bankole & Associates","TradeCompare","Lucky Studios","SAYAH","Oddly","MiniMii"];
const PLATFORMS=["Instagram","Facebook","LinkedIn","TikTok"];
const KEY="bankole-hq:media-library:v1";
export default function ContentStudioPage(){
 const [assets,setAssets]=useState<Asset[]>([]);
 const [brand,setBrand]=useState("All brands");
 const [draft,setDraft]=useState({title:"",brand:"FireComplianceUK",kind:"video" as "video"|"image",url:"",caption:"",platforms:[] as string[]});
 const [notice,setNotice]=useState("");
 useEffect(()=>{try{const saved=JSON.parse(localStorage.getItem(KEY)||"[]");if(Array.isArray(saved))setAssets(saved)}catch{}},[]);
 const save=(next:Asset[])=>{setAssets(next);localStorage.setItem(KEY,JSON.stringify(next))};
 const filtered=useMemo(()=>assets.filter(a=>brand==="All brands"||a.brand===brand),[assets,brand]);
 const add=()=>{if(!draft.title.trim()||!draft.url.trim()){setNotice("Add a title and a media URL first.");return}try{const u=new URL(draft.url);if(!["https:","http:"].includes(u.protocol))throw Error();}catch{setNotice("Use a valid http(s) media URL.");return}
 save([{...draft,id:crypto.randomUUID(),title:draft.title.trim(),url:draft.url.trim(),caption:draft.caption.trim(),status:"Draft",createdAt:new Date().toISOString()},...assets]);setDraft({...draft,title:"",url:"",caption:"",platforms:[]});setNotice("Asset saved to this browser. No post has been published.")};
 const update=(id:string,patch:Partial<Asset>)=>save(assets.map(a=>a.id===id?{...a,...patch}:a));
 return <main style={{maxWidth:1300,margin:"auto",padding:32,color:"#e7f4f0",background:"#101c1c",minHeight:"100vh",fontFamily:"Arial,sans-serif"}}>
 <a href="/" style={{color:"#b4ead4"}}>← Bankole HQ</a><h1>Content Studio · Media Library</h1><p>Preview assets, assign each to a brand, prepare captions and choose platforms. This is a local review workspace, not a connected scheduler.</p>
 <section style={{background:"#1d3030",padding:22,borderRadius:16,marginBottom:24}}><h2>Add media</h2><p>Paste a direct, accessible media URL. Private Higgsfield files must first be uploaded to storage that provides a playable URL.</p>
 <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:12}}>
 <label>Title<input aria-label="Title" value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/></label>
 <label>Brand<select value={draft.brand} onChange={e=>setDraft({...draft,brand:e.target.value})}>{BRANDS.map(b=><option key={b}>{b}</option>)}</select></label>
 <label>Media type<select value={draft.kind} onChange={e=>setDraft({...draft,kind:e.target.value as "video"|"image"})}><option value="video">Video</option><option value="image">Image</option></select></label>
 <label>Media URL<input aria-label="Media URL" value={draft.url} onChange={e=>setDraft({...draft,url:e.target.value})} placeholder="https://...mp4"/></label></div>
 <label style={{display:"block",marginTop:12}}>Caption<textarea aria-label="Caption" style={{display:"block",width:"100%",minHeight:90}} value={draft.caption} onChange={e=>setDraft({...draft,caption:e.target.value})}/></label>
 <p>Target platforms</p><div style={{display:"flex",gap:15,flexWrap:"wrap"}}>{PLATFORMS.map(p=><label key={p}><input type="checkbox" checked={draft.platforms.includes(p)} onChange={e=>setDraft({...draft,platforms:e.target.checked?[...draft.platforms,p]:draft.platforms.filter(x=>x!==p)})}/>{p}</label>)}</div>
 <button onClick={add} style={{marginTop:18,padding:12,cursor:"pointer"}}>Save draft</button> {notice&&<span role="status">{notice}</span>}</section>
 <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}><h2>Review queue ({filtered.length})</h2><select aria-label="Filter brand" value={brand} onChange={e=>setBrand(e.target.value)}><option>All brands</option>{BRANDS.map(b=><option key={b}>{b}</option>)}</select></div>
 <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:20}}>{filtered.map(a=><article key={a.id} style={{background:"#1d3030",padding:16,borderRadius:14,minWidth:0}}>
 {a.kind==="video"?<video src={a.url} controls preload="metadata" style={{width:"100%",aspectRatio:"16/9",background:"#000"}}/>:<img src={a.url} alt={a.title} style={{width:"100%",aspectRatio:"16/9",objectFit:"contain"}}/>}
 <h3>{a.title}</h3><p>{a.brand}</p><label>Caption<textarea aria-label={a.title+" caption"} style={{display:"block",width:"100%",minHeight:110}} value={a.caption} onChange={e=>update(a.id,{caption:e.target.value})}/></label>
 <p>{PLATFORMS.map(p=><label key={p} style={{marginRight:10,display:"inline-block"}}><input type="checkbox" checked={a.platforms.includes(p)} onChange={e=>update(a.id,{platforms:e.target.checked?[...a.platforms,p]:a.platforms.filter(x=>x!==p)})}/>{p}</label>)}</p>
 <label>Status <select value={a.status} onChange={e=>update(a.id,{status:e.target.value as Asset["status"]})}><option>Draft</option><option>Ready for review</option><option>Approved</option></select></label>
 <p><a href={a.url} target="_blank" rel="noopener noreferrer" style={{color:"#b4ead4"}}>Open original</a></p><button onClick={()=>{if(confirm("Remove this asset from the local library?"))save(assets.filter(x=>x.id!==a.id))}}>Remove</button></article>)}</div>
 {!filtered.length&&<p>No assets saved for this brand yet.</p>}
 <p style={{marginTop:30,opacity:.8}}>Stored only in this browser. Social accounts are not connected; approving an asset does not schedule or publish it.</p>
 <style jsx>{`input:not([type="checkbox"]),select,textarea{background:#f6fbf9;color:#10201e;border:1px solid #a9c8be;border-radius:6px;padding:9px;max-width:100%;box-sizing:border-box}label{font-size:14px}button{cursor:pointer}`}</style>
 </main>
}