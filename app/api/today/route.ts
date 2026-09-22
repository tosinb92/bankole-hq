import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
export const runtime = "nodejs";

const operatorContext=[
 {id:"ctx-baa-thursday",business:"Brilliant AI Automation",type:"DEADLINE",title:"Thursday BAA presentation",detail:"Fixed deadline: finish the presentation and demo, verify signup/payment, and prepare immediate post-presentation conversion follow-up.",priority:120,action:"business",source:"Current operating context"},
 {id:"ctx-ba-new-client",business:"Bankole & Associates",type:"CLIENT",title:"Onboard new Bankole & Associates client",detail:"Use the real client to test qualification → mandate → onboarding → documents/data room → private admin investor matching → introductions → progress and fees. Surface broken steps immediately.",priority:115,action:"business",source:"Current operating context"},
 {id:"ctx-fire-500",business:"FireComplianceUK",type:"REVENUE",title:"Demand-side outreach toward 500 contacts",detail:"Google Sheet is the prospect queue. Resend history is the send/dedupe source of truth. Track sent, bounced/failed, replied, registered and next-unsent state so outreach can resume safely.",priority:110,action:"business",source:"Current operating context"},
 {id:"ctx-hq-vercel",business:"HQ",type:"BLOCKED",title:"HQ deployment blocked; development continues",detail:"Vercel deployment limits must not stop development. Keep tested changes committed and deployment-ready, with blockers visible.",priority:105,action:"business",source:"Current operating context"},
 {id:"ctx-bubble-launch",business:"Bubble Leisure",type:"REVENUE",title:"Facebook acquisition funnel",detail:"Keep launch work ready without displacing the Thursday BAA deadline, the new B&A client or FireCompliance outreach.",priority:70,action:"business",source:"Current operating context"}
];

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
 const queue:any[]=[...operatorContext];
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
 return NextResponse.json({generatedAt:new Date().toISOString(),dataPolicy:"Live HQ database records are combined with explicitly labelled current operator context; no demo records are generated.",metrics:{ventures:ventures.length,openTasks:tasks.length,activeLeads:activeLeads.length,activeDeals:activeDeals.length,opportunities:opportunities.length,approvals:approvals.length,pipelineValue,leadValue,recordedRevenue,currencyNotice:"Deal/revenue totals are hidden until currency is recorded per entry. Lead estimates are GBP for the current Bubble Leisure workflow."},queue:queue.slice(0,24),integrations:{hqDatabase:"LIVE",resend:"CONNECTED · FIRECOMPLIANCE SEND HISTORY VERIFIED",fireOutreach:"GOOGLE SHEET QUEUE → DEDUPE → RESEND; PERSISTENT HQ SYNC TO WIRE",gmail:"CHATGPT CONNECTED · HQ SERVER SYNC NOT WIRED",vidiq:"LIVE · SEARCH + PERSISTENCE VERIFIED",vercel:"DEPLOYMENT BLOCKED · DEVELOPMENT CONTINUES IN GITHUB"}});
}
