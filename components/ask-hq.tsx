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
type CommandResult = {mode:string;title:string;summary:string;items:Array<{id:string;title:string;meta:string}>;action?:{label:string;target:string;handoff?:Record<string,string>}};
type WorkflowHandoff = {
  venture?: string;
  outcome?: string;
  sourceContext?: string;
  sourceEvidenceIds?: string[];
};

const ventures = ["Bubble Leisure", "Brilliant AI Automation", "FireComplianceUK", "Bankole & Associates", "TradeCompare", "Lucky Studios", "SAYAH", "Oddly", "TripleMMM"];
const examplesByVenture: Record<string,string[]> = {
  "Bubble Leisure":["Find winning ads","Follow up my leads","Create a campaign","What is blocking bookings?"],
  "Brilliant AI Automation":["Find new prospects","Prepare personalised outreach","Create a client pitch","What needs following up?"],
  "FireComplianceUK":["Find live opportunities","Match suppliers to opportunities","Prepare buyer outreach","What deadlines need attention?"],
  "Bankole & Associates":["What is blocking my active deals?","Find new mandates","Prepare a deal follow-up","Show missing diligence"],
};

export default function AskHQ({ openCreate }: { openCreate: () => void }) {
  const [venture, setVenture] = useState("Bubble Leisure");
  const [outcome, setOutcome] = useState("");
  const [sourceContext, setSourceContext] = useState("");
  const [sourceEvidenceIds, setSourceEvidenceIds] = useState<string[]>([]);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [executions, setExecutions] = useState<Array<Execution | null>>([]);
  const [activeStep, setActiveStep] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [commandResult,setCommandResult]=useState<CommandResult|null>(null);

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
    return [outcome, sourceContext ? `Selected source context:
${sourceContext}` : ""].filter(Boolean).join("

");
  }, [proposal, currentStep, activeStep, executions, outcome, sourceContext]);

  const recommend = async () => {
    setBusy("recommend"); setError(null); setProposal(null); setCommandResult(null); setExecutions([]); setActiveStep(0);
    try {
      const direct=await fetch("/api/hq/command",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({venture,command:outcome})});
      const result=await direct.json() as CommandResult & {error?:string};
      if(!direct.ok) throw new Error(result.error||"HQ could not run this command.");
      if(result.mode!=="workflow"){setCommandResult(result);return;}
      const response = await fetch("/api/workflows/propose", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({ venture, outcome, sourceContext, sourceEvidenceIds })});
      const data = await response.json() as Proposal & { error?: string };
      if (!response.ok) throw new Error(data.error ?? result.summary);
      if (!data.steps?.length) throw new Error(data.summary || result.summary);
      setProposal(data); setExecutions(Array(data.steps.length).fill(null));
    } catch (cause) {setError(cause instanceof Error ? cause.message : "HQ could not run this command.");}
    finally {setBusy(null);}
  };
