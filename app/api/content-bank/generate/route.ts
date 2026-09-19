import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { ventureSkillProfiles, globalSkillRules } from "@/lib/venture-skill-profiles";

export const runtime="nodejs";
export const maxDuration=60;

type RequestBody={brand?:string;objective?:string;count?:number};
type ModelPayload={choices?:Array<{message?:{content?:string|null}}>};
const cleanJson=(text:string)=>text.replace(/^\s*```(?:json)?/i,"").replace(/```\s*$/,"").trim();

export async function POST(request:Request){
 if(!process.env.DATABASE_URL) return NextResponse.json({error:"The HQ database is not connected, so Content Bank cannot read your approved Skills."},{status:503});
 if(process.env.SKILL_EXECUTION_EXTERNAL_ENABLED!=="true") return NextResponse.json({error:"Skill execution is currently disabled in HQ. Set SKILL_EXECUTION_EXTERNAL_ENABLED=true after approving external AI execution."},{status:403});
 if(!process.env.OPENAI_API_KEY) return NextResponse.json({error:"OPENAI_API_KEY is not configured on the server."},{status:503});

 let body:RequestBody;
 try{body=await request.json() as RequestBody;}catch{return NextResponse.json({error:"Invalid request body."},{status:400});}
 const brand=body.brand?.trim(), objective=body.objective?.trim();
 const count=Math.min(100,Math.max(1,Number(body.count)||10));
 if(!brand||!objective) return NextResponse.json({error:"Business and objective are required."},{status:400});

 const profile=ventureSkillProfiles.find(v=>v.venture===brand);
 if(!profile) return NextResponse.json({error:`No venture Skill profile exists for ${brand}.`},{status:404});

 const skills=await prisma.skill.findMany({where:{active:true,name:{in:profile.preferredSkills}},select:{id:true,name:true,instructions:true,sourceFile:true,sourceVersion:true}});
 const usable=skills.filter(s=>s.instructions?.trim());
 if(!usable.length) return NextResponse.json({error:`No approved imported Skills matched ${brand}. Approve at least one of: ${profile.preferredSkills.join(", ")}.`},{status:409});

 const skillText=usable.map(s=>`=== APPROVED SKILL: ${s.name} ===\nSOURCE: ${s.sourceFile??"SKILL.md"} ${s.sourceVersion??""}\n${s.instructions}`).join("\n\n");
 const prompt=`You are the Content Bank execution layer inside Bankole HQ. Generate exactly ${count} genuinely distinct content concepts for the selected venture. You MUST apply the actual approved SKILL.md methods below. Do not generate a rotated template grid. Each piece must have a different strategic reason to exist. Do not invent competitor research, performance metrics, testimonials, customer behaviour or facts not supplied here.

VENTURE
${profile.venture}
OBJECTIVE
${objective}
AUDIENCES
${profile.audiences.join("; ")}
VOICE
${profile.voice}
VENTURE OBJECTIVES
${profile.objectives.join("; ")}
PROOF RULES
${profile.proofRules.join("; ")}
AVOID
${profile.avoid.join("; ")}

GLOBAL HQ RULES
${globalSkillRules.principles.join("\n")}

APPROVED SKILLS
${skillText}

Return ONLY valid JSON matching:
{"strategy":"short explanation of the content strategy produced by the Skills","evidenceSummary":"state exactly what inputs were used and explicitly note that no competitor/performance evidence was used unless present above","pieces":[{"title":"","format":"","purpose":"","hook":"","concept":"","caption":"","cta":"","productionBrief":"","skillsUsed":["exact skill names"],"evidenceUsed":[]}]}

Quality rules: concepts must be specific enough to produce; captions must fit the venture voice; production briefs must say what to film/design and how the opening works; every piece must name the actual Skills that materially shaped it; do not claim a Skill was used if its method is not visible in the output; preserve factual/proof constraints; vary formats only where strategically useful.`;

 try{
  const response=await fetch("https://api.openai.com/v1/chat/completions",{method:"POST",headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({model:"gpt-4.1-mini",messages:[{role:"user",content:prompt}],temperature:0.65,response_format:{type:"json_object"}})});
  const payload=await response.json() as ModelPayload&{error?:{message?:string}};
  const raw=payload.choices?.[0]?.message?.content?.trim();
  if(!response.ok||!raw) throw new Error(payload.error?.message??"The model returned no content.");
  const parsed=JSON.parse(cleanJson(raw)) as {strategy?:string;evidenceSummary?:string;pieces?:unknown[]};
  if(!Array.isArray(parsed.pieces)||parsed.pieces.length!==count) throw new Error(`Skill engine returned ${parsed.pieces?.length??0} pieces instead of ${count}.`);
  return NextResponse.json({generation:{brand,objective,strategy:parsed.strategy??"",evidenceSummary:parsed.evidenceSummary??"",skillsUsed:usable.map(s=>s.name),pieces:parsed.pieces}});
 }catch(cause){return NextResponse.json({error:cause instanceof Error?cause.message:"Skill-led content generation failed."},{status:502});}
}