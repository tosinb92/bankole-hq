"use client";

import { useEffect, useState } from "react";

type Skill = { id: string; name: string; description?: string | null; active: boolean; sourceFile?: string | null; sourceVersion?: string | null; source?: { zipFileName?: string; sourcePath?: string; sourceUrl?: string } | null; _count?: { executions: number; intelligenceRuns: number } };

export default function SkillsLibrary({ openCreate }: { openCreate: () => void }) {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const load = async () => {
    const response = await fetch("/api/skills", { cache: "no-store" });
    const data = await response.json() as { skills?: Skill[]; error?: string };
    if (!response.ok) throw new Error(data.error ?? "Skills could not load.");
    setSkills(data.skills ?? []);
  };
  useEffect(() => { void load().catch((cause) => setMessage(cause instanceof Error ? cause.message : "Skills could not load.")); }, []);
  const importSkills = async () => {
    setBusy("import"); setMessage(null);
    try {
      const response = await fetch("/api/skills", { method: "POST" });
      const data = await response.json() as { importedCount?: number; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Drive ZIP import failed.");
      await load();
      setMessage(`Imported ${data.importedCount ?? 0} SKILL.md source record(s). Review and activate only the workflows you approve.`);
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Drive ZIP import failed."); }
    finally { setBusy(null); }
  };
  const activate = async (skill: Skill) => {
    setBusy(skill.id); setMessage(null);
    try {
      const response = await fetch(`/api/skills/${skill.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !skill.active }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Skill approval could not be updated.");
      await load();
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Skill approval could not be updated."); }
    finally { setBusy(null); }
  };
  const activeCount = skills.filter((skill) => skill.active).length;
  return <>
    <section className="exec-hero"><div><p className="eyebrow">SKILLS LIBRARY · MANAGEMENT</p><h2>Install, approve and inspect Bankole HQ operating procedures.</h2><p>Normal work starts in Ask HQ. This page manages the original Drive source, version, approval state and usage history.</p></div><button className="primary" onClick={importSkills} disabled={!!busy}>{busy === "import" ? "Importing from Drive…" : "Import actual Drive skills"}</button></section>
    <section className="panel wide"><div className="panel-title"><h2>Workflow inventory</h2><span>{activeCount} active · {skills.length} imported</span></div><button className="primary" onClick={openCreate}>Open Create →</button></section>
    {skills.length === 0 ? <section className="panel empty">No Drive skills are in the database yet. Importing never executes or activates a skill automatically.</section> : <section className="cards skills">{skills.map((skill) => <article className="venture" key={skill.id}><span className="mono">{skill.source?.zipFileName ?? skill.sourceFile ?? "DRIVE SOURCE"}</span><h2>{skill.name}</h2><p>{skill.description ?? "Actual instructions imported from the approved source ZIP."}</p><small>{skill.source?.sourcePath ?? skill.sourceFile ?? "SKILL.md"}{skill.sourceVersion ? ` · v${skill.sourceVersion}` : ""} · {skill._count?.executions ?? 0} workflow run(s) · {skill._count?.intelligenceRuns ?? 0} intelligence run(s)</small><footer><span className={`badge ${skill.active ? "verified" : "needs-approval"}`}>{skill.active ? "Approved for execution" : "Needs owner approval"}</span><button onClick={() => activate(skill)} disabled={!!busy}>{busy === skill.id ? "Saving…" : skill.active ? "Deactivate" : "Approve skill"}</button></footer></article>)}</section>}
    {message && <section className="creative-error">{message}</section>}
  </>;
}
