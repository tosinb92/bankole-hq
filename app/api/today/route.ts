import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
export const runtime = "nodejs";
export async function GET() {
 if (!process.env.DATABASE_URL) return NextResponse.json({error:"HQ data connection is unavailable."},{status:503});
 const now=new Date();
 const [ventures,tasks,leads,deals,opportunities,approvals]=await Promise.all([
  prisma.venture.findMany({select:{id:true,name:true}}),
  prisma.task.findMany({where:{status:{not:"DONE"}},orderBy:{createdAt:"desc"},take:12,include:{venture:{select:{name:true}}}}),
  prisma.lead.findMany({orderBy:{updatedAt:"desc"},take:20,include:{venture:{select:{name:true}}}}),
  prisma.deal.findMany({orderBy:{updatedAt:"desc"},take:20,include:{venture:{select:{name:true}}}}),
  prisma.intelligenceOpportunity.findMany({where:{status:{not:"ARCHIVED"}},orderBy:{updatedAt:"desc"},take:12,include:{venture:{select:{name:true}}}}),
  prisma.skillExecution.findMany({where:{status:"NEEDS_APPROVAL"},orderBy:{completedAt:"desc"},take:12,include:{venture:{select:{name:true}},skill:{select:{name:true}}}})
 ]);
 const queue:any[]=[];
 tasks.forEach(t=>queue.push({id:"task-"+t.id,business:t.venture?.name??"HQ",type:"TASK",title:t.title,detail:"Open task",priority:75,action:"business"}));
 approvals.forEach(x=>queue.push({id:"approval-"+x.id,business:x.venture?.name??"HQ",type:"APPROVAL",title:"Review "+x.skill.name+" output",detail:"Work is waiting for your approval.",priority:95,action:"business"}));
 opportunities.forEach(o=>queue.push({id:"opp-"+o.id,business:o.venture?.name??"HQ",type:"OPPORTUNITY",title:o.title,detail:o.summary??"Opportunity captured in Intelligence.",priority:85,action:"intelligence"}));
 deals.filter(x=>!["CLOSED","LOST"].includes(x.stage)).forEach(d=>queue.push({id:"deal-"+d.id,business:d.venture?.name??"HQ",type:"DEAL",title:d.name,detail:"Deal stage: "+d.stage,priority:80,action:"business"}));
 const activeLeads=leads.filter(x=>!["WON","LOST"].includes(x.status));
 if(activeLeads.length) queue.push({id:"leads",business:"HQ",type:"LEADS",title:activeLeads.length+" recent leads need progression",detail:"Review recent leads and next actions.",priority:70,action:"business"});
 queue.sort((a,b)=>b.priority-a.priority);
 return NextResponse.json({generatedAt:now.toISOString(),metrics:{ventures:ventures.length,openTasks:tasks.length,activeLeads:activeLeads.length,activeDeals:deals.filter(x=>!["CLOSED","LOST"].includes(x.stage)).length,opportunities:opportunities.length,approvals:approvals.length},queue:queue.slice(0,12)});
}