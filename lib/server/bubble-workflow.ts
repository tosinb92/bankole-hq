import { createHash } from 'node:crypto';
import { prisma } from './prisma';
import { bookingLink } from './bubble-security';
import { calculateBubbleQuote } from './bubble-conversion';

export const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));

// Deterministic database IDs and provider idempotency make retrying safe.
export async function queueBubbleMessage(leadId: string, kind: 'received'|'quote'|'confirmed'|'reminder') {
  const lead = await prisma.lead.findUnique({where:{id:leadId},include:{quotes:{orderBy:{createdAt:'desc'},take:1}}});
  if (!lead?.email) return;
  const q = lead.quotes[0]; const r: any = lead.requirements || {};
  const id = `bubble-mail-${createHash('sha256').update(`${leadId}:${kind}:${kind==='quote'?`${q?.id}:${r.bookingApproval?.id || ''}`:''}`).digest('hex').slice(0,40)}`;
  const subject = {received:'Your Bubble Leisure enquiry',quote:'Your Bubble Leisure quote',confirmed:'Your Bubble Leisure booking is confirmed',reminder:'Your Bubble Leisure event reminder'}[kind];
  const text = kind==='received' ? 'We have received your event details. Your date is not reserved yet.' : kind==='quote' ? `Your quote is £${Number(q?.customerPrice).toFixed(2)}. Availability and payment details are shown in your booking page.` : kind==='confirmed' ? 'Your payment has been received and your booking is confirmed. Your booking page contains your event and balance details.' : 'Your event is coming up. Please check your booking page for the confirmed details.';
  await prisma.communication.upsert({where:{id},update:{},create:{id,ventureId:lead.ventureId,subject,status:'APPROVED',body:JSON.stringify({to:lead.email,html:`<p>Hello ${escapeHtml(lead.customerName)},</p><p>${escapeHtml(text)}</p><p>${escapeHtml(r.activity)} · ${escapeHtml(r.date || r.eventDateTime || 'Date to be agreed')} · ${escapeHtml(lead.requestedLocation)}</p><p><a href="${escapeHtml(bookingLink(lead.id))}">View your booking</a></p><p>Bubble Leisure</p>`})}});
}

export async function flushBubbleMessages() {
  const apiKey=process.env.RESEND_API_KEY, from=process.env.BUBBLE_FROM_EMAIL;
  if (!apiKey || !from) return {sent:0,blocked:'Email sender is not configured'};
  const messages=await prisma.communication.findMany({where:{id:{startsWith:'bubble-mail-'},status:{in:['APPROVED','FAILED']}},orderBy:{createdAt:'asc'},take:25});
  let sent=0;
  for (const m of messages) {
    // Provider idempotency lasts 24 hours; older uncertain attempts require review.
    if (m.status==='FAILED' && Date.now()-m.createdAt.getTime()>23*3600000) continue;
    try {
      const payload=JSON.parse(m.body || '{}');
      const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{authorization:`Bearer ${apiKey}`,'content-type':'application/json','idempotency-key':m.id},body:JSON.stringify({from,to:[payload.to],subject:m.subject,html:payload.html}),signal:AbortSignal.timeout(15000)});
      if (!response.ok) throw new Error('Email provider rejected message');
      const result=await response.json();
      await prisma.communication.update({where:{id:m.id},data:{status:'SENT',providerMessageId:String(result.id)}}); sent++;
    } catch { await prisma.communication.update({where:{id:m.id},data:{status:'FAILED'}}); }
  }
  return {sent};
}

export async function progressBubbleLead(leadId: string) {
  const pricing=await calculateBubbleQuote(leadId);
  await queueBubbleMessage(leadId,pricing.ok?'quote':'received');
  if (!pricing.ok) {
    const lead=await prisma.lead.findUnique({where:{id:leadId}});
    if(lead) await prisma.task.upsert({where:{id:`bubble-review-${leadId}`},update:{},create:{id:`bubble-review-${leadId}`,leadId,ventureId:lead.ventureId,title:`Review Bubble Leisure enquiry: ${pricing.reason}`,priority:2}});
  }
  return pricing;
}

export async function intakeBubbleWebsite(payload: Record<string, unknown>) {
  const submissionId=String(payload.submissionId || '');
  if(!/^[a-zA-Z0-9-]{16,80}$/.test(submissionId)) throw new Error('Invalid submission reference');
  const id=`bubble-web-${createHash('sha256').update(submissionId).digest('hex').slice(0,40)}`;
  const venture=await prisma.venture.findUnique({where:{name:'Bubble Leisure'}});
  if(!venture) throw new Error('Bubble Leisure is not configured');
  const lead=await prisma.$transaction(async tx=>{
    if(payload.sourceHash) {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${String(payload.sourceHash)}))`;
      const fromSource=await tx.lead.count({where:{ventureId:venture.id,requirements:{path:['sourceHash'],equals:String(payload.sourceHash)},createdAt:{gte:new Date(Date.now()-3600000)}}});
      if(fromSource>=10 && !await tx.lead.findUnique({where:{id}}))throw new Error('Too many submissions');
    }
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${String(payload.email).toLowerCase()}))`;
    const existing=await tx.lead.findUnique({where:{id}});
    if(existing)return existing;
    const recent=await tx.lead.count({where:{ventureId:venture.id,id:{startsWith:'bubble-web-'},email:{equals:String(payload.email),mode:'insensitive'},createdAt:{gte:new Date(Date.now()-3600000)}}});
    if(recent>=3)throw new Error('Too many submissions; please contact us');
    return tx.lead.create({data:{id,ventureId:venture.id,customerName:String(payload.name),email:String(payload.email),phone:String(payload.phone || '') || null,requestedLocation:String(payload.location),requirements:JSON.parse(JSON.stringify({...payload,source:'Bubble Leisure Website'})),stage:'NEW_LEAD'}});
  });
  // An acknowledged submission always refers to the durable customer record.
  try { await progressBubbleLead(lead.id); } catch { /* Cron retries pending leads. */ }
  return {leadId:lead.id,bookingUrl:bookingLink(lead.id)};
}
