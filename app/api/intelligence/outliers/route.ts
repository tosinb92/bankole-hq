import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";

type Outlier = { videoId:string; videoTitle:string; videoThumbnail?:string; channelTitle?:string|null; viewCount?:number; breakoutScore?:number; engagementRate?:number|null; vph?:number|null; videoDuration?:number; videoPublishedAt?:number };

const ventureQueries:Record<string,string>={"Bubble Leisure":"bubble football kids parties corporate team building","Brilliant AI Automation":"AI automation small business sales marketing operations","FireComplianceUK":"fire door compliance fire safety property management","Bankole & Associates":"project finance capital raising business funding investment","TradeCompare":"property investment deal sourcing property deals","Lucky Studios":"AI music artist creative studio music marketing","SAYAH":"female R&B independent artist music","Oddly":"surreal AI video creative advertising","TripleMMM":"murals restaurant branding experiential design"};

export async function GET(request:Request){
 const venture=new URL(request.url).searchParams.get("venture")||"";
 if(!venture) return NextResponse.json({error:"venture is required"},{status:400});
 if(!process.env.VIDIQ_API_KEY) return NextResponse.json({error:"VIDIQ_API_KEY is not configured."},{status:503});
 return NextResponse.json({connected:true,venture,query:ventureQueries[venture]||venture,notice:"vidIQ credential is configured. Direct server-side MCP execution is the next connection step."});
}

export async function POST(request:Request){
 try{
  const body=await request.json() as {venture:string; videos:Outlier[]};
  if(!body.venture||!Array.isArray(body.videos)) return NextResponse.json({error:"venture and videos are required"},{status:400});
  const venture=await prisma.venture.findFirst({where:{name:body.venture}});
  if(!venture) return NextResponse.json({error:"Venture not found"},{status:404});
  let saved=0;
  for(const v of body.videos){
   if(!v.videoId||!v.videoTitle) continue;
   const sourceUrl=`https://www.youtube.com/watch?v=${v.videoId}`;
   const exists=await prisma.intelligenceEvidence.findFirst({where:{ventureId:venture.id,sourceUrl}});
   const metrics={views:v.viewCount??null,breakoutScore:v.breakoutScore??null,engagementRate:v.engagementRate??null,vph:v.vph??null};
   const signals={publicSignal:`${v.breakoutScore??0}x breakout vs channel baseline`,strengthSignal:(v.breakoutScore??0)>=20?"HIGH":(v.breakoutScore??0)>=5?"MEDIUM":"LOW",replicationIdea:null};
   if(exists){await prisma.intelligenceEvidence.update({where:{id:exists.id},data:{metrics,observableSignals:signals,mediaUrl:v.videoThumbnail??exists.mediaUrl}});}
   else {await prisma.intelligenceEvidence.create({data:{ventureId:venture.id,competitorName:v.channelTitle||"YouTube creator",accountName:v.channelTitle||null,platform:"YOUTUBE",distribution:"ORGANIC",contentType:"OUTLIER_VIDEO",mediaUrl:v.videoThumbnail||null,title:v.videoTitle,sourceUrl,durationSeconds:v.videoDuration?Math.round(v.videoDuration):null,observedAt:v.videoPublishedAt?new Date(v.videoPublishedAt*1000):null,activityStatus:"OUTLIER",metrics,observableSignals:signals,provenance:"vidIQ outlier discovery"}}); saved++;}
  }
  return NextResponse.json({ok:true,saved});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Could not import outliers"},{status:500});}
}
