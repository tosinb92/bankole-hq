import {NextResponse} from "next/server";
import {prisma} from "@/lib/server/prisma";
export const runtime="nodejs";
type Body={venture?:string;command?:string};
const lower=(s:string)=>s.toLowerCase();
export async function POST(req:Request){
 if(!process.env.DATABASE_URL)return NextResponse.json({error:"HQ database is not configured."},{status:503});
 const b=await req.json().catch(()=>({})) as Body; const command=b.command?.trim(); if(!command)return NextResponse.json({error:"Tell HQ what you want done."},{status:400});
 const ventureName=b.venture?.trim()||"Bubble Leisure"; const venture=await prisma.venture.findUnique({where:{name:ventureName}});
 if(!venture)return NextResponse.json({error:`${ventureName} is not connected to the HQ database yet.`},{status:404});
 const q=lower(command);
 const recordCommand=async(summary:string,outcome:string)=>prisma.action.create({data:{ventureId:venture.id,title:`HQ: ${command.slice(0,120)}`,kind:"RUN_SKILL",lane:"AI_CAN_HANDLE",urgency:3,recommendation:summary,executionState:"Completed",outcome}}).catch(()=>null);
 if(/lead|enquir|booking|quote|customer/.test(q)){
   const leads=await prisma.lead.findMany({where:{ventureId:venture.id,stage:{notIn:["WON","LOST"]}},orderBy:{updatedAt:"desc"},take:12,include:{quotes:{orderBy:{createdAt:"desc"},take:1}}});
   await recordCommand(`Reviewed active leads for ${ventureName}.`,`${leads.length} active lead(s) returned.`);
   return NextResponse.json({mode:"data",title:`${leads.length} active lead${leads.length===1?"":"s"}`,summary:leads.length?"These are live HQ records. Open the full operations workspace for detailed lead actions.":"No active leads are currently recorded in HQ.",items:leads.map(x=>({id:x.id,title:x.customerName,meta:[x.stage.replaceAll("_"," "),x.requestedLocation,x.estimatedValue?`£${Number(x.estimatedValue).toFixed(0)} est.`:null].filter(Boolean).join(" · ")})),action:{label:"Open lead operations",target:"Bubble Operations"}});
 }
 if(/deal|mandate|torxen|blackhorse|seventh|diligence|capital|fund|investor|lender/.test(q)){
   const deals=await prisma.deal.findMany({where:{ventureId:venture.id},orderBy:{createdAt:"desc"},take:12,include:{commitments:{where:{status:{not:"Completed"}},orderBy:{dueAt:"asc"},take:3},economics:true}});
   await recordCommand(`Reviewed deal pipeline for ${ventureName}.`,`${deals.length} deal(s) returned.`);
   return NextResponse.json({mode:"data",title:`${deals.length} recorded deal${deals.length===1?"":"s"}`,summary:deals.length?"Live deal records with open commitments.":"No deals are currently recorded in HQ.",items:deals.map(x=>({id:x.id,title:x.title,meta:`${x.stage}${x.commitments.length?` · ${x.commitments.length} open commitment(s)`:""}`})),action:{label:"Open deal workspace",target:"BA Operations"}});
 }
 if(/opportun|tender|contract|compet|campaign|ad|research|prospect|find/.test(q)){
   const [ops,evidence]=await Promise.all([prisma.intelligenceOpportunity.findMany({where:{ventureId:venture.id},orderBy:{createdAt:"desc"},take:8}),prisma.intelligenceEvidence.findMany({where:{ventureId:venture.id},orderBy:{capturedAt:"desc"},take:8})]);
   if(ops.length||evidence.length){await recordCommand(`Reviewed stored intelligence for ${ventureName}.`,`${ops.length} opportunities and ${evidence.length} intelligence records returned.`);return NextResponse.json({mode:"data",title:`${ops.length} opportunities · ${evidence.length} intelligence records`,summary:"Showing what HQ has already captured. Use Intelligence to run fresh discovery.",items:[...ops.map(x=>({id:x.id,title:x.title,meta:x.status})),...evidence.slice(0,4).map(x=>({id:x.id,title:x.title,meta:`${x.platform} · ${x.competitorName}`}))],action:{label:"Open Intelligence",target:"Intelligence"}});}
   await recordCommand(`Fresh intelligence required for ${ventureName}.`,"Routed to Intelligence for source-specific discovery.");
   return NextResponse.json({mode:"route",title:"Fresh research needed",summary:"HQ has no stored evidence matching this request yet. Open Intelligence to run source-specific discovery.",items:[],action:{label:"Open Intelligence",target:"Intelligence"}});
 }
 if(/create|write|draft|pitch|email|content|creative|script/.test(q)){await recordCommand(`Routed creation request for ${ventureName}.`,"Request handed to Create.");return NextResponse.json({mode:"route",title:"Ready to create",summary:"I can send this instruction into Create with the business and objective already attached.",items:[],action:{label:"Open Create",target:"Create",handoff:{venture:ventureName,project:command,output:command}}});}
 const [tasks,actions]=await Promise.all([prisma.task.findMany({where:{ventureId:venture.id,status:{not:"DONE"}},orderBy:[{priority:"asc"},{dueAt:"asc"}],take:8}),prisma.action.findMany({where:{ventureId:venture.id,executionState:{not:"Completed"}},orderBy:[{urgency:"asc"},{updatedAt:"desc"}],take:8})]);
 if(tasks.length||actions.length){await recordCommand(`Reviewed open work for ${ventureName}.`,`${tasks.length} task(s) and ${actions.length} action(s) returned.`);return NextResponse.json({mode:"data",title:"What needs attention",summary:"These are the current live HQ tasks and actions for this business.",items:[...actions.map(x=>({id:x.id,title:x.title,meta:x.lane.replaceAll("_"," ")})),...tasks.map(x=>({id:x.id,title:x.title,meta:x.status.replaceAll("_"," ")}))]});}
 await recordCommand(`No direct connected action matched this instruction for ${ventureName}.`,"Escalated to approved workflow planner.");
 return NextResponse.json({mode:"workflow",title:"HQ needs a workflow for this",summary:"There is no direct connected data action for this instruction yet. HQ can try the approved workflow planner.",items:[]});
}