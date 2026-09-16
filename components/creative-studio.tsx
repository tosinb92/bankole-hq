"use client";

import { useEffect, useMemo, useState } from "react";

type Asset = { id: string; imageUrl: string; prompt: string; revisedPrompt: string; version: number; aspectRatio: string; approvalStatus: string; createdAt: string; action: string; persisted: boolean };
type VideoJob = { id: string; provider: string; model: string; status: "QUEUED" | "GENERATING" | "PROCESSING" | "COMPLETED" | "FAILED"; providerStatus: string; error?: string };
type VideoBatch = { provider: string; requestedSeconds: number; jobs: VideoJob[] };
type IntelligenceHandoff = { venture: string; project: string; skill: string; output: string; sourceEvidence: string };

const venturePresets: Record<string, string[]> = {
  "Bubble Leisure": ["Facebook / Instagram ad image", "15s paid-social video", "30s event promo", "Kids-party creative", "Adult-event creative"],
  TripleMMM: ["Cinematic interview teaser", "Founder-story promo", "Guest announcement", "Interview social cutdown", "YouTube thumbnail / visual"],
  Oddly: ["Surreal / trippy image", "Cinematic visual experiment", "Branded AI short", "Storyboard sequence"],
  "Lucky Studios": ["Cover artwork", "Release visual", "Song teaser", "Music visual", "Release trailer", "Social clip"],
  SAYAH: ["Cover artwork", "Release visual", "Song teaser", "Music visual", "Release trailer", "Social clip"],
};

