import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";

type Outlier = { videoId:string; videoTitle:string; videoThumbnail?:string; channelTitle?:string|null; viewCount?:number; breakoutScore?:number; engagementRate?:number|null; vph?:number|null; videoDuration?:number; videoPublishedAt?:number };

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
