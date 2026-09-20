import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";

export const runtime = "nodejs";
export const maxDuration = 55;

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL) return NextResponse.json({error:"DATABASE_URL is not configured."},{status:503});
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({error:"Competitor research needs the configured AI research provider."},{status:503});
  const body=await request.json().catch(()=>({})) as { competitorId?:string };
  if(!body.competitorId) return NextResponse.json({error:"Competitor is required."},{status:400});
  const competitor=await prisma.competitor.findUnique({where:{id:body.competitorId},include:{venture:true}});
  if(!competitor) return NextResponse.json({error:"Competitor not found."},{status:404});
  const channels=[competitor.websiteUrl,competitor.instagramUrl,competitor.facebookUrl,competitor.youtubeChannelUrl].filter(Boolean).join("\n");
  let domain=""; try{domain=competitor.websiteUrl?new URL(competitor.websiteUrl).hostname.replace(/^www\\./,""):"";}catch{}
  const googleTransparencyUrl=domain?`https://adstransparency.google.com/?domain=${encodeURIComponent(domain)}&region=GB`:null;
  const prompt=`Research recent, real, publicly verifiable marketing activity for this competitor.
BUSINESS WE OPERATE: ${competitor.venture.name}
COMPETITOR: ${competitor.name}
KNOWN OFFICIAL CHANNELS:
${channels || "Find official public sources yourself."}

Find up to 6 useful recent public examples: organic social posts/videos OR commercial advertising/campaign creative. Prioritise official Instagram, Facebook, YouTube, the competitor website, and Meta Ad Library where publicly verifiable. Never invent URLs, engagement numbers, performance, ROAS, saves, watch time or conversions. Only report a metric if a public source visibly supports it.

Return ONLY JSON:
{"evidence":[{"title":"...","sourceUrl":"https://...","platform":"INSTAGRAM|META|YOUTUBE|WEB","distribution":"ORGANIC|PAID","contentType":"REEL|SOCIAL_POST|VIDEO|CAMPAIGN|WEBSITE_PAGE","summary":"what the creative/message actually does","publicSignal":"specific observable fact, or null","whyItMatters":"short commercial interpretation"}]}`;
  const response=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${process.env.OPENAI_API_KEY}`},body:JSON.stringify({model:"gpt-5-mini",tools:[{type:"web_search"}],input:prompt,max_output_tokens:2200})});
  const raw=await response.json().catch(()=>({}));
  if(!response.ok){const detail=raw?.error?.message||`Provider returned ${response.status}`; console.error("competitor-research-provider",response.status,detail); return NextResponse.json({error:"HQ could not research this competitor right now."},{status:502});}
  const text=(raw.output||[]).flatMap((x:any)=>x.content||[]).map((x:any)=>x.text||"").join("").trim().replace(/^```json\s*/i,"").replace(/```$/,"").trim();
  let items:any[]=[]; try{const parsed=JSON.parse(text);items=Array.isArray(parsed.evidence)?parsed.evidence.slice(0,6):[];}catch{return NextResponse.json({error:"Research completed but could not be structured safely."},{status:502});}
  const now=new Date(); const saved=[];
  for(const item of items){
    let source:URL; try{source=new URL(item.sourceUrl);}catch{continue;} if(source.protocol!=="https:") continue;
    const evidence=await prisma.intelligenceEvidence.create({data:{ventureId:competitor.ventureId,competitorId:competitor.id,competitorName:competitor.name,accountName:competitor.name,platform:item.platform||"WEB",distribution:item.distribution==="PAID"?"PAID":"ORGANIC",contentType:item.contentType||"SOCIAL_POST",format:item.contentType||"Public creative",title:item.title||`${competitor.name} public activity`,sourceUrl:source.toString(),contentText:[item.summary,item.whyItMatters? `HQ INTERPRETATION: ${item.whyItMatters}`:""].filter(Boolean).join("\n\n"),firstSeenAt:now,lastSeenAt:now,activityStatus:"Observed",provenance:"Public web research with source URL; no private competitor analytics inferred",observableSignals:{publicSignal:item.publicSignal??null,strengthSignal:item.strengthSignal??null,replicationIdea:item.replicationIdea??null,researchMethod:"web_search",privateMetricsInferred:false,googleTransparencyUrl} as Prisma.InputJsonValue}});
    saved.push(evidence);
  }
  await prisma.competitor.update({where:{id:competitor.id},data:{lastCollectedAt:now,lastCollectionError:null}});
  return NextResponse.json({evidence:saved,notice:`Added ${saved.length} source-backed public examples for ${competitor.name}.`},{status:201});
}