const videoPresets: Record<string, string[]> = {
  "Bubble Leisure": ["15s Paid-Social Video", "30s Event Promo", "Kids Party Video", "Adult Event Video", "Animate Existing Image", "Custom Video"],
  Oddly: ["Cinematic Visual", "Trippy Short", "Animate Image", "Storyboard Sequence", "Custom Video"],
  SAYAH: ["Music Teaser", "Release Trailer", "Animate Visual", "Social Clip", "Custom Video"],
  "Lucky Studios": ["Release Visual", "Music Visual", "Campaign Teaser", "Custom Video"],
  TripleMMM: ["Cinematic Interview Teaser", "Founder-Story Promo", "Interview Social Cutdown", "Custom Video"],
};
const creationTypes = ["Ad", "Social Post", "Image", "Video", "Long-form Content", "Script", "Carousel", "Presentation", "Cover Art"];

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
  const [creationType, setCreationType] = useState("Ad");
  const [project, setProject] = useState("September paid-social test");
  const [brief, setBrief] = useState("Active children’s parties that remove the pressure from parents and keep every child involved.");
  const [type, setType] = useState("Facebook / Instagram ad image");
  const [ratio, setRatio] = useState<"square" | "portrait" | "landscape">("portrait");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [plan, setPlan] = useState("");
  const [video, setVideo] = useState<VideoBatch | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [intelligenceHandoff, setIntelligenceHandoff] = useState<IntelligenceHandoff | null>(null);
  const visualPrompt = useMemo(() => promptFor(venture, brief, type), [venture, brief, type]);

  useEffect(() => {
    const raw = window.sessionStorage.getItem("bankole-hq:create-handoff");
    if (!raw) return;
    try {
      const handoff = JSON.parse(raw) as IntelligenceHandoff;
      if (handoff.venture && venturePresets[handoff.venture]) setVenture(handoff.venture);
      setProject(handoff.project || "Intelligence opportunity");
      setBrief(`${handoff.output}\n\nSOURCE EVIDENCE\n${handoff.sourceEvidence}`);
      setIntelligenceHandoff(handoff);
      window.sessionStorage.removeItem("bankole-hq:create-handoff");
    } catch { window.sessionStorage.removeItem("bankole-hq:create-handoff"); }
  }, []);

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
      let referenceImage = assets[0]?.imageUrl;
      // Runway Gen-4.5 is image-to-video. If no Studio asset is selected yet, create
      // a real reference frame server-side first instead of pretending text-only video works.
      if (!referenceImage) {
        const imageResponse = await fetch("/api/creative/generate-image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ venture, project, source: brief, prompt: visualPrompt, aspectRatio: ratio, action: "Generate Storyboard Frame for Video" }) });
        const imageData = await imageResponse.json() as { asset?: Asset; error?: string };
        if (!imageResponse.ok || !imageData.asset) throw new Error(imageData.error ?? "A Runway reference image could not be created.");
        referenceImage = imageData.asset.imageUrl;
        setAssets(current => [{ ...imageData.asset!, version: current.length + 1 }, ...current]);
      }
      const response = await fetch("/api/creative/video", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider: "runway", prompt: `${visualPrompt} Motion direction: gentle cinematic push-in, authentic subject action, controlled pacing, no text or logos.`, aspectRatio: ratio === "landscape" ? "landscape" : "portrait", durationSeconds: type.includes("15s") ? 15 : 5, ...(referenceImage ? { referenceImage } : {}) }) });
      const data = await response.json() as VideoBatch & { error?: string };
      if (!response.ok || !data.jobs?.length) throw new Error(data.error ?? "Runway video generation failed to start.");
      setVideo(data);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Video generation failed to start."); }
    finally { setBusy(null); }
  };

  useEffect(() => {
    if (!video || !video.jobs.some(job => ["QUEUED", "GENERATING", "PROCESSING"].includes(job.status))) return;
    const timer = window.setInterval(async () => {
      const updated = await Promise.all(video.jobs.map(async job => {
        if (["COMPLETED", "FAILED"].includes(job.status)) return job;
        const response = await fetch(`/api/creative/video/${job.id}`, { cache: "no-store" });
        return response.ok ? await response.json() as VideoJob : job;
      }));
      setVideo(current => current ? { ...current, jobs: updated } : current);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [video]);

  const download = (value: string, name: string, mime: string) => { const a = document.createElement("a"); a.href = value; a.download = name; if (value.startsWith("data:")) a.click(); else a.href = value; a.click(); };
  const presets = creationType === "Video" ? videoPresets[venture] ?? ["Custom Video"] : venturePresets[venture] ?? [];
  const isVideo = creationType === "Video";
  return <>
    <section className="create-hero"><div><p className="eyebrow">CREATIVE STUDIO · SERVER-SIDE GENERATION</p><h2>One brief, from copy through production assets.</h2><p>Idea → copy or script → visual concept → images → storyboard → video or CapCut-ready plan.</p></div><span className="badge needs-approval">Approval required</span></section>
    <section className="create-steps"><span>Idea</span><i/><span>Copy / script</span><i/><span>Visual concept</span><i/><span>Images</span><i/><span>Storyboard</span><i/><span>Video / assets</span></section>
    <section className="creative-workspace"><div className="panel create-form">{intelligenceHandoff && <div className="intelligence-handoff"><b>Intelligence hand-off · {intelligenceHandoff.skill}</b><small>Evidence and approved-skill output were carried into this brief.</small><button onClick={() => setIntelligenceHandoff(null)}>Clear hand-off</button></div>}<label>Venture<select value={venture} onChange={e=>{const next=e.target.value;setVenture(next);setAssets([]);setVideo(null);if(creationType==="Video")setType((videoPresets[next]??["Custom Video"])[0])}}>{Object.keys(venturePresets).map(x=><option key={x}>{x}</option>)}</select></label><label>What do you want to make?<select value={creationType} onChange={e=>{const next=e.target.value;setCreationType(next);setVideo(null);setType(next==="Video"?(videoPresets[venture]??["Custom Video"])[0]:(venturePresets[venture]??[next])[0])}}>{creationTypes.map(x=><option key={x}>{x}</option>)}</select></label><label>Project / campaign<input value={project} onChange={e=>setProject(e.target.value)}/></label><p className="creation-flow">Venture → {creationType} → {isVideo ? "Video type" : "Creative type"} → Brief / source → {isVideo ? "Concept / storyboard (optional) → Generate Video" : "Generate"}</p><div className="preset-list">{presets.map(p=><button key={p} className={type===p?"selected-preset":""} onClick={()=>{setType(p);if(isVideo)setPlan(planFor(venture,brief))}}>{p}<b>→</b></button>)}</div><label>{isVideo ? "Video type" : "Creative output"}<input value={type} onChange={e=>setType(e.target.value)}/></label><label>Brief / source idea / copy / script<textarea value={brief} onChange={e=>setBrief(e.target.value)} rows={7}/></label><label>Aspect ratio<select value={ratio} onChange={e=>setRatio(e.target.value as typeof ratio)}><option value="portrait">9:16 portrait</option><option value="square">1:1 square</option><option value="landscape">16:9 landscape</option></select></label>{isVideo&&<p className="note">{type.includes("Animate") ? "Animate the latest generated Studio image. Generate an image first if this project has none yet." : "Text-to-video uses the brief; a latest generated Studio image is automatically used as a reference when available."}</p>}<div className="creative-actions"><button className="primary" onClick={()=>makeImage("Generate Image")} disabled={!!busy}>{busy === "Generate Image" ? "Generating…" : "Generate Image"}</button><button onClick={()=>makeImage("Generate Ad Creative")} disabled={!!busy}>Generate Ad Creative</button><button onClick={()=>makeImage("Generate Social Visual")} disabled={!!busy}>Generate Social Visual</button><button onClick={()=>makeImage("Generate Cover Art")} disabled={!!busy}>Generate Cover Art</button><button onClick={()=>makeImage("Generate Storyboard Frame")} disabled={!!busy}>Generate Storyboard Frame</button><button onClick={()=>makeImage("Generate Image Variation", true)} disabled={!!busy}>Generate Image Variation</button></div><button className="link-action" onClick={()=>navigator.clipboard?.writeText(visualPrompt)}>Generate Midjourney Prompt / Copy Prompt</button></div>
      <div className="creative-results"><section className="panel"><Panel title={isVideo?"Video workflow · Runway":"Visual treatment"} action={isVideo?"Generate concept":"Create Visual Treatment"} onClick={()=>setPlan(`VISUAL TREATMENT · ${venture}\n\n${visualPrompt}\n\nArt direction: a single clear emotional beat, tactile cinematic light, deliberate negative space for final platform text. Create a consistent close, medium and establishing-frame set before edit.`)}/><textarea value={plan} onChange={e=>setPlan(e.target.value)} placeholder="Create a visual treatment, storyboard or video plan from the current brief." rows={8}/><div className="output-actions"><button onClick={()=>setPlan(planFor(venture, brief))}>Generate Storyboard</button><button onClick={()=>setPlan(planFor(venture, brief))}>Generate Scene List</button><button onClick={()=>setPlan(`${planFor(venture, brief)}\n\nVOICEOVER\n${brief}`)}>Generate Voiceover Script</button><button onClick={()=>setPlan(`${planFor(venture, brief)}\n\nVIDEO PROMPT\n${visualPrompt} Motion: controlled push-in, authentic movement, no text or logos.`)}>Generate Video Prompt</button><button onClick={()=>setPlan(planFor(venture, brief))}>Create CapCut Brief</button><button className="primary" onClick={startVideo} disabled={!!busy}>{busy === "Generate video" ? "Starting Runway…" : isVideo ? `Generate ${type} with Runway` : "Generate Short Video"}</button></div>{video&&<div className="video-job"><b>AI Job · Runway Gen-4.5 · {video.requestedSeconds}s requested</b><span>{video.jobs.some(job=>job.status==="PROCESSING") ? "Processing" : video.jobs.some(job=>job.status==="GENERATING") ? "Generating" : video.jobs.some(job=>job.status==="QUEUED") ? "Queued" : video.jobs.every(job=>job.status==="COMPLETED") ? "Completed" : "Failed"}</span><small>{video.requestedSeconds === 15 ? "15-second paid-social sequence: three real 5-second Runway segments, ready to assemble in the linked CapCut brief." : "Runway rendering is asynchronous. The provider’s temporary output URL remains server-side."}</small><div className="video-grid">{video.jobs.map((job,index)=><article className="video-segment" key={job.id}><b>Segment {index + 1} · {job.status}</b>{job.status === "COMPLETED" ? <video controls src={`/api/creative/video/${job.id}/content`}/> : <small>{job.error ?? `Runway: ${job.providerStatus}`}</small>}</article>)}</div></div>}</section>
        <section className="panel asset-panel"><Panel title={`Generated assets · ${assets.length}`} action="Current browser session"/><div className="asset-grid">{assets.map(asset=><article className="asset-card" key={asset.id}><img src={asset.imageUrl} alt={asset.prompt}/><div><b>v{asset.version} · {asset.aspectRatio}</b><span className="badge needs-approval">{asset.approvalStatus}</span><small>{new Date(asset.createdAt).toLocaleString()}</small><div className="output-actions"><button onClick={()=>navigator.clipboard?.writeText(asset.revisedPrompt)}>Copy prompt</button><button onClick={()=>download(asset.imageUrl, `${venture.toLowerCase().replaceAll(" ", "-")}-asset.png`, "image/png")}>Download</button><button onClick={()=>setAssets(current=>current.map(x=>x.id===asset.id?{...x,approvalStatus:"Approved"}:x))}>Approve</button></div></div></article>)}</div>{assets.length===0&&<div className="create-empty">Generate an actual image from the current brief. Generated images render here with prompt, version, aspect ratio, date and approval status.</div>}<p className="note">Generated images are returned securely to this browser session. Durable saving against ventures/projects is ready in the data model but requires the existing PostgreSQL connection and private object storage to be configured; images are never written into source control.</p></section></div>
    </section>{error&&<p className="creative-error">{error}</p>}
  </>;
}

function Panel({title, action, onClick}:{title:string;action:string;onClick?:()=>void}) { return <div className="panel-title"><h2>{title}</h2><button onClick={onClick}>{action} →</button></div>; }
