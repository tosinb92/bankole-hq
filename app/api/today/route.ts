import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { recentHqEvents, syncStatuses } from "@/lib/server/hq-live";
export const runtime = "nodejs";

export async function GET() {
 if (!process.env.DATABASE_URL) return NextResponse.json({error:"HQ data connection is unavailable."},{status:503});
 const [ventures,tasks,leads,deals,opportunities,approvals,revenue]=await Promise.all([
  prisma.venture.findMany({select:{id:true,name:true}}),
  prisma.task.findMany({where:{status:{not:"DONE"}},orderBy:{createdAt:"desc"},take:20,include:{venture:{select:{name:true}}}}),
  prisma.lead.findMany({orderBy:{updatedAt:"desc"},take:50,include:{venture:{select:{name:true}}}}),
  prisma.deal.findMany({orderBy:{createdAt:"desc"},take:50,include:{venture:{select:{name:true}}}}),
  prisma.intelligenceOpportunity.findMany({where:{status:{not:"ARCHIVED"}},orderBy:{createdAt:"desc"},take:20,include:{venture:{select:{name:true}}}}),
  prisma.skillExecution.findMany({where:{status:"NEEDS_APPROVAL"},orderBy:{createdAt:"desc"},take:20,include:{venture:{select:{name:true}},skill:{select:{name:true}}}}),
  prisma.revenueEntry.findMany({orderBy:{occurredAt:"desc"},take:100,include:{venture:{select:{name:true}}}})
 ]);
 const liveEvents=await recentHqEvents(40).catch(()=>[]);
 const sync=await syncStatuses().catch(()=>[]);
 const queue:any[]=[];
 liveEvents.forEach((e:any)=>queue.push({id:"event-"+e.id,business:e.ventureName??"HQ",type:e.eventType,title:e.title,detail:e.detail??"Live activity",priority:e.importance??60,action:"business",source:e.source}));
 tasks.forEach(t=>queue.push({id:"task-"+t.id,business:t.venture?.name??"HQ",type:"TASK",title:t.title,detail:"Open task",priority:75,action:"business",source:"HQ database"}));
 approvals.forEach(x=>queue.push({id:"approval-"+x.id,business:x.venture?.name??"HQ",type:"APPROVAL",title:"Review "+x.skill.name+" output",detail:"Work is waiting for your approval.",priority:95,action:"business",source:"HQ database"}));
 opportunities.forEach(o=>queue.push({id:"opp-"+o.id,business:o.venture?.name??"HQ",type:"OPPORTUNITY",title:o.title,detail:o.brief.slice(0,180)||"Opportunity captured in Intelligence.",priority:85,action:"intelligence",source:"HQ database"}));
 const activeDeals=deals.filter(x=>!["CLOSED","LOST"].includes(x.stage.toUpperCase()));
 activeDeals.forEach(d=>queue.push({id:"deal-"+d.id,business:d.venture?.name??"HQ",type:"DEAL",title:d.title,detail:`Deal stage: ${d.stage}${d.value? ` · value ${d.value.toString()}`:""}`,priority:82,action:"business",source:"HQ database"}));
 const activeLeads=leads.filter(x=>!["WON","LOST"].includes(String(x.stage)));
 activeLeads.slice(0,12).forEach(l=>queue.push({id:"lead-"+l.id,business:l.venture?.name??"HQ",type:"LEAD",title:l.customerName,detail:`${l.stage}${l.estimatedValue?` · est. £${l.estimatedValue.toString()}`:""}${l.requestedLocation?` · ${l.requestedLocation}`:""}`,priority:78,action:"business",source:"HQ database"}));
 queue.sort((a,b)=>b.priority-a.priority);
 const leadValue=activeLeads.reduce((sum,l)=>sum+Number(l.estimatedValue??0),0);
 // Deal and revenue records currently have no currency field. Do not aggregate them into a misleading GBP total.
 const pipelineValue:null=null;
 const recordedRevenue:null=null;
 return NextResponse.json({generatedAt:new Date().toISOString(),dataPolicy:"Live HQ database records and authorised integration events only; no hard-coded operator context or demo records.",metrics:{ventures:ventures.length,openTasks:tasks.length,activeLeads:activeLeads.length,activeDeals:activeDeals.length,opportunities:opportunities.length,approvals:approvals.length,pipelineValue,leadValue,recordedRevenue,currencyNotice:"Deal/revenue totals are hidden until currency is recorded per entry. Lead estimates are GBP for the current Bubble Leisure workflow."},queue:queue.slice(0,24),integrations:Object.fromEntries(sync.map((x:any)=>[x.label,`${x.status}${x.lastSuccessAt?` · ${new Date(x.lastSuccessAt).toISOString()}`:""}`]))});
}
