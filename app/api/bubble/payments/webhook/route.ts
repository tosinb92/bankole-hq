import {NextResponse,after} from 'next/server';
import {stripeClient,reconcileBubblePayment} from '@/lib/server/bubble-payments';
import {flushBubbleMessages} from '@/lib/server/bubble-workflow';
export const runtime='nodejs';
export async function POST(request:Request) {
  const secret=process.env.STRIPE_WEBHOOK_SECRET;
  if(!secret || !process.env.STRIPE_SECRET_KEY) return NextResponse.json({error:'Payments are not configured'},{status:503});
  let event;
  try {event=stripeClient().webhooks.constructEvent(await request.text(),request.headers.get('stripe-signature') || '',secret);} catch {return NextResponse.json({error:'Invalid signature'},{status:400});}
  try {
    if(event.type==='checkout.session.completed' || event.type==='checkout.session.async_payment_succeeded') await reconcileBubblePayment(event.data.object);
    after(async()=>{await flushBubbleMessages();});
    return NextResponse.json({received:true});
  } catch {return NextResponse.json({error:'Reconciliation pending'},{status:503});}
}
