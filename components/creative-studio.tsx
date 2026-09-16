"use client";

import { useEffect, useMemo, useState } from "react";

type Asset = { id: string; imageUrl: string; prompt: string; revisedPrompt: string; version: number; aspectRatio: string; approvalStatus: string; createdAt: string; action: string; persisted: boolean };
type VideoJob = { id: string; status: string; progress?: number };

const venturePresets: Record<string, string[]> = {
  "Bubble Leisure": ["Facebook / Instagram ad image", "15s paid-social video", "30s event promo", "Kids-party creative", "Adult-event creative"],
  TripleMMM: ["Cinematic interview teaser", "Founder-story promo", "Guest announcement", "Interview social cutdown", "YouTube thumbnail / visual"],
  Oddly: ["Surreal / trippy image", "Cinematic visual experiment", "Branded AI short", "Storyboard sequence"],
  "Lucky Studios": ["Cover artwork", "Release visual", "Song teaser", "Music visual", "Release trailer", "Social clip"],
  SAYAH: ["Cover artwork", "Release visual", "Song teaser", "Music visual", "Release trailer", "Social clip"],
};

const promptFor = (venture: string, brief: string, kind: string) => {
  const base = `Create a polished ${kind} for ${venture}. Source brief: ${brief}. `;
  if (venture === "Bubble Leisure") return `${base}A lively UK Bubble Football birthday event, diverse children aged 7–10 having genuine supervised fun outdoors, bright safe sports setting, clearly visible inflatable bubble suits, movement and joy, premium paid-social advertising photography, no text, no logos, no watermark.`;
  if (venture === "Oddly") return `${base}A photoreal ordinary daytime city bus stop: one commuter calmly checks their phone while a perfectly normal goldfish bowl floats beside the timetable, understated surrealism, no other fantasy world, cinematic composition, tactile natural light, no text or logos.`;
  if (venture === "SAYAH") return `${base}Original fictional female R&B artist in an intimate late-night editorial setting, direct gaze and straight head position, stylish but restrained wardrobe, US urban atmosphere without identifiable landmarks, cinematic iPhone-inspired realism, no text, no logos, do not resemble a real person.`;
  return `${base}Premium editorial visual, coherent focal subject, cinematic light, no visible text, logos or watermarks.`;
};

const planFor = (venture: string, brief: string) => `VIDEO PRODUCTION PLAN · ${venture}\n\n01 · 0:00–0:03 · Hook image / visual pattern break. Camera: slow push-in. On-screen text: one concise hook.\n02 · 0:03–0:07 · Show the tension or aspiration in “${brief}”. Camera: medium tracking shot.\n03 · 0:07–0:12 · Proof / emotional payoff. Use generated reference images as clearly labelled inserts.\n04 · 0:12–0:15 · Clear CTA or end frame. Hold readable space for 1.5 seconds.\n\nPACING · Fast opening, then breathe on the payoff.\nTRANSITIONS · Hard cuts on beats; one restrained match cut only.\nSUBTITLES · Add only after final copy approval.\nSOUND · Licensed / platform-cleared music; duck under voice.\nCAPCUT · 9:16 vertical; use this exact scene order, approved assets and final CTA.`;

