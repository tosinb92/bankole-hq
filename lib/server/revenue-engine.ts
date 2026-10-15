import { prisma } from '@/lib/server/prisma';
import {z} from 'zod';
import {randomUUID} from 'node:crypto';
import { Prisma } from '@prisma/client';
import { canonicalUrl,scoreSignal,signalSchema,progressSchema } from '@/lib/revenue';
export async function revenueState(){
 const [ventures,leads,actions,completed]=await Promise.all([prisma.venture.findMany({select:{id:true,name:true}}),prisma.lead.findMany({include:{venture:{select:{name:true}},tasks:{where:{status:{not:'DONE'}}}},orderBy:{updatedAt:'desc'}}),prisma.task.findMany({where:{title:{startsWith:'Revenue:'},status:{not:'DONE'}},include:{venture:{select:{name:true}}},orderBy:[{priority:'asc'},{dueAt:'asc'}]}),prisma.task.findMany({where:{title:{startsWith:'Revenue:'},status:'DONE'},include:{venture:{select:{name:true}}},orderBy:{createdAt:'desc'},take:30})]);
 const records=leads.map(l=>{const req=(l.requirements&&typeof l.requirements==='object'&&!Array.isArray(l.requirements)?l.requirements:{}) as Record<string,any>;const engine=req.revenueEngine;return {...l,estimatedValue:l.estimatedValue?.toString()??null,engine:engine?{...engine,...(engine.signal?scoreSignal(engine.signal):{})}:null};});
 return {generatedAt:new Date().toISOString(),ventures,records,actions,completed,capabilities:{discovery:'Existing external sweeps; direct ingestion available',sending:'Use originating business Email Centre; HQ drafts are unsent',receipts:'Payment reconciliation not connected; won status is not proof of cash',access:'HQ owner token required'}};
}
export async function ingestSignal(input:unknown){
 const signal=signalSchema.parse(input);const sourceUrl=canonicalUrl(signal.sourceUrl);
 return prisma.$transaction(async tx=>{
 // Database advisory lock serialises repeated notices without a parallel CRM or migration.
 await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${signal.ventureName+sourceUrl}))`;
 const venture=await tx.venture.findUnique({where:{name:signal.ventureName}});if(!venture)throw Error('Business must already exist in HQ; select its exact name');
 const existing=await tx.lead.findFirst({where:{ventureId:venture.id,requirements:{path:['revenueEngine','sourceUrl'],equals:sourceUrl}}});
 const req=(existing?.requirements??{}) as Record<string,any>;
 const prior=req.revenueEngine??{};
 const engine={...prior,signal,sourceUrl,...scoreSignal(signal),nextAction:prior.nextAction??signal.nextAction,lastVerifiedAt:new Date().toISOString(),status:prior.status??'NEW'};
 const data={requirements:{...req,revenueEngine:engine} as Prisma.InputJsonValue};
 if(existing)return {deduplicated:true,lead:await tx.lead.update({where:{id:existing.id},data})};
 const lead=await tx.lead.create({data:{...data,ventureId:venture.id,customerName:signal.customerName,email:signal.contactEmail,estimatedValue:signal.estimatedValue}});
 return {deduplicated:false,lead};
 });
}
export async function progressRevenue(input:unknown){
 const b=progressSchema.parse(input);
 return prisma.$transaction(async tx=>{
 const lead=await tx.lead.findUniqueOrThrow({where:{id:b.id}});
 const req=(lead.requirements??{}) as Record<string,any>;const prior=req.revenueEngine??{};
 if(lead.updatedAt.toISOString()!==b.expectedUpdatedAt)throw Error('Record changed; refresh before saving');
 if(b.stage==='WON'&&!b.outcomeEvidence)throw Error('Evidence of acceptance required. Record cash separately in the business payment system.');
 if(b.stage==='FOLLOW_UP'&&!b.followUpAt)throw Error('Choose a follow-up date');
 if(prior.suppressed&&b.stage==='FOLLOW_UP')throw Error('Suppressed contact cannot be followed up');
 const {id,expectedUpdatedAt,stage,...changes}=b;
 const engine={...prior,...changes,history:[...(prior.history??[]).slice(-99),{at:new Date().toISOString(),stage:stage??lead.stage,nextAction:b.nextAction}]};
 const saved=await tx.lead.updateMany({where:{id,updatedAt:lead.updatedAt},data:{...(stage?{stage}:{}),requirements:{...req,revenueEngine:engine} as Prisma.InputJsonValue}});
 if(saved.count!==1)throw Error('Record changed; refresh before saving');
 if(b.followUpAt&&!b.suppressed){const title=`Revenue follow-up: ${lead.customerName}`;const existing=await tx.task.findFirst({where:{leadId:id,title,status:{not:'DONE'}}});const task={dueAt:new Date(b.followUpAt)};if(existing)await tx.task.update({where:{id:existing.id},data:task});else await tx.task.create({data:{...task,title,leadId:id,ventureId:lead.ventureId,priority:2}});}
 if(b.suppressed)await tx.task.updateMany({where:{leadId:id,title:{startsWith:'Revenue follow-up:'},status:{not:'DONE'}},data:{status:'BLOCKED'}});
 return tx.lead.findUniqueOrThrow({where:{id}});
 });
}

const taskOutcomeSchema=z.object({kind:z.literal('taskOutcome'),id:z.string().min(1),expectedStatus:z.enum(['TODO','IN_PROGRESS','BLOCKED']),outcome:z.enum(['done','waiting','skip']),note:z.string().trim().min(5,'Add a short outcome so the next step is clear.').max(2000),nextAction:z.string().trim().min(5).max(2000).optional(),dueAt:z.string().datetime()});
export async function progressRevenueTask(input:unknown){
 const b=taskOutcomeSchema.parse(input);
 return prisma.$transaction(async tx=>{
  const task=await tx.task.findUnique({where:{id:b.id}});
  if(!task||!task.title.startsWith('Revenue:'))throw Error('Task not found. Refresh your actions.');
  if(task.status!==b.expectedStatus)throw Error('Task changed. Refresh your actions.');
  const status=b.outcome==='waiting'?'BLOCKED':'DONE';
  const result=await tx.task.updateMany({where:{id:task.id,status:b.expectedStatus},data:{status,dueAt:b.outcome==='waiting'?new Date(b.dueAt):task.dueAt}});
  if(result.count!==1)throw Error('Task changed. Refresh your actions.');
  let nextId:string|null=null;
  if(b.outcome==='done'&&b.nextAction){const title=`Revenue: ${b.nextAction}`;const next=await tx.task.findFirst({where:{ventureId:task.ventureId,title,status:{not:'DONE'}}});nextId=next?.id??(await tx.task.create({data:{title,ventureId:task.ventureId,leadId:task.leadId,dueAt:new Date(b.dueAt),priority:task.priority}})).id;}
  const id=randomUUID();const payload=JSON.stringify({taskId:task.id,outcome:b.outcome,note:b.note,nextTaskId:nextId});
  await tx.$executeRaw`INSERT INTO "ActivityEvent" ("id","source","sourceRef","eventType","title","detail","payload","importance","occurredAt") VALUES (${id},'revenue-engine',${task.id},'REVENUE_TASK_OUTCOME',${task.title},${b.note},${payload}::jsonb,70,NOW())`;
  return {saved:true,status,nextTaskId:nextId};
 });
}
