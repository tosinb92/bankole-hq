import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
const moduleCode=stripTypeScriptTypes(readFileSync(new URL('../app/api/integrations/bubble-whatsapp/conversation.ts',import.meta.url),'utf8'));
const conversationURL='data:text/javascript;base64,'+Buffer.from(moduleCode).toString('base64');
let lead={id:'lead1',customerName:'Controlled test',requirements:{transcript:[]}}; let communications=[]; let tasks=[];
const tx={
 $executeRaw:async()=>{},venture:{findUnique:async()=>({id:'bubble'})},
 lead:{findFirst:async()=>lead,findUnique:async()=>lead,create:async({data})=>(lead={id:'lead1',...data}),update:async({data})=>(lead={...lead,...data})},
 communication:{findFirst:async({where})=>communications.find(c=>c.providerMessageId===where.providerMessageId),create:async({data})=>{const c={id:'c'+communications.length,...data};communications.push(c);return c;},update:async({where,data})=>Object.assign(communications.find(c=>c.id===where.id),data)},
 task:{findFirst:async()=>tasks[0],create:async({data})=>{tasks.push(data);return data;}}
};
globalThis.__testPrisma={$transaction:async(fn)=>fn(tx)};
process.env.BUBBLE_WHATSAPP_HQ_SECRET='controlled-test-secret';
let code=readFileSync(new URL('../app/api/integrations/bubble-whatsapp/route.ts',import.meta.url),'utf8')
 .replace("import { NextResponse } from 'next/server';","const NextResponse={json:(v,opts)=>Response.json(v,opts)};")
 .replace("import { prisma } from '@/lib/server/prisma';","const prisma=globalThis.__testPrisma;")
 .replace("from './conversation'","from '"+conversationURL+"'");
const route=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(code)).toString('base64'));
function request(body,method='POST',secret='controlled-test-secret'){return new Request('https://controlled.invalid',{method,headers:{'content-type':'application/json','x-bubble-whatsapp-secret':secret},body:JSON.stringify(body)});}
const base={from:'whatsapp:+447700900001',to:'whatsapp:+447700900002',name:'Controlled test',mediaCount:0};
const sid1='SM'+'1'.repeat(32),sid2='SM'+'2'.repeat(32),sid3='SM'+'3'.repeat(32);
test('route saves once, preserves continuity and suppresses old retries',async()=>{
 const timestamp=Date.now()/1000-30;
 let res=await route.POST(request({...base,sid:sid1,timestamp,body:'Bubble football for 15 children, 90 minutes, in Ipswich. I need a venue'}));
 let result=await res.json(); assert.equal(res.status,200);assert.match(result.reply,/£350/);assert.equal(communications.length,1);
 await route.POST(request({...base,sid:sid1,timestamp,body:'Bubble football for 15 children, 90 minutes, in Ipswich. I need a venue'}));assert.equal(communications.length,1);
 res=await route.POST(request({...base,sid:sid2,timestamp:timestamp+1,body:'25 October '+(new Date().getUTCFullYear()+1)+' at 11am, ages 10-13'}));result=await res.json();assert.match(result.reply,/£70/);assert.equal(lead.requirements.enquiry.activity,'bubble football');assert.equal(tasks.length,1);
 result=await (await route.POST(request({...base,sid:sid1,timestamp,body:'old retry'}))).json();assert.equal(result.skipReply,true);assert.equal(communications.length,2);
 result=await (await route.PATCH(request({sid:sid1,action:'claim'},'PATCH'))).json();assert.equal(result.delivery,'superseded');assert.equal(result.claimed,false);
 result=await (await route.POST(request({...base,sid:sid3,timestamp:timestamp-1,body:'Nerf for 12 children'}))).json();assert.equal(result.skipReply,true);assert.equal(lead.requirements.enquiry.activity,'bubble football');
 const claim=await (await route.PATCH(request({sid:sid2,action:'claim'},'PATCH'))).json();assert.equal(claim.claimed,true);
 const duplicateClaim=await (await route.PATCH(request({sid:sid2,action:'claim'},'PATCH'))).json();assert.equal(duplicateClaim.claimed,false);
 assert.equal((await route.POST(request({...base,sid:sid3,body:'x'},'POST','wrong'))).status,401);
});

test('durable event details survive transcript truncation and a new invocation',async()=>{
 lead.requirements={enquiry:{activity:'bubble football',participants:15,duration:90,location:'Ipswich',date:'2027-10-25',time:'11:00',ages:'10-13',venue:'needed',audience:'children'},transcript:Array.from({length:50},()=>({incoming:'thank you',reply:'Your details are saved'}))};
 const res=await route.POST(request({...base,sid:'SM'+'4'.repeat(32),body:'How much was that again?'}));
 const body=await res.json();
 assert.equal(res.status,200);assert.match(body.reply,/£350/);
 assert.equal(lead.requirements.enquiry.participants,15);
 assert.equal(lead.requirements.transcript.length,50);
 assert.equal(lead.requirements.activityQuote.amount,350);
 const reference=lead.requirements.activityQuote.reference;
 await route.POST(request({...base,sid:'SM'+'5'.repeat(32),body:'How much?'}));
 assert.equal(lead.requirements.activityQuote.reference,reference);
});

