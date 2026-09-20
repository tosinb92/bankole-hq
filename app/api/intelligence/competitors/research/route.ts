import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";

export const runtime = "nodejs";
export const maxDuration = 55;

type ResearchItem = { title?:string; advertiser?:string; sourceUrl?:string; platform?:string; distribution?:string; contentType?:string; summary?:string; publicSignal?:string|null; strengthSignal?:string|null; replicationIdea?:string|null; whyItMatters?:string|null };

async function research(input:string){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),18000);
  try{
    const response=await fetch("https://api.openai.com/v1/responses",{method:"POST",signal:controller.signal,headers:{"Content-Type":"application/json","Authorization":`Bearer ${process.env.OPENAI_API_KEY}`},body:JSON.stringify({model:"gpt-5-mini",tools:[{type:"web_search"}],input,max_output_tokens:1200})});
    const raw=await response.json().catch(()=>({}));
    if(!response.ok) return {items:[] as ResearchItem[],error:raw?.error?.message||`Provider ${response.status}`};
    const text=(raw.output||[]).flatMap((x:any)=>x.content||[]).map((x:any)=>x.text||"").join("").trim().replace(/^```json\s*/i,"").replace(/```$/,"").trim();
    try{const parsed=JSON.parse(text);return {items:(Array.isArray(parsed.evidence)?parsed.evidence:[]).slice(0,5) as ResearchItem[]};}catch{return {items:[] as ResearchItem[],error:"Could not structure results"};}
  }catch(e){return {items:[] as ResearchItem[],error:e instanceof Error?e.message:"Research failed"};}finally{clearTimeout(timer);}
}

async function enrichMedia(url:string){
  if(!process.env.SCRAPER_API_KEY) return null;
  try{
    const endpoint=new URL("https://api.scraperapi.com/"); endpoint.searchParams.set("api_key",process.env.SCRAPER_API_KEY); endpoint.searchParams.set("url",url); endpoint.searchParams.set("render","true");
    const response=await fetch(endpoint,{signal:AbortSignal.timeout(12000)}); if(!response.ok) return null; const html=await response.text();
    const match=html.match(/<meta[^>]+(?:property|name)=[\"'](?:og:image|twitter:image)[\"'][^>]+content=[\"']([^\"']+)[\"']/i)||html.match(/<meta[^>]+content=[\"']([^\"']+)[\"'][^>]+(?:property|name)=[\"'](?:og:image|twitter:image)[\"']/i);
    return match?.[1]?.replace(/&amp;/g,"&")||null;
  }catch{return null;}
}

export async function POST(request:Request){
  if(!process.env.DATABASE_URL) return NextResponse.json({error:"DATABASE_URL is not configured."},{status:503});
  if(!process.env.OPENAI_API_KEY) return NextResponse.json({error:"Competitor research needs the configured AI research provider."},{status:503});
  const body=await request.json().catch(()=>({})) as {competitorId?:string; discoverMarket?:boolean};
  if(!body.competitorId) return NextResponse.json({error:"Competitor is required."},{status:400});
  const competitor=await prisma.competitor.findUnique({where:{id:body.competitorId},include:{venture:true}});
  if(!competitor) return NextResponse.json({error:"Competitor not found."},{status:404});
  let domain=""; try{domain=competitor.websiteUrl?new URL(competitor.websiteUrl).hostname.replace(/^www\./,""):"";}catch{}
  const channels=[competitor.websiteUrl,competitor.instagramUrl,competitor.facebookUrl,competitor.youtubeChannelUrl].filter(Boolean).join("\n");
  const rules=`Business: ${competitor.venture.name}. Starting competitor: ${competitor.name}. Known channels:\n${channels}. IMPORTANT: this is market-wide ad discovery, not a search limited to the starting competitor. If this advertiser has no verifiable ads, find other real advertisers competing for the same customers/occasions and return their ads. Put the advertiser name at the start of title as "ADVERTISER: campaign title". Return ONLY JSON {"evidence":[{"title":"...","advertiser":"real advertiser name","sourceUrl":"https://...","platform":"...","distribution":"PAID|ORGANIC","contentType":"...","summary":"...","publicSignal":"...","strengthSignal":"LOW|MEDIUM|HIGH","replicationIdea":"a distinct test for our business, not copied protected creative","whyItMatters":"..."}]}. Use only real public URLs. Never invent spend, conversions, CPA, ROAS, profit, saves or private metrics.`;
  const jobs=[
    {source:"Google Ads",prompt:`${rules}\nFind up to 5 recent publicly verifiable Google advertising examples/signals from ANY relevant advertiser in this market. Search beyond the starting competitor. Search Google Ads Transparency Center, Search/YouTube ad evidence and advertiser/domain references. Prefer paid creative; do not substitute a normal homepage unless it directly documents a campaign.`},
    {source:"Meta & social",prompt:`${rules}\nFind up to 5 recent publicly verifiable Meta/Facebook/Instagram or YouTube campaign/post examples from ANY relevant advertiser in this market. Search beyond the starting competitor. Prioritise Meta Ad Library and official social URLs. Prefer actual post/ad/video URLs over homepages.`}
  ];
  const results=await Promise.all(jobs.map(async j=>({source:j.source,...await research(j.prompt)})));
  const now=new Date(); const saved=[]; const seen=new Set<string>();
  for(const result of results) for(const item of result.items){
    if(!item.sourceUrl||seen.has(item.sourceUrl)) continue;
    let source:URL; try{source=new URL(item.sourceUrl);}catch{continue;} if(source.protocol!=="https:") continue; seen.add(item.sourceUrl);
    const mediaUrl=await enrichMedia(source.toString());
    const evidence=await prisma.intelligenceEvidence.create({data:{ventureId:competitor.ventureId,competitorId:null,competitorName:(item.advertiser||competitor.name),accountName:(item.advertiser||competitor.name),platform:item.platform||"WEB",distribution:item.distribution==="PAID"?"PAID":"ORGANIC",contentType:item.contentType||"CAMPAIGN",format:item.contentType||"Public campaign",title:item.title||`${item.advertiser||competitor.name} campaign`,sourceUrl:source.toString(),mediaUrl,contentText:[item.summary,item.whyItMatters?`WHY IT MATTERS: ${item.whyItMatters}`:"",item.replicationIdea?`TEST FOR US: ${item.replicationIdea}`:""].filter(Boolean).join("\n\n"),firstSeenAt:now,lastSeenAt:now,activityStatus:"Observed",provenance:`${result.source} public research; no private competitor analytics inferred`,observableSignals:{publicSignal:item.publicSignal??null,strengthSignal:item.strengthSignal??null,replicationIdea:item.replicationIdea??null,researchMethod:"web_search",privateMetricsInferred:false} as Prisma.InputJsonValue}});
    saved.push(evidence);
  }
  const status=results.map(r=>({source:r.source,status:r.items.length?"complete":"unavailable",found:r.items.length,error:r.error||null}));
  await prisma.competitor.update({where:{id:competitor.id},data:{lastCollectedAt:now,lastCollectionError:saved.length?null:"No campaign evidence returned"}});
  return NextResponse.json({evidence:saved,status,notice:saved.length?`Added ${saved.length} campaign examples. ${status.map(s=>`${s.source}: ${s.found}`).join(" · ")}`:"No verified campaigns were returned this time. Existing evidence was kept."},{status:200});
}
