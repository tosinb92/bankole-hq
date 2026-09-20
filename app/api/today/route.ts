import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
export const runtime = "nodejs";

const operatorContext=[
 {id:"ctx-bubble-launch",business:"Bubble Leisure",type:"REVENUE",title:"Launch-ready Facebook acquisition funnel",detail:"Priority: turn paid traffic into enquiries → quotes → bookings → revenue. Landing page, lead follow-up and booking conversion are the immediate operating focus.",priority:100,action:"business",source:"Current operating context"},
 {id:"ctx-baa-1159",business:"Brilliant AI Automation",type:"PROSPECT",title:"1159 Realty automation opportunity",detail:"Personalised customer-journey automation outreach is drafted. Next commercial step: approve/send and progress the conversation.",priority:96,action:"business",source:"Gmail + current operating context"},
 {id:"ctx-fire-pipeline",business:"FireComplianceUK",type:"OPPORTUNITY",title:"Build live fire-compliance opportunity pipeline",detail:"Use procurement intelligence plus the supplier network/ABBE inspectors to identify buyers, match fulfilment and prepare outreach/bids.",priority:94,action:"intelligence",source:"Current operating context"},
 {id:"ctx-ba-blackhorse",business:"Bankole & Associates",type:"DEAL",title:"Blackhorse Logistics financing",detail:"Existing financing transaction through TANGL/Mulberry. Keep diligence and counterparty milestones visible; existing deals are not the outbound prospecting target.",priority:90,action:"business",source:"Current deal context"},
 {id:"ctx-ba-seventh",business:"Bankole & Associates",type:"DEAL",title:"Seventh Spring vessel mandate",detail:"Existing $2.5m funding mandate. Track requirements, documents, investor/lender progress and next counterparty commitment.",priority:89,action:"business",source:"Current deal context"},
 {id:"ctx-ba-torxen",business:"Bankole & Associates",type:"DEAL",title:"Torxen engagement",detail:"Phase structure: $20k documentary prep, $20k term-sheet prep, $40k on term sheet. Track written acceptance, documents and Phase 1 invoice/payment evidence.",priority:88,action:"business",source:"Current deal context"}
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
 return NextResponse.json({generatedAt:new Date().toISOString(),dataPolicy:"Live HQ database records are combined with explicitly labelled current operator context; no demo records are generated.",metrics:{ventures:ventures.length,openTasks:tasks.length,activeLeads:activeLeads.length,activeDeals:activeDeals.length,opportunities:opportunities.length,approvals:approvals.length,pipelineValue,leadValue,recordedRevenue,currencyNotice:"Deal/revenue totals are hidden until currency is recorded per entry. Lead estimates are GBP for the current Bubble Leisure workflow."},queue:queue.slice(0,24),integrations:{hqDatabase:"LIVE",instagram:"CONNECTED FOR SUPPORTED ACCOUNTS",gmail:"CONNECTED TO CHATGPT; HQ SERVER SYNC NOT YET WIRED",vidiq:"SECRET ADDED; DIRECT HQ MCP SYNC IN PROGRESS",fireOpportunitySources:"RESEARCH WORKFLOW AVAILABLE; CONTINUOUS SYNC NOT YET WIRED"}});
}
