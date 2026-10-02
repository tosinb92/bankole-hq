import { NextRequest, NextResponse, after } from "next/server";
import {recordHqEvent,markSync} from "@/lib/server/hq-live";
import {bubbleService,equalSecret} from "@/lib/server/bubble-security";
import {intakeBubbleWebsite,flushBubbleMessages} from "@/lib/server/bubble-workflow";
export const runtime="nodejs";
export async function POST(req:NextRequest){
 const b=await req.json().catch(()=>null);
 if(!b)return NextResponse.json({error:"Invalid request"},{status:400});
 if(b.source==="bubble-leisure-website" && b.type==="LEAD_CREATED"){
   if(!bubbleService(req))return NextResponse.json({error:"Unauthorized"},{status:401});
   try {const result=await intakeBubbleWebsite(b.payload || {});after(async()=>{await flushBubbleMessages();});return NextResponse.json({ok:true,...result});}
   catch{return NextResponse.json({error:"Unable to save enquiry"},{status:503});}
 }
 if(!equalSecret(req.headers.get("x-hq-webhook-secret"),process.env.HQ_WEBHOOK_SECRET))return NextResponse.json({error:"Unauthorized"},{status:401});
 const source=String(b.source||"webhook");
 await recordHqEvent({source,sourceRef:b.id||b.ref,eventType:b.type||"EXTERNAL_EVENT",ventureName:b.ventureName,title:b.title||`${source} update`,detail:b.detail,payload:b,importance:b.importance??60,occurredAt:b.occurredAt});
 await markSync(source,source,"LIVE",null,{lastEvent:b.type||"EXTERNAL_EVENT"});return NextResponse.json({ok:true});
}
