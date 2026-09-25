import {NextRequest,NextResponse} from "next/server";import {prisma} from "@/lib/server/prisma";import {recentHqEvents,syncStatuses} from "@/lib/server/hq-live";export const runtime="nodejs";
function ok(req:NextRequest){const t=process.env.HQ_MCP_TOKEN||process.env.HQ_INGEST_TOKEN;return !!t&&req.headers.get("authorization")===`Bearer ${t}`;}
export async function GET(req:NextRequest){if(!ok(req))return NextResponse.json({error:"Unauthorized"},{status:401});
 const [ventures,tasks,deals,leads,events,integrations]=await Promise.all([
 prisma.venture.findMany({select:{id:true,name:true,status:true}}),
 prisma.task.findMany({where:{status:{not:"DONE"}},take:50,orderBy:{createdAt:"desc"},include:{venture:{select:{name:true}}}}),
 prisma.deal.findMany({take:50,orderBy:{createdAt:"desc"},include:{venture:{select:{name:true}}}}),
 prisma.lead.findMany({take:50,orderBy:{updatedAt:"desc"},include:{venture:{select:{name:true}}}}),
 recentHqEvents(100).catch(()=>[]),syncStatuses().catch(()=>[])
 ]);return NextResponse.json({generatedAt:new Date().toISOString(),ventures,tasks,deals,leads,events,integrations});}
