"use client";

import { useEffect, useState } from "react";\nimport {ventureSkillProfiles} from "@/lib/venture-skill-profiles";

type Skill = { id: string; name: string; description?: string | null; active: boolean; sourceFile?: string | null; sourceVersion?: string | null; source?: { zipFileName?: string; sourcePath?: string; sourceUrl?: string } | null; _count?: { executions: number; intelligenceRuns: number } };

const zipU16 = (bytes: Uint8Array, offset: number) => bytes[offset] | (bytes[offset + 1] << 8);
const zipU32 = (bytes: Uint8Array, offset: number) => (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;

async function inflateZipEntry(compression: number, compressed: Uint8Array, fileName: string) {
  if (compression === 0) return compressed;
  if (compression === 8) {
    const stream = new Blob([compressed as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  throw new Error(`${fileName} uses unsupported ZIP compression.`);
}

async function extractSkillSources(bytes: Uint8Array, archiveName: string, depth = 0): Promise<Array<{ path: string; instructions: string }>> {
  if (depth > 4) throw new Error(`${archiveName} contains too many nested ZIP levels.`);
  let end = -1;
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65_557); offset -= 1) {
    if (zipU32(bytes, offset) === 0x06054b50) { end = offset; break; }
  }
  if (end < 0) throw new Error(`${archiveName} is not a valid ZIP file.`);
  let cursor = zipU32(bytes, end + 16);
  const sources: Array<{ path: string; instructions: string }> = [];
  while (cursor + 46 <= bytes.length && zipU32(bytes, cursor) === 0x02014b50) {
    const compression = zipU16(bytes, cursor + 10);
    const compressedSize = zipU32(bytes, cursor + 20);
    const nameLength = zipU16(bytes, cursor + 28);
    const extraLength = zipU16(bytes, cursor + 30);
    const commentLength = zipU16(bytes, cursor + 32);
    const localOffset = zipU32(bytes, cursor + 42);
    const path = new TextDecoder().decode(bytes.slice(cursor + 46, cursor + 46 + nameLength));
    const isSkill = /(^|\/)SKILL\.md$/i.test(path);
    const isNestedZip = /\.zip$/i.test(path);
    if ((isSkill || isNestedZip) && zipU32(bytes, localOffset) === 0x04034b50) {
      const dataStart = localOffset + 30 + zipU16(bytes, localOffset + 26) + zipU16(bytes, localOffset + 28);
      const compressed = bytes.slice(dataStart, dataStart + compressedSize);
      const data = await inflateZipEntry(compression, compressed, archiveName);
      if (isSkill) sources.push({ path: `${archiveName}/${path}`, instructions: new TextDecoder().decode(data) });
      else sources.push(...await extractSkillSources(data, `${archiveName}/${path}`, depth + 1));
    }
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return sources;
}

async function extractSkillMarkdown(file: File) {
  const sources = await extractSkillSources(new Uint8Array(await file.arrayBuffer()), file.name);
  if (!sources.length) throw new Error(`${file.name} contains no SKILL.md files, including inside nested ZIPs.`);
  return { fileName: file.name, sources };
}

export default function SkillsLibrary({ openCreate, openIntelligence }: { openCreate: () => void; openIntelligence: () => void }) {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
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
  const uploadSkills = async () => {
    if (!uploadFiles.length) { setMessage("Choose one or more skill ZIP files first."); return; }
    setBusy("upload"); setMessage(null);
    try {
      const packages = await Promise.all(uploadFiles.map(extractSkillMarkdown));
      const response = await fetch("/api/skills", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ packages }) });
      const responseText = await response.text();
      let data: { importedCount?: number; imported?: string[]; error?: string };
      try { data = JSON.parse(responseText) as typeof data; }
      catch { throw new Error(response.ok ? "Bankole HQ returned an unreadable response." : responseText.slice(0, 240) || `Upload failed (${response.status}).`); }
      if (!response.ok) throw new Error(data.error ?? "Skill ZIP upload failed.");
      await load();
      setUploadFiles([]);
      setMessage(`Imported ${data.importedCount ?? 0} real SKILL.md file(s): ${(data.imported ?? []).join(", ") || "no named skills found"}. Review and approve the workflows you want HQ to execute.`);
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Skill ZIP upload failed."); }
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
    <section className="exec-hero"><div><p className="eyebrow">HQ CAPABILITIES · OPERATIONAL</p><h2>Tell HQ the outcome. Astra chooses the approved skills.</h2><p>You should not have to understand SKILL.md files to use them. Skills are reusable operating methods available to Ask HQ, Intelligence and Create.</p></div><button onClick={importSkills} disabled={!!busy}>{busy === "import" ? "Importing from Drive…" : "Import from connected Drive"}</button></section>
    <section className="panel wide"><div className="panel-title"><h2>Use your capabilities</h2><span>{activeCount} ready</span></div><div className="output-actions"><button className="primary" onClick={openIntelligence}>Analyse competitors with my skills →</button><button onClick={openCreate}>Create using my methods →</button></div><p className="note">For normal work, start with the outcome. HQ resolves the venture context, evidence and approved methodology. The technical library below is for management only.</p></section><details className="panel wide"><summary><b>Manage imported skill sources</b> · upload, inspect and approve</summary><div className="panel-title"><h2>Upload actual Skill ZIPs</h2><span>No Google Cloud setup required</span></div><label>Select ZIP files<input type="file" accept=".zip,application/zip" multiple onChange={(event) => setUploadFiles(Array.from(event.target.files ?? []))}/></label><p className="note">{uploadFiles.length ? `${uploadFiles.length} ZIP file(s) selected` : "Download the skill ZIPs from your Google Drive folder, then choose them here."}</p><div className="output-actions"><button className="primary" onClick={uploadSkills} disabled={!!busy || !uploadFiles.length}>{busy === "upload" ? "Uploading and reading SKILL.md…" : "Upload Skill ZIPs"}</button><button onClick={openCreate}>Open Create →</button><button onClick={openIntelligence}>Use skills on competitor evidence →</button></div><div className="panel-title"><h2>Workflow inventory</h2><span>{activeCount} active · {skills.length} imported</span></div></section>
    {skills.length === 0 ? <section className="panel empty">No skills are in the database yet. Uploading imports the original SKILL.md instructions but never executes or activates a skill automatically.</section> : <section className="cards skills">{skills.map((skill) => <article className="venture" key={skill.id}><span className="mono">{skill.source?.zipFileName ?? skill.sourceFile ?? "DRIVE SOURCE"}</span><h2>{skill.name}</h2><p>{skill.description ?? "Actual instructions imported from the approved source ZIP."}</p><small>{skill.source?.sourcePath ?? skill.sourceFile ?? "SKILL.md"}{skill.sourceVersion ? ` · v${skill.sourceVersion}` : ""} · {skill._count?.executions ?? 0} workflow run(s) · {skill._count?.intelligenceRuns ?? 0} intelligence run(s)</small><footer><span className={`badge ${skill.active ? "verified" : "needs-approval"}`}>{skill.active ? "Approved for execution" : "Needs owner approval"}</span><button onClick={() => activate(skill)} disabled={!!busy}>{busy === skill.id ? "Saving…" : skill.active ? "Deactivate" : "Approve skill"}</button></footer></article>)}</section>}
    <section className="panel wide"><div className="panel-title"><h2>Bankole venture adaptations</h2><span>Source skill + venture intelligence</span></div><p className="note">HQ keeps the original imported methodology but replaces creator-specific assumptions with the selected venture’s objectives, audience, voice, proof rules and commercial purpose.</p><div className="cards skills">{ventureSkillProfiles.map(v=><article className="venture" key={v.venture}><span className="mono">VENTURE SKILL PROFILE</span><h2>{v.venture}</h2><p>{v.objectives.join(" · ")}</p><small>{v.voice}</small><footer><span className="badge verified">{v.preferredSkills.length} preferred skill routes</span></footer></article>)}</div></section>{message && <section className="creative-error">{message}</section>}
  </>;
}
