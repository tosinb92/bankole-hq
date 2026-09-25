import {NextRequest,NextResponse} from "next/server";import {recordHqEvent,recentHqEvents} from "@/lib/server/hq-live";
export const runtime="nodejs";
function ok(req:NextRequest){const t=process.env.HQ_INGEST_TOKEN;return !!t&&req.headers.get("authorization")===`Bearer ${t}`;}
export async function GET(req:NextRequest){if(!ok(req))return NextResponse.json({error:"Unauthorized"},{status:401});return NextResponse.json({events:await recentHqEvents(100)});}
export async function POST(req:NextRequest){if(!ok(req))return NextResponse.json({error:"Unauthorized"},{status:401});const b=await req.json();if(!b.source||!b.eventType||!b.title)return NextResponse.json({error:"source, eventType and title are required"},{status:400});const id=await recordHqEvent(b);return NextResponse.json({ok:true,id},{status:201});}
