import {NextRequest,NextResponse} from 'next/server';
import {revenueAuthorised,sameOrigin,rememberRevenue,forgetRevenue} from '@/lib/server/revenue-auth';

import {revenueState,ingestSignal,progressRevenue,progressRevenueTask} from '@/lib/server/revenue-engine';
export const runtime='nodejs';
export const dynamic='force-dynamic';
async function handle(r:NextRequest,fn:()=>Promise<unknown>){if(!revenueAuthorised(r))return NextResponse.json({error:'Enter your private key to open your sales actions.'},{status:401});if(r.method!=='GET'&&!sameOrigin(r))return NextResponse.json({error:'Please reopen this page and try again.'},{status:403});try{return rememberRevenue(r,NextResponse.json(await fn(),{headers:{'Cache-Control':'no-store'}}))}catch(e){console.error('Revenue operation failed',e instanceof Error?e.name:'Unknown');return NextResponse.json({error:e instanceof Error&&(/Business must|Record changed|Evidence of|Choose a|Suppressed|Task changed|Add a|Task not/.test(e.message))?e.message:'Could not save or load. Check connection and required fields.'},{status:400});}}
export async function GET(r:NextRequest){return handle(r,revenueState)}
export async function POST(r:NextRequest){return handle(r,async()=>ingestSignal(await r.json()))}
export async function PATCH(r:NextRequest){return handle(r,async()=>{const body=await r.json();return body.kind==='taskOutcome'?progressRevenueTask(body):progressRevenue(body);})}
export async function DELETE(r:NextRequest){if(!revenueAuthorised(r)||!sameOrigin(r))return NextResponse.json({error:'Unauthorized'},{status:401});return forgetRevenue(NextResponse.json({ok:true}));}