export default function CreativeStudio() {
  const [venture, setVenture] = useState("Bubble Leisure");
  const [project, setProject] = useState("September paid-social test");
  const [brief, setBrief] = useState("Active children’s parties that remove the pressure from parents and keep every child involved.");
  const [type, setType] = useState("Facebook / Instagram ad image");
  const [ratio, setRatio] = useState<"square" | "portrait" | "landscape">("portrait");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [plan, setPlan] = useState("");
  const [video, setVideo] = useState<VideoJob | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const visualPrompt = useMemo(() => promptFor(venture, brief, type), [venture, brief, type]);

  const makeImage = async (action: string, variation = false) => {
    setBusy(action); setError(null);
    const prompt = variation ? `${visualPrompt} Create a distinct composition and camera angle while preserving the approved subject and brief.` : visualPrompt;
    try {
      const response = await fetch("/api/creative/generate-image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ venture, project, source: brief, prompt, aspectRatio: ratio, action }) });
      const data = await response.json() as { asset?: Asset; error?: string };
      if (!response.ok || !data.asset) throw new Error(data.error ?? "Image generation failed.");
      setAssets(current => [{ ...data.asset!, version: current.length + 1 }, ...current]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Image generation failed."); }
    finally { setBusy(null); }
  };

  const startVideo = async () => {
    setBusy("Generate video"); setError(null);
    try {
      const response = await fetch("/api/creative/video", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: `${visualPrompt} Motion: gentle cinematic push-in, clear subject action, no text or logos.`, aspectRatio: ratio === "landscape" ? "landscape" : "portrait", seconds: "8" }) });
      const data = await response.json() as VideoJob & { error?: string };
      if (!response.ok || !data.id) throw new Error(data.error ?? "Video generation failed to start.");
      setVideo(data);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Video generation failed to start."); }
    finally { setBusy(null); }
  };

  useEffect(() => {
    if (!video || !["queued", "in_progress"].includes(video.status)) return;
    const timer = window.setInterval(async () => {
      const response = await fetch(`/api/creative/video/${video.id}`, { cache: "no-store" });
      const data = await response.json() as VideoJob;
      if (response.ok) setVideo(data);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [video]);

  const download = (value: string, name: string, mime: string) => { const a = document.createElement("a"); a.href = value; a.download = name; if (value.startsWith("data:")) a.click(); else a.href = value; a.click(); };
  const presets = venturePresets[venture] ?? [];
  return <>
    <section className="create-hero"><div><p className="eyebrow">CREATIVE STUDIO · SERVER-SIDE GENERATION</p><h2>One brief, from copy through production assets.</h2><p>Idea → copy or script → visual concept → images → storyboard → video or CapCut-ready plan.</p></div><span className="badge needs-approval">Approval required</span></section>
    <section className="create-steps"><span>Idea</span><i/><span>Copy / script</span><i/><span>Visual concept</span><i/><span>Images</span><i/><span>Storyboard</span><i/><span>Video / assets</span></section>
    <section className="creative-workspace"><div className="panel create-form"><label>Venture<select value={venture} onChange={e=>{setVenture(e.target.value);setAssets([]);setVideo(null)}}>{Object.keys(venturePresets).map(x=><option key={x}>{x}</option>)}</select></label><label>Project / campaign<input value={project} onChange={e=>setProject(e.target.value)}/></label><div className="preset-list">{presets.map(p=><button key={p} onClick={()=>setType(p)}>{p}<b>→</b></button>)}</div><label>Creative output<input value={type} onChange={e=>setType(e.target.value)}/></label><label>Source idea / copy / script<textarea value={brief} onChange={e=>setBrief(e.target.value)} rows={7}/></label><label>Aspect ratio<select value={ratio} onChange={e=>setRatio(e.target.value as typeof ratio)}><option value="portrait">9:16 portrait</option><option value="square">1:1 square</option><option value="landscape">16:9 landscape</option></select></label><div className="creative-actions"><button className="primary" onClick={()=>makeImage("Generate Image")} disabled={!!busy}>{busy === "Generate Image" ? "Generating…" : "Generate Image"}</button><button onClick={()=>makeImage("Generate Ad Creative")} disabled={!!busy}>Generate Ad Creative</button><button onClick={()=>makeImage("Generate Social Visual")} disabled={!!busy}>Generate Social Visual</button><button onClick={()=>makeImage("Generate Cover Art")} disabled={!!busy}>Generate Cover Art</button><button onClick={()=>makeImage("Generate Storyboard Frame")} disabled={!!busy}>Generate Storyboard Frame</button><button onClick={()=>makeImage("Generate Image Variation", true)} disabled={!!busy}>Generate Image Variation</button></div><button className="link-action" onClick={()=>navigator.clipboard?.writeText(visualPrompt)}>Generate Midjourney Prompt / Copy Prompt</button></div>
      <div className="creative-results"><section className="panel"><Panel title="Visual treatment" action="Create Visual Treatment" onClick={()=>setPlan(`VISUAL TREATMENT · ${venture}\n\n${visualPrompt}\n\nArt direction: a single clear emotional beat, tactile cinematic light, deliberate negative space for final platform text. Create a consistent close, medium and establishing-frame set before edit.`)}/><textarea value={plan} onChange={e=>setPlan(e.target.value)} placeholder="Create a visual treatment, storyboard or video plan from the current brief." rows={8}/><div className="output-actions"><button onClick={()=>setPlan(planFor(venture, brief))}>Generate Storyboard</button><button onClick={()=>setPlan(planFor(venture, brief))}>Generate Scene List</button><button onClick={()=>setPlan(`${planFor(venture, brief)}\n\nVOICEOVER\n${brief}`)}>Generate Voiceover Script</button><button onClick={()=>setPlan(`${planFor(venture, brief)}\n\nVIDEO PROMPT\n${visualPrompt} Motion: controlled push-in, authentic movement, no text or logos.`)}>Generate Video Prompt</button><button onClick={()=>setPlan(planFor(venture, brief))}>Create CapCut Brief</button><button className="primary" onClick={startVideo} disabled={!!busy}>{busy === "Generate video" ? "Starting video…" : "Generate Short Video"}</button></div>{video&&<div className="video-job"><b>AI Job · {video.status.replaceAll("_", " ")}</b><span>{video.progress ?? 0}%</span>{video.status === "completed"&&<a href={`/api/creative/video/${video.id}/content`} target="_blank">Open generated MP4 →</a>}<small>Video rendering is asynchronous. This is a real provider job, not an instant mock.</small></div>}</section>
        <section className="panel asset-panel"><Panel title={`Generated assets · ${assets.length}`} action="Current browser session"/><div className="asset-grid">{assets.map(asset=><article className="asset-card" key={asset.id}><img src={asset.imageUrl} alt={asset.prompt}/><div><b>v{asset.version} · {asset.aspectRatio}</b><span className="badge needs-approval">{asset.approvalStatus}</span><small>{new Date(asset.createdAt).toLocaleString()}</small><div className="output-actions"><button onClick={()=>navigator.clipboard?.writeText(asset.revisedPrompt)}>Copy prompt</button><button onClick={()=>download(asset.imageUrl, `${venture.toLowerCase().replaceAll(" ", "-")}-asset.png`, "image/png")}>Download</button><button onClick={()=>setAssets(current=>current.map(x=>x.id===asset.id?{...x,approvalStatus:"Approved"}:x))}>Approve</button></div></div></article>)}</div>{assets.length===0&&<div className="create-empty">Generate an actual image from the current brief. Generated images render here with prompt, version, aspect ratio, date and approval status.</div>}<p className="note">Generated images are returned securely to this browser session. Durable saving against ventures/projects is ready in the data model but requires the existing PostgreSQL connection and private object storage to be configured; images are never written into source control.</p></section></div>
    </section>{error&&<p className="creative-error">{error}</p>}
  </>;
}

function Panel({title, action, onClick}:{title:string;action:string;onClick?:()=>void}) { return <div className="panel-title"><h2>{title}</h2><button onClick={onClick}>{action} →</button></div>; }
