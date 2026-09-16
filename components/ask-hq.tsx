"use client";

import { useEffect, useMemo, useState } from "react";

type ProposedStep = {
  skillId: string;
  skillName: string;
  sourceFile?: string | null;
  sourceVersion?: string | null;
  reason: string;
  requiredInput: string;
};
type Proposal = {
  summary: string;
  evidenceNote: string;
  steps: ProposedStep[];
  sourceEvidence: Array<{ id: string; title: string; sourceUrl?: string | null; provenance: string }>;
};
type Execution = {
  id: string;
  output: string;
  status: string;
  approvalState: string;
  evidenceIds: string[];
  skill: { id: string; name: string; sourceFile?: string | null; sourceVersion?: string | null };
  approved?: boolean;
};
type WorkflowHandoff = {
  venture?: string;
  outcome?: string;
  sourceContext?: string;
  sourceEvidenceIds?: string[];
};

const ventures = ["Bubble Leisure", "TripleMMM", "Oddly", "Lucky Studios", "SAYAH", "FireComplianceUK", "Bankole & Associates"];
const examples = [
  "Find me new Bubble Leisure paid-social opportunities from competitor intelligence",
  "Create a Bubble Leisure paid-social campaign",
  "Turn this TripleMMM interview into a month of content",
  "Build a SAYAH release campaign",
];

