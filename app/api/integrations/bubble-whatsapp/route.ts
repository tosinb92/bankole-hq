import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { prisma } from '@/lib/server/prisma';
import { isConnectionTest, recoverEnquiry, updateEnquiry, replyFor, superseded } from './conversation';
export const runtime = 'nodejs';
export const maxDuration = 30;
type Message = {sid:string;from:string;to:string;name:string;body:string;mediaCount:number};
function authorised(value:string|null) {
 const expected=process.env.BUBBLE_WHATSAPP_HQ_SECRET;
 if(!expected||!value)return false;
 const a=Buffer.from(value),b=Buffer.from(expected);
 return a.length===b.length&&timingSafeEqual(a,b);
}
export async function GET() {
 return NextResponse.json({ready:Boolean(process.env.DATABASE_URL&&process.env.BUBBLE_WHATSAPP_HQ_SECRET),channel:'whatsapp'});
}
export async function POST(req:Request) {
 if(!authorised(req.headers.get('x-bubble-whatsapp-secret')))return NextResponse.json({error:'Unauthorized'},{status:401});
 const m:Message=await req.json().catch(()=>null);
 if(!m||!/^SM[0-9a-f]{32}$/i.test(m.sid)||!/^whatsapp:\+\d{7,15}$/.test(m.from)||!/^whatsapp:\+\d{7,15}$/.test(m.to)||typeof m.body!=='string'||m.body.length>4000||typeof m.name!=='string'||m.name.length>160||!Number.isInteger(m.mediaCount)||m.mediaCount<0||m.mediaCount>20)return NextResponse.json({error:'Invalid message'},{status:400});
 try {
  const result=await prisma.$transaction(async tx=>{
   // Serialize messages per sender across serverless instances, including retries.
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'bubble-whatsapp:'+m.from}))`;
   const venture=await tx.venture.findUnique({where:{name:'Bubble Leisure'}});
   if(!venture)throw new Error('Venture unavailable');
   let lead=await tx.lead.findFirst({where:{ventureId:venture.id,phone:m.from.slice(9),requirements:{path:['source'],equals:'WhatsApp'}},orderBy:{createdAt:'desc'}});
   let state:any=lead?.requirements||{};
   const cached=await tx.communication.findFirst({where:{ventureId:venture.id,providerMessageId:m.sid}});
   if(cached){const saved=JSON.parse(cached.body||'{}');return {reply:saved.reply,leadId:saved.leadId,duplicate:true,skipReply:superseded(state.lastMessageSid,m.sid)};}
   if(!lead)lead=await tx.lead.create({data:{ventureId:venture.id,customerName:m.name||'WhatsApp enquiry',phone:m.from.slice(9),requirements:{source:'WhatsApp'},stage:'NEW_LEAD'}});
   // Derive fields only from customer text, never from an old assistant's claims.
   const enquiryBefore=recoverEnquiry(state.transcript);
   const enquiry=isConnectionTest(m.body)?enquiryBefore:updateEnquiry(enquiryBefore,m.body);
   const reply=replyFor(enquiry,m.body);
   const aiStatus='controlled-qualification';
   const email=m.body.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
   const transcript=[...(Array.isArray(state.transcript)?state.transcript:[]),{sid:m.sid,incoming:m.body,reply,at:new Date().toISOString(),mediaCount:m.mediaCount}].slice(-50);
   await tx.lead.update({where:{id:lead.id},data:{...(email?{email}:{}),requirements:{...state,source:'WhatsApp',previousChatId:null,enquiry,qualificationStatus:'awaiting-availability-check',lastMessageSid:m.sid,transcript,lastMessageAt:new Date().toISOString(),aiStatus}}});
   // Durable message ID record prevents a retried webhook calling AI twice.
   await tx.communication.create({data:{ventureId:venture.id,subject:'WhatsApp enquiry — '+lead.customerName,providerMessageId:m.sid,status:'SENT',body:JSON.stringify({leadId:lead.id,incoming:m.body,reply,aiStatus,delivery:'prepared'})}});
   const existingTask=await tx.task.findFirst({where:{leadId:lead.id,title:'Review WhatsApp enquiry',status:{in:['TODO','IN_PROGRESS']}}});
   if(!existingTask)await tx.task.create({data:{ventureId:venture.id,leadId:lead.id,title:'Review WhatsApp enquiry',status:'TODO',priority:2}});
   return {reply,leadId:lead.id,aiStatus};
  },{maxWait:1500,timeout:9500});
  return NextResponse.json(result);
 }catch{console.error('Bubble WhatsApp processing failed');return NextResponse.json({error:'Unable to save enquiry'},{status:503});}
}

export async function PATCH(req:Request){
 if(!authorised(req.headers.get('x-bubble-whatsapp-secret')))return NextResponse.json({error:'Unauthorized'},{status:401});
 const b=await req.json().catch(()=>null);
 if(!b||!/^SM[0-9a-f]{32}$/i.test(b.sid)||!['claim','sent','failed'].includes(b.action))return NextResponse.json({error:'Invalid delivery update'},{status:400});
 if(b.action==='sent'&&(typeof b.outboundId!=='string'||!b.outboundId.startsWith('wamid.')||b.outboundId.length>500))return NextResponse.json({error:'Invalid receipt'},{status:400});
 try{
  const result=await prisma.$transaction(async tx=>{
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'bubble-whatsapp-delivery:'+b.sid}))`;
   const venture=await tx.venture.findUnique({where:{name:'Bubble Leisure'}});
   if(!venture)throw new Error('Missing venture');
   const record=await tx.communication.findFirst({where:{ventureId:venture.id,providerMessageId:b.sid}});
   if(!record)throw new Error('Missing message');
   const state=JSON.parse(record.body||'{}');
   const lead=state.leadId?await tx.lead.findUnique({where:{id:state.leadId}}):null;
   const current:any=lead?.requirements||{};
   if(b.action==='claim'&&superseded(current.lastMessageSid,b.sid)){
    await tx.communication.update({where:{id:record.id},data:{body:JSON.stringify({...state,delivery:'superseded'})}});
    return {claimed:false,delivery:'superseded'};
   }
   if(b.action==='claim'){
    if(state.delivery==='sent')return {claimed:false,delivery:'sent'};
    if(state.delivery==='sending'&&Date.now()-Number(state.claimedAt||0)<60000)return {claimed:false,delivery:'sending'};
    await tx.communication.update({where:{id:record.id},data:{body:JSON.stringify({...state,delivery:'sending',claimedAt:Date.now()})}});
    return {claimed:true};
   }
   await tx.communication.update({where:{id:record.id},data:{body:JSON.stringify({...state,delivery:b.action,outboundId:b.outboundId||null})}});
   return {ok:true};
  });
  return NextResponse.json(result);
 }catch{return NextResponse.json({error:'Delivery update failed'},{status:503});}
}
