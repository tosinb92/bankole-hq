import {NextResponse} from 'next/server';
import {prisma} from '@/lib/server/prisma';
import {equalSecret} from '@/lib/server/bubble-security';
import {flushBubbleMessages,progressBubbleLead,queueBubbleMessage} from '@/lib/server/bubble-workflow';
export const runtime='nodejs';
export async function GET(request:Request) {
 if(!equalSecret(request.headers.get('authorization'),process.env.CRON_SECRET?`Bearer ${process.env.CRON_SECRET}`:undefined))return NextResponse.json({error:'Unauthorized'},{status:401});
 const pending=await prisma.lead.findMany({where:{venture:{name:'Bubble Leisure'},requirements:{path:['workflowVersion'],equals:'customer-flow-v1'},stage:'NEW_LEAD'},take:20});
 for(const lead of pending)await progressBubbleLead(lead.id);
 const bookings=await prisma.booking.findMany({where:{id:{startsWith:'bubble-booking-'},status:'CONFIRMED',eventAt:{gte:new Date(),lte:new Date(Date.now()+48*3600000)}},take:100});
 for(const booking of bookings)await queueBubbleMessage(booking.id.slice('bubble-booking-'.length),'reminder');
 return NextResponse.json({processed:pending.length,...await flushBubbleMessages()});
}
