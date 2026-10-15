import {NextRequest,NextResponse} from 'next/server';
import {prisma} from '@/lib/server/prisma';
import {z} from 'zod';
import {revenueState,ingestSignal,progressRevenue} from '@/lib/server/revenue-engine';
export const runtime='nodejs';
export const dynamic='force-dynamic';
function authorised(r:NextRequest){return [process.env.HQ_MCP_TOKEN,process.env.REVENUE_ACCESS_KEY].some(token=>!!token&&r.headers.get('authorization')===`Bearer ${token}`);}
async function handle(r:NextRequest,fn:()=>Promise<unknown>){if(!authorised(r))return NextResponse.json({error:'Use your HQ owner access key to unlock private sales records.'},{status:401});try{return NextResponse.json(await fn(),{headers:{'Cache-Control':'no-store'}})}catch(e){console.error('Revenue operation failed',e instanceof Error?e.name:'Unknown');return NextResponse.json({error:e instanceof Error&&(/Business must|Record changed|Evidence of|Choose a|Suppressed/.test(e.message))?e.message:'Could not save or load. Check connection and required fields.'},{status:400});}}
export async function GET(r:NextRequest){return handle(r,revenueState)}
export async function POST(r:NextRequest){return handle(r,async()=>ingestSignal(await r.json()))}
export async function PATCH(r:NextRequest){return handle(r,async()=>{const body=await r.json();if(body.kind==='completeTask'){const task=z.object({id:z.string().min(1)}).parse(body);return prisma.task.updateMany({where:{id:task.id,title:{startsWith:'Revenue:'}},data:{status:'DONE'}});}return progressRevenue(body);})}
