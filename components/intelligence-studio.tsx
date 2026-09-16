"use client";

import { useMemo, useState } from "react";

type Evidence = { id: string; venture: string; competitor: string; platform: string; title: string; captured: string; provenance: string; content: string };
type SkillResult = { id: string; output: string; evidence: Array<{ id: string; title: string; sourceUrl?: string | null; provenance: string }> };

const importedSkills = ["Niche Hacking", "Instagram Research Capture", "Content Repurposing", "Hook-Proof-Value-CTA", "Kallaway Rewrite", "YappMaxxing Scriptwriter", "Carousel Creation", "YouTube Packaging"];
const demoEvidence: Evidence[] = [
  { id: "demo-bubble-reel", venture: "Bubble Leisure", competitor: "Example local events account", platform: "Instagram", title: "Party activity Reel", captured: "Seeded demonstration evidence", provenance: "Demo capture — no live platform connection", content: "A short activity-party Reel captured as a demonstration record. Connect a research source to preserve the real post, caption and metrics." },
  { id: "demo-oddly-post", venture: "Oddly", competitor: "Example creative studio", platform: "Instagram", title: "Surreal visual post", captured: "Seeded demonstration evidence", provenance: "Demo capture — no live platform connection", content: "A visual reference captured as a demonstration record. No performance metrics or claim of competitor results are included." },
  { id: "demo-sayah-short", venture: "SAYAH", competitor: "Example artist account", platform: "TikTok", title: "Release teaser short", captured: "Seeded demonstration evidence", provenance: "Demo capture — no live platform connection", content: "A release-teaser format captured as a demonstration record. It is source context, not proof of audience performance." },
];

export default function IntelligenceStudio({ setView }: { setView: (view: string) => void }) {
  const [venture, setVenture] = useState("Bubble Leisure");
  const [selected, setSelected] = useState<string[]>(["demo-bubble-reel"]);
  const [skill, setSkill] = useState("Niche Hacking");
  const [scope, setScope] = useState("selected competitor content");
  const [result, setResult] = useState<SkillResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const evidence = useMemo(() => demoEvidence.filter(item => item.venture === venture), [venture]);

  const toggle = (id: string) => setSelected(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  const runSkill = async () => {
    setBusy(true); setError(null); setResult(null);
    try {
      // The visible examples are explicitly demo-only. A live run requires persisted
      // venture/evidence records and then reads the approved instructions server-side.
      const response = await fetch("/api/intelligence/run-skill", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ventureId: venture, skillName: skill, evidenceIds: selected, scope: { mode: scope, source: "Intelligence Studio" } }) });
      const data = await response.json() as { run?: SkillResult; error?: string };
      if (!response.ok || !data.run) throw new Error(data.error ?? "Skill execution could not start.");
      setResult(data.run);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Skill execution could not start."); }
    finally { setBusy(false); }
  };
  const sendToCreate = () => {
    if (!result) return;
    const sources = result.evidence.map(item => `${item.title} (${item.provenance})`).join("; ");
    sessionStorage.setItem("bankole-hq:create-handoff", JSON.stringify({ venture, project: `${venture} intelligence opportunity`, skill, output: result.output, sourceEvidence: sources }));
    setView("Create");
  };
  const setVentureAndEvidence = (next: string) => { setVenture(next); const first = demoEvidence.find(item => item.venture === next); setSelected(first ? [first.id] : []); setResult(null); setError(null); };

  return <>
    <section className="exec-hero intelligence-hero"><div><p className="eyebrow">INTELLIGENCE → APPROVED SKILLS → CREATE</p><h2>Turn captured evidence into an attributable creative opportunity.</h2><p>Research sources provide evidence. Approved imported SKILL.md workflows do the analysis and transformation—nothing is replaced with a generic competitor framework.</p></div><span className="badge needs-approval">Evidence first</span></section>
    <section className="intelligence-loop"><span>Research / capture</span><i/> <span className="current">Run approved skill</span><i/> <span>Evidence-linked opportunity</span><i/> <span>Send to Create</span><i/> <span>Publish / test / learn</span></section>
    <section className="intelligence-workspace">
      <section className="panel intelligence-controls"><label>Venture<select value={venture} onChange={event => setVentureAndEvidence(event.target.value)}>{["Bubble Leisure", "Oddly", "SAYAH"].map(item => <option key={item}>{item}</option>)}</select></label><label>Analyse scope<select value={scope} onChange={event => setScope(event.target.value)}><option>selected competitor content</option><option>selected competitors</option><option>selected platform</option><option>selected campaign / date range</option></select></label><label>Approved imported skill<select value={skill} onChange={event => setSkill(event.target.value)}>{importedSkills.map(item => <option key={item}>{item}</option>)}</select></label><p className="note">The server will use the selected skill’s stored, approved SKILL.md instructions. It will not infer instructions from the name.</p><button className="primary" onClick={runSkill} disabled={busy || !selected.length}>{busy ? "Running approved skill…" : scope.startsWith("selected competitor") ? "Run Skill" : "Analyse Competitors with Skill"}</button></section>
      <section className="panel evidence-panel"><div className="panel-title"><h2>Captured competitor evidence</h2><span>Source data</span></div>{evidence.map(item => <article key={item.id} className="evidence-card"><label className="evidence-select"><input type="checkbox" checked={selected.includes(item.id)} onChange={() => toggle(item.id)}/><span><b>{item.title}</b><small>{item.competitor} · {item.platform}</small></span></label><p>{item.content}</p><footer><span className="badge">{item.captured}</span><small>{item.provenance}</small></footer></article>)}<p className="note">These are clearly labelled seeded records. Capture/import endpoints persist real URLs, content, provenance and timestamps once the database connection is live.</p></section>
    </section>
    {result && <section className="panel intelligence-result"><div className="panel-title"><h2>{skill} output</h2><span className="badge needs-approval">Evidence-linked</span></div><pre>{result.output}</pre><div className="evidence-links"><b>Source evidence</b>{result.evidence.map(item => <span key={item.id}>{item.title} · {item.provenance}</span>)}</div><div className="output-actions"><button onClick={() => navigator.clipboard?.writeText(result.output)}>Copy output</button><button className="primary" onClick={sendToCreate}>Send to Create →</button></div></section>}
    {error && <section className="creative-error"><b>No substitute output was generated.</b><br/>{error}</section>}
  </>;
}
