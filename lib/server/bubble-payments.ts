import Stripe from 'stripe';
import { prisma } from './prisma';
import { queueBubbleMessage } from './bubble-workflow';
export function stripeClient() {
  if(!process.env.STRIPE_SECRET_KEY) throw new Error('Payments are not configured');
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}
export async function bubbleCheckout(leadId: string) {
  if(!process.env.STRIPE_WEBHOOK_SECRET) throw new Error("Payment reconciliation is not configured");
  const stripe=stripeClient();
  return prisma.$transaction(async tx=>{
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${leadId}))`;
    const lead=await tx.lead.findUnique({where:{id:leadId},include:{quotes:{orderBy:{createdAt:'desc'},take:1}}});
    const r:any=lead?.requirements || {}, approval=r.bookingApproval, quote=lead?.quotes[0];
    if(!lead || lead.stage==='LOST' || r.payment || !approval || !quote || approval.quoteId!==quote.id || approval.totalPence!==Math.round(Number(quote.customerPrice)*100) || approval.validUntil<Date.now() || new Date(approval.eventAt).getTime()<=Date.now()) throw new Error('Booking is not ready for payment');
    if(!Number.isInteger(approval.payablePence) || approval.payablePence<=0 || approval.payablePence>approval.totalPence || !approval.terms) throw new Error('Payment details need review');
    if(r.checkout && r.checkout.expiresAt>Date.now()) {
      const session=await stripe.checkout.sessions.retrieve(r.checkout.id);
      if(session.status==='open' && session.url) return {url:session.url};
      throw new Error('Payment is being reconciled. Please check your booking shortly.');
    }
    const attempt=Math.floor(Date.now()/3600000);
    // Hour bucket fixes both expiry and request parameters across timeouts/retries.
    const expiresAt=(attempt+2)*3600;
    const session=await stripe.checkout.sessions.create({mode:'payment',client_reference_id:lead.id,customer_email:lead.email || undefined,success_url:'https://bubble-leisure.vercel.app/booking?payment=processing',cancel_url:'https://bubble-leisure.vercel.app/booking?payment=cancelled',expires_at:expiresAt,metadata:{bubbleLeadId:lead.id,approvalId:approval.id,quoteId:quote.id},line_items:[{quantity:1,price_data:{currency:'gbp',unit_amount:approval.payablePence,product_data:{name:`Bubble Leisure — ${String(r.activity || 'event')}`,description:`Payment towards total £${(approval.totalPence/100).toFixed(2)}`}}}],custom_text:{submit:{message:'Your booking is confirmed after payment is verified.'}}},{idempotencyKey:`bubble-checkout-${approval.id}-${attempt}`});
    await tx.lead.update({where:{id:lead.id},data:{requirements:{...r,termsAcceptance:{approvalId:approval.id,acceptedAt:new Date().toISOString()},checkout:{id:session.id,expiresAt:expiresAt*1000}}}});
    return {url:session.url};
  },{timeout:25000});
}
export async function reconcileBubblePayment(session: Stripe.Checkout.Session) {
  if(session.payment_status!=='paid' || session.currency!=='gbp') return;
  const leadId=session.metadata?.bubbleLeadId;
  if(!leadId) return;
  const confirmed=await prisma.$transaction(async tx=>{
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${leadId}))`;
    const lead=await tx.lead.findUnique({where:{id:leadId},include:{venture:true}});
    if(!lead || lead.venture.name!=='Bubble Leisure') return false;
    const r:any=lead.requirements || {}, a=r.bookingApproval;
    if(r.payment?.sessionId===session.id) return true;
    if(r.payment || !a || a.id!==session.metadata?.approvalId || a.quoteId!==session.metadata?.quoteId || session.amount_total!==a.payablePence || r.checkout?.id!==session.id) throw new Error('Payment needs manual reconciliation');
    const payment={sessionId:session.id,paidPence:session.amount_total,paidAt:new Date().toISOString()};
    await tx.lead.update({where:{id:lead.id},data:{stage:'CONFIRMED',requirements:{...r,payment}}});
    await tx.quote.update({where:{id:a.quoteId},data:{status:'Paid'}});
    await tx.booking.upsert({where:{id:`bubble-booking-${lead.id}`},update:{},create:{id:`bubble-booking-${lead.id}`,ventureId:lead.ventureId,venueId:lead.venueId,status:'CONFIRMED',eventAt:new Date(a.eventAt),depositAmount:session.amount_total!/100}});
    return true;
  });
  if(confirmed) await queueBubbleMessage(leadId,'confirmed');
}
