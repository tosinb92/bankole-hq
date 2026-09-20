import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";

export const runtime="nodejs";
export const maxDuration=60;

type Body={evidenceId?:string;transcript?:string;outputs?:string[]};
type ModelPayload={choices?:Array<{message?:{content?:string|null}}>};
const clean=(s:string)=>s.replace(/^\s*```(?:json)?/i,"").replace(/```\s*$/,"").trim();

export async function POST(request:Request){
 try{
  if(!process.env.OPENAI_API_KEY) return NextResponse.json({error:"OPENAI_API_KEY is not configured."},{status:503});
  const body=await request.json() as Body;
  if(!body.evidenceId) return NextResponse.json({error:"Evidence id is required."},{status:400});
  const evidence=await prisma.intelligenceEvidence.findUnique({where:{id:body.evidenceId},include:{venture:true}});
  if(!evidence) return NextResponse.json({error:"Outlier not found."},{status:404});
  const transcript=body.transcript?.trim()||evidence.contentText?.trim();
  if(!transcript) return NextResponse.json({error:"Transcript required. For YouTube, use vidIQ transcript first; for Reels/TikTok use the connected transcript provider, then send the transcript here."},{status:409});
  const skills=await prisma.skill.findMany({where:{active:true,OR:[{name:{contains:"Niche",mode:"insensitive"}},{name:{contains:"Repurpos",mode:"insensitive"}}]},select:{name:true,instructions:true}});
  const skillText=skills.filter(s=>s.instructions?.trim()).map(s=>`=== ${s.name} ===\n${s.instructions}`).join("\n\n");
  const outputs=body.outputs?.length?body.outputs:["short-form video script","Instagram Reel/TikTok version","LinkedIn post","X thread","carousel outline"];
  const prompt=`You are Bankole HQ's content repurposing engine. Reverse-engineer a proven social outlier into ORIGINAL content for ${evidence.venture.name}. Do not plagiarize unique wording. Preserve the useful structural mechanics: hook type, pacing, narrative shape, proof pattern and CTA logic. Adapt the subject, examples and claims to the selected business. Never invent performance or business facts.

SOURCE
Title: ${evidence.title}
Creator: ${evidence.competitorName}
Platform: ${evidence.platform}
URL: ${evidence.sourceUrl??""}
Observable signals: ${JSON.stringify(evidence.observableSignals??{})}
Metrics: ${JSON.stringify(evidence.metrics??{})}
TRANSCRIPT
${transcript}

REQUESTED OUTPUTS
${outputs.join("; ")}

APPROVED SKILL INSTRUCTIONS
${skillText||"Apply niche-hacking and content-repurposing principles: extract content atoms, identify the winning format, adapt rather than copy, and make each platform-native."}

Return ONLY JSON:
{"sourceAnalysis":{"hook":"","format":"","whyItLikelyWorked":"","contentAtoms":[""],"structure":[""]},"repurposed":[{"platform":"","format":"","title":"","hook":"","script":"","caption":"","cta":"","productionBrief":""}]}
The script must be ready to record, not an outline. Platform versions must be genuinely adapted, not the same copy pasted everywhere.`;
  const response=await fetch("https://api.openai.com/v1/chat/completions",{method:"POST",headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({model:"gpt-4.1-mini",messages:[{role:"user",content:prompt}],temperature:.6,response_format:{type:"json_object"}})});
  const payload=await response.json() as ModelPayload&{error?:{message?:string}};
  const raw=payload.choices?.[0]?.message?.content?.trim();
  if(!response.ok||!raw) throw new Error(payload.error?.message??"Repurposing model returned no content.");
  const result=JSON.parse(clean(raw));
  await prisma.intelligenceEvidence.update({where:{id:evidence.id},data:{contentText:transcript,observableSignals:{...((evidence.observableSignals as Record<string,unknown>|null)??{}),repurposed:result}}});
  return NextResponse.json({result});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Could not repurpose outlier."},{status:500});}
}
