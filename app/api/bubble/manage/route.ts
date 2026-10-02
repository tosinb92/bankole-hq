import {NextResponse,after} from 'next/server';
import {randomUUID} from 'node:crypto';
import {prisma} from '@/lib/server/prisma';
import {bubbleService,bookingLink} from '@/lib/server/bubble-security';
import {queueBubbleMessage,flushBubbleMessages} from '@/lib/server/bubble-workflow';
export const runtime='nodejs';
export async function POST(request:Request) {
 if(!bubbleService(request))return NextResponse.json({error:'Unauthorized'},{status:401});
 const b=await request.json().catch(()=>({}));
 const venture=await prisma.venture.findUnique({where:{name:'Bubble Leisure'}});
 if(!venture)return NextResponse.json({error:'Business not configured'},{status:503});
 if(b.action==='list') {
  const leads=await prisma.lead.findMany({where:{ventureId:venture.id},orderBy:{updatedAt:'desc'},take:200,include:{quotes:{orderBy:{createdAt:'desc'},take:1}}});
  const pendingMessages=await prisma.communication.count({where:{ventureId:venture.id,id:{startsWith:'bubble-mail-'},status:{in:['APPROVED','FAILED']}}});
  return NextResponse.json({leads:leads.map(l=>({...l,quotes:l.quotes.map(q=>({...q,customerPrice:Number(q.customerPrice),directCosts:Number(q.directCosts),grossProfit:Number(q.grossProfit)})),bookingUrl:bookingLink(l.id)})),pendingMessages,readiness:{payments:Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET),email:Boolean(process.env.RESEND_API_KEY && process.env.BUBBLE_FROM_EMAIL),metaSignature:Boolean(process.env.META_APP_SECRET),calls:Boolean(process.env.VAPI_API_KEY && process.env.VAPI_ASSISTANT_ID && process.env.VAPI_PHONE_NUMBER_ID),scheduled:Boolean(process.env.CRON_SECRET)}});
 }
 if(b.action==='send-pending')return NextResponse.json(await flushBubbleMessages());
 const id=String(b.id || '');
 try {
 const result=await prisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`;
  const lead=await tx.lead.findUnique({where:{id},include:{quotes:{orderBy:{createdAt:'desc'},take:1}}});
  if(!lead || lead.ventureId!==venture.id)throw new Error('Lead not found');
  const r:any=lead.requirements || {};
  if(r.payment || r.checkout?.expiresAt>Date.now())throw new Error('This booking has a payment or active checkout. Review it before making changes.');
  if(b.action==='approve') {
   const quote=lead.quotes[0],payablePence=Math.round(Number(b.payable)*100), eventAt=new Date(String(b.eventAt || ''));
   if(!quote || !['Ready','Sent'].includes(quote.status) || !Number.isFinite(payablePence) || payablePence<=0 || payablePence>Math.round(Number(quote.customerPrice)*100))throw new Error('An approved quote and valid payment amount are required');
   if(!b.availabilityConfirmed || !String(b.terms || '').trim() || !String(b.venue || '').trim() || !Number.isFinite(eventAt.getTime()) || eventAt.getTime()<=Date.now())throw new Error('Confirm venue, staffing, event time and booking terms first');
   const bookingApproval={id:randomUUID(),quoteId:quote.id,totalPence:Math.round(Number(quote.customerPrice)*100),payablePence,terms:String(b.terms).slice(0,10000),venue:String(b.venue).slice(0,500),eventAt:eventAt.toISOString(),validUntil:Math.min(Date.now()+7*86400000,eventAt.getTime()),approvedAt:new Date().toISOString()};
   await tx.lead.update({where:{id},data:{stage:'DEPOSIT',requirements:{...r,bookingApproval}}});
   return {ok:true};
  }
  if(b.action==='quote') {
   const price=Number(b.price),cost=Number(b.cost);
   if(!Number.isFinite(price) || price<=0 || !Number.isFinite(cost) || cost<0)throw new Error('Valid price and costs are required');
   await tx.quote.updateMany({where:{leadId:id,status:{in:['Draft','Ready','Sent']}},data:{status:'Superseded'}});
   await tx.quote.create({data:{leadId:id,customerPrice:price,directCosts:cost,grossProfit:price-cost,status:'Ready'}});
   const {bookingApproval,checkout,...requirements}=r;
   await tx.lead.update({where:{id},data:{stage:'QUOTE',estimatedValue:price,requirements}});
   return {ok:true};
  }
  throw new Error('Unsupported action');
 });
 await queueBubbleMessage(id,'quote');
 after(async()=>{await flushBubbleMessages();});
 return NextResponse.json(result);
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Unable to update booking'},{status:409});}
}