export default function AskHQ({ openCreate }: { openCreate: () => void }) {
  const [venture, setVenture] = useState("Bubble Leisure");
  const [outcome, setOutcome] = useState(examples[0]);
  const [sourceContext, setSourceContext] = useState("");
  const [sourceEvidenceIds, setSourceEvidenceIds] = useState<string[]>([]);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [executions, setExecutions] = useState<Array<Execution | null>>([]);
  const [activeStep, setActiveStep] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const raw = window.sessionStorage.getItem("bankole-hq:workflow-handoff");
    if (!raw) return;
    try {
      const handoff = JSON.parse(raw) as WorkflowHandoff;
      if (handoff.venture && ventures.includes(handoff.venture)) setVenture(handoff.venture);
      if (handoff.outcome) setOutcome(handoff.outcome);
      setSourceContext(handoff.sourceContext ?? "");
      setSourceEvidenceIds(handoff.sourceEvidenceIds ?? []);
      window.sessionStorage.removeItem("bankole-hq:workflow-handoff");
    } catch {
      window.sessionStorage.removeItem("bankole-hq:workflow-handoff");
    }
  }, []);

  const currentStep = proposal?.steps[activeStep];
  const stepInput = useMemo(() => {
    if (!proposal || !currentStep) return "";
    if (activeStep > 0) return executions[activeStep - 1]?.output ?? "";
    return [outcome, sourceContext ? `Selected source context:\n${sourceContext}` : ""].filter(Boolean).join("\n\n");
  }, [proposal, currentStep, activeStep, executions, outcome, sourceContext]);

  const recommend = async () => {
    setBusy("recommend"); setError(null); setProposal(null); setExecutions([]); setActiveStep(0);
    try {
      const response = await fetch("/api/workflows/propose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venture, outcome, sourceContext, sourceEvidenceIds }),
      });
      const data = await response.json() as Proposal & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "HQ could not recommend a workflow.");
      if (!data.steps?.length) throw new Error(data.summary || "No approved imported skill fits this outcome yet.");
      setProposal(data);
      setExecutions(Array(data.steps.length).fill(null));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "HQ could not recommend a workflow.");
    } finally { setBusy(null); }
  };

  const runStep = async () => {
    if (!currentStep) return;
    setBusy("execute"); setError(null);
    try {
      const response = await fetch("/api/workflows/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          venture,
          skillId: currentStep.skillId,
          input: stepInput,
          sourceEvidenceIds,
          projectRef: outcome,
        }),
      });
      const data = await response.json() as { execution?: Execution; error?: string };
      if (!response.ok || !data.execution) throw new Error(data.error ?? "The approved skill did not complete.");
      setExecutions(current => current.map((item, index) => index === activeStep ? data.execution! : item));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The approved skill did not complete.");
    } finally { setBusy(null); }
  };

  const editOutput = (value: string) =>
    setExecutions(current => current.map((item, index) => index === activeStep && item ? { ...item, output: value, approved: false, approvalState: "Needs review" } : item));

  const approve = async () => {
    const execution = executions[activeStep];
    if (!execution) return;
    setBusy("approve"); setError(null);
    try {
      const response = await fetch(`/api/workflows/executions/${execution.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ output: execution.output, approvalState: "Approved" }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Approval could not be saved.");
      setExecutions(current => current.map((item, index) => index === activeStep && item ? { ...item, approved: true, approvalState: "Approved", status: "COMPLETED" } : item));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Approval could not be saved.");
    } finally { setBusy(null); }
  };

  const sendToCreate = (creationType?: "Video") => {
    const latest = [...executions].reverse().find(Boolean);
    if (!latest) return;
    const defaultVideo: Record<string, string> = {
      "Bubble Leisure": "15s Paid-Social Video",
      Oddly: "Cinematic Visual",
      SAYAH: "Music Teaser",
    };
    sessionStorage.setItem("bankole-hq:create-handoff", JSON.stringify({
      venture,
      project: outcome,
      skill: latest.skill.name,
      output: latest.output,
      sourceEvidence: proposal?.sourceEvidence.map(item => `${item.title} · ${item.provenance}`).join("\n") || sourceContext,
      creationType,
      creationPreset: creationType === "Video" ? defaultVideo[venture] ?? "Custom Video" : undefined,
      workflowExecutionId: latest.id,
    }));
    openCreate();
  };

  return <>
    <section className="exec-hero">
      <div><p className="eyebrow">ASK HQ · OUTCOME-FIRST WORKFLOWS</p><h2>Tell HQ what you want accomplished.</h2><p>HQ recommends from active imported SKILL.md instructions, then executes each approved step with inspectable provenance.</p></div>
      <span className="badge needs-approval">You approve each output</span>
    </section>
    <section className="creative-workspace">
      <div className="panel create-form">
        <label>Venture<select value={venture} onChange={event => setVenture(event.target.value)}>{ventures.map(item => <option key={item}>{item}</option>)}</select></label>
        <label>What outcome do you want?<textarea rows={6} value={outcome} onChange={event => setOutcome(event.target.value)} /></label>
        <div className="preset-list">{examples.map(item => <button key={item} onClick={() => { setOutcome(item); if (item.includes("TripleMMM")) setVenture("TripleMMM"); else if (item.includes("SAYAH")) setVenture("SAYAH"); else setVenture("Bubble Leisure"); }}>{item}<b>→</b></button>)}</div>
        {sourceContext && <label>Selected intelligence context<textarea rows={6} value={sourceContext} onChange={event => setSourceContext(event.target.value)} /></label>}
        <p className="note">{sourceEvidenceIds.length ? `${sourceEvidenceIds.length} selected evidence record(s) will be included. No unselected competitor evidence is sent.` : "No competitor evidence selected. HQ can still route a workflow from your outcome and approved skills."}</p>
        <button className="primary" onClick={recommend} disabled={!!busy || !outcome.trim()}>{busy === "recommend" ? "Matching approved skills…" : "Recommend Workflow"}</button>
      </div>
      <div className="creative-results">
        <section className="panel">
          <div className="panel-title"><h2>Proposed workflow</h2><span>{proposal ? `${proposal.steps.length} approved skill step(s)` : "Waiting for an outcome"}</span></div>
          {!proposal && <div className="create-empty">Describe the result you need. HQ will inspect the actual active imported skill instructions and explain why each recommended step fits.</div>}
          {proposal && <><p>{proposal.summary}</p><p className="note">{proposal.evidenceNote}</p><div className="workflow-step-list">{proposal.steps.map((step, index) => <article key={step.skillId + index} className={index === activeStep ? "opportunity-card selected-preset" : "opportunity-card"}><b>{index + 1}. {step.skillName}</b><p>{step.reason}</p><small>Needs: {step.requiredInput}</small><small>Source: {step.sourceFile ?? "Imported SKILL.md"} · {step.sourceVersion ?? "Imported version"}</small><button onClick={() => setActiveStep(index)}>Open step</button></article>)}</div></>}
        </section>
        {currentStep && <section className="panel intelligence-result">
          <div className="panel-title"><h2>Step {activeStep + 1} · {currentStep.skillName}</h2><span className="badge needs-approval">{executions[activeStep]?.approvalState ?? "Not run"}</span></div>
          <div className="evidence-links"><b>Provenance</b><span>{currentStep.sourceFile ?? "Imported SKILL.md"} · {currentStep.sourceVersion ?? "Imported version"}</span><span>{sourceEvidenceIds.length} explicitly selected evidence record(s)</span></div>
          <label>Input to this skill<textarea rows={7} value={stepInput} readOnly /></label>
          {!executions[activeStep] && <div className="output-actions"><button className="primary" onClick={runStep} disabled={!!busy || !stepInput.trim()}>{busy === "execute" ? "Running approved skill…" : "Run this Skill"}</button><button onClick={() => setActiveStep(Math.min(activeStep + 1, proposal!.steps.length - 1))} disabled={activeStep === proposal!.steps.length - 1}>Skip this step</button></div>}
          {executions[activeStep] && <><label>Actual generated output<textarea rows={18} value={executions[activeStep]!.output} onChange={event => editOutput(event.target.value)} /></label><div className="output-actions"><button onClick={runStep} disabled={!!busy}>{busy === "execute" ? "Regenerating…" : "Regenerate"}</button><button onClick={() => navigator.clipboard?.writeText(executions[activeStep]!.output)}>Copy</button><button onClick={approve} disabled={!!busy || executions[activeStep]!.approved}>{busy === "approve" ? "Saving approval…" : executions[activeStep]!.approved ? "Approved" : "Approve output"}</button>{activeStep < proposal!.steps.length - 1 && <button className="primary" onClick={() => setActiveStep(activeStep + 1)} disabled={!executions[activeStep]!.approved}>Continue to next Skill →</button>}<button onClick={() => sendToCreate()}>Send to Create</button><button className="primary" onClick={() => sendToCreate("Video")}>Send to Create → Video</button></div></>}
        </section>}
        {proposal?.sourceEvidence.length ? <section className="panel"><div className="panel-title"><h2>Selected source evidence</h2><span>Observed, not inferred</span></div>{proposal.sourceEvidence.map(item => <article className="opportunity-card" key={item.id}><b>{item.title}</b><small>{item.provenance}</small>{item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noreferrer">Open source ↗</a>}</article>)}</section> : null}
      </div>
    </section>
    {error && <section className="creative-error">{error}</section>}
  </>;
}
