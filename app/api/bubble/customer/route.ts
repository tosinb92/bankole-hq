import { NextResponse,after } from 'next/server';
import { prisma } from '@/lib/server/prisma';
import { bookingLead,bubbleService } from '@/lib/server/bubble-security';
import { bubbleCheckout } from '@/lib/server/bubble-payments';
import {progressBubbleLead,flushBubbleMessages} from '@/lib/server/bubble-workflow';
export const runtime='nodejs';
export async function POST(request:Request) {
  if(!bubbleService(request)) return NextResponse.json({error:'Unauthorized'},{status:401});
  const b=await request.json().catch(()=>({})), id=bookingLead(b.token);
  if(!id) return NextResponse.json({error:'Your booking link has expired or is invalid. Please contact us.'},{status:401});
  const lead=await prisma.lead.findUnique({where:{id},include:{venture:true,quotes:{orderBy:{createdAt:'desc'},take:1}}});
  if(!lead || lead.venture.name!=='Bubble Leisure') return NextResponse.json({error:'Booking not found'},{status:404});
  if(b.action==='details') {
    const d=b.details || {}, guests=Number(d.guests),duration=Number(d.duration);
    if(!['Bubble Football','Dodgeball','Nerf Wars','Axe Throwing','Archery','Help me choose'].includes(d.activity) || !Number.isInteger(guests) || guests<1 || guests>500 || ![60,90,120].includes(duration) || !String(d.location || '').trim() || !/^\d{4}-\d{2}-\d{2}$/.test(d.date || '') || !/^\d{2}:\d{2}$/.test(d.time || ''))return NextResponse.json({error:'Please check your event details'},{status:400});
    try {
      await prisma.$transaction(async tx=>{
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`;
        const current=await tx.lead.findUniqueOrThrow({where:{id}}),r:any=current.requirements || {};
        if(r.payment || r.bookingApproval || r.checkout)throw new Error('Contact us to change an approved booking');
        await tx.quote.updateMany({where:{leadId:id,status:{in:['Draft','Ready','Sent']}},data:{status:'Superseded'}});
        await tx.lead.update({where:{id},data:{stage:'NEW_LEAD',requestedLocation:String(d.location).slice(0,500),requirements:{...r,activity:d.activity,guests,duration,date:d.date,time:d.time}}});
      });
      await progressBubbleLead(id);
      after(async()=>{await flushBubbleMessages();});
      return NextResponse.json({ok:true});
    }catch{return NextResponse.json({error:'Unable to update details. Contact us for help.'},{status:409});}
  }
  if(b.action==='checkout') {
    if(b.acceptTerms!==true) return NextResponse.json({error:'Please accept the booking terms'},{status:400});
    try {return NextResponse.json(await bubbleCheckout(id));}
    catch(error){return NextResponse.json({error:error instanceof Error ? error.message : 'Payment unavailable'},{status:409});}
  }
  const r:any=lead.requirements || {}, a=r.bookingApproval,q=lead.quotes[0];
  return NextResponse.json({reference:lead.id,name:lead.customerName,activity:r.activity,occasion:r.occasion,date:r.date || r.eventDateTime,time:r.time,duration:r.duration,guests:r.guests || r.players,location:lead.requestedLocation,stage:lead.stage,quote:q && ['Ready','Sent','Accepted','Paid'].includes(q.status)?{total:Number(q.customerPrice)}:null,approval:a?{payable:a.payablePence/100,total:a.totalPence/100,terms:a.terms,eventAt:a.eventAt,venue:a.venue}:null,payment:r.payment?{paid:r.payment.paidPence/100,balance:(a.totalPence-r.payment.paidPence)/100}:null,canPay:Boolean(a && !r.payment && q?.id===a.quoteId && a.validUntil>Date.now() && process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET)},{headers:{'Cache-Control':'no-store'}});
}
