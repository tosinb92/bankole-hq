import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";

export const runtime="nodejs";
type Outlier={videoId:string;videoTitle:string;videoThumbnail?:string;channelTitle?:string|null;viewCount?:number;breakoutScore?:number;engagementRate?:number|null;vph?:number|null;videoDuration?:number;videoPublishedAt?:number};
const ventureQueries:Record<string,string>={"Bubble Leisure":"bubble football zorb football kids activity parties","Brilliant AI Automation":"AI automation business workflows","FireComplianceUK":"fire safety fire doors property compliance","Bankole & Associates":"project finance capital raising investment","TradeCompare":"property investment deal sourcing","Lucky Studios":"AI music creative studio","SAYAH":"female R&B independent artist","Oddly":"surreal AI video advertising","TripleMMM":"murals experiential restaurant design"};

function parseMcp(text:string){
 const lines=text.split("\n").filter(x=>x.startsWith("data:")).map(x=>x.slice(5).trim());
 const raw=lines.length?lines[lines.length-1]:text;
 return JSON.parse(raw);
}
async function mcpRequest(payload:unknown,session?:string){
 const key=process.env.VIDIQ_API_KEY;if(!key)throw new Error("VIDIQ_API_KEY is not configured.");
 const r=await fetch("https://mcp.vidiq.com/mcp",{method:"POST",headers:{"Authorization":`Bearer ${key}`,"Content-Type":"application/json","Accept":"application/json, text/event-stream",...(session?{"Mcp-Session-Id":session}:{})},body:JSON.stringify(payload),cache:"no-store"});
 const text=await r.text();if(!r.ok)throw new Error(`vidIQ MCP ${r.status}: ${text.slice(0,180)}`);
 return {data:parseMcp(text),session:r.headers.get("mcp-session-id")||session};
}
async function searchVidIQ(keyword:string,limit=20){
 const init=await mcpRequest({jsonrpc:"2.0",id:1,method:"initialize",params:{protocolVersion:"2025-03-26",capabilities:{},clientInfo:{name:"Bankole HQ",version:"1.0"}}});
 const call=await mcpRequest({jsonrpc:"2.0",id:2,method:"tools/call",params:{name:"vidiq_outliers",arguments:{keyword,language:"en",publishedWithin:"oneYear",sort:"breakoutScore",limit}}},init.session||undefined);
 if(call.data?.error)throw new Error(call.data.error.message||"vidIQ search failed.");
 const c=call.data?.result?.content;
 for(const part of Array.isArray(c)?c:[]){if(part?.type==="text"&&part.text){try{const parsed=JSON.parse(part.text);if(Array.isArray(parsed?.videos))return parsed.videos as Outlier[];}catch{}}}
 if(Array.isArray(call.data?.result?.videos))return call.data.result.videos as Outlier[];
 return [];
}
async function persist(ventureId:string,videos:Outlier[]){
 let saved=0,updated=0;
 for(const v of videos){if(!v.videoId||!v.videoTitle)continue;const sourceUrl=`https://www.youtube.com/watch?v=${v.videoId}`;const exists=await prisma.intelligenceEvidence.findFirst({where:{ventureId,sourceUrl}});const metrics={views:v.viewCount??null,breakoutScore:v.breakoutScore??null,engagementRate:v.engagementRate??null,vph:v.vph??null};const signals={publicSignal:`${v.breakoutScore??0}x breakout vs channel baseline`,strengthSignal:(v.breakoutScore??0)>=20?"HIGH":(v.breakoutScore??0)>=5?"MEDIUM":"LOW",replicationIdea:null};if(exists){await prisma.intelligenceEvidence.update({where:{id:exists.id},data:{metrics,observableSignals:signals,mediaUrl:v.videoThumbnail??exists.mediaUrl,activityStatus:"OUTLIER"}});updated++;}else{await prisma.intelligenceEvidence.create({data:{ventureId,competitorName:v.channelTitle||"YouTube creator",accountName:v.channelTitle||null,platform:"YOUTUBE",distribution:"ORGANIC",contentType:"OUTLIER_VIDEO",mediaUrl:v.videoThumbnail||null,title:v.videoTitle,sourceUrl,durationSeconds:v.videoDuration?Math.round(v.videoDuration):null,observedAt:v.videoPublishedAt?new Date(v.videoPublishedAt*1000):null,activityStatus:"OUTLIER",metrics,observableSignals:signals,provenance:"vidIQ live outlier search"}});saved++;}}
 return {saved,updated};
}
export async function GET(request:Request){const ventureName=new URL(request.url).searchParams.get("venture")||"";if(!ventureName)return NextResponse.json({error:"venture is required"},{status:400});const venture=await prisma.venture.findFirst({where:{name:ventureName}});if(!venture)return NextResponse.json({error:"Venture not found"},{status:404});const items=await prisma.intelligenceEvidence.findMany({where:{ventureId:venture.id,activityStatus:"OUTLIER"},orderBy:{capturedAt:"desc"},take:100});return NextResponse.json({connected:Boolean(process.env.VIDIQ_API_KEY),venture:ventureName,query:ventureQueries[ventureName]||ventureName,count:items.length,items});}
export async function POST(request:Request){try{const body=await request.json() as {venture:string;query?:string;videos?:Outlier[];limit?:number};if(!body.venture)return NextResponse.json({error:"venture is required"},{status:400});const venture=await prisma.venture.findFirst({where:{name:body.venture}});if(!venture)return NextResponse.json({error:"Venture not found"},{status:404});const query=(body.query||ventureQueries[body.venture]||body.venture).trim();const videos=Array.isArray(body.videos)?body.videos:await searchVidIQ(query,Math.min(Math.max(body.limit||20,1),50));const counts=await persist(venture.id,videos);return NextResponse.json({ok:true,query,found:videos.length,...counts,videos});}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Could not search vidIQ outliers"},{status:500});}}
