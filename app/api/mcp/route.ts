import {NextRequest,NextResponse} from "next/server";import {prisma} from "@/lib/server/prisma";import {recordHqEvent,recentHqEvents,syncStatuses} from "@/lib/server/hq-live";export const runtime="nodejs";
const tools=[
 {name:"get_hq_state",description:"Read the current Bankole HQ portfolio state across ventures, tasks, deals, leads, recent activity and integrations.",inputSchema:{type:"object",properties:{},additionalProperties:false}},
 {name:"get_today",description:"Read the highest-priority live events and open work for deciding what to do today.",inputSchema:{type:"object",properties:{limit:{type:"number"}},additionalProperties:false}},
 {name:"record_event",description:"Write a meaningful business event from ChatGPT or another authorised system into Bankole HQ.",inputSchema:{type:"object",required:["source","eventType","title"],properties:{ventureName:{type:"string"},source:{type:"string"},sourceRef:{type:"string"},eventType:{type:"string"},title:{type:"string"},detail:{type:"string"},importance:{type:"number"},payload:{type:"object"}},additionalProperties:false}},
 {name:"create_task",description:"Create a real HQ task, optionally attached to a venture.",inputSchema:{type:"object",required:["title"],properties:{title:{type:"string"},ventureName:{type:"string"},priority:{type:"number"},dueAt:{type:"string"}},additionalProperties:false}},
 {name:"update_task",description:"Update an HQ task status.",inputSchema:{type:"object",required:["taskId","status"],properties:{taskId:{type:"string"},status:{type:"string",enum:["TODO","IN_PROGRESS","DONE","BLOCKED"]}},additionalProperties:false}}
];
function auth(req:NextRequest){const token=process.env.HQ_MCP_TOKEN;return !!token&&req.headers.get("authorization")===`Bearer ${token}`;}
const result=(id:any,data:any)=>NextResponse.json({jsonrpc:"2.0",id,result:data},{headers:{"MCP-Protocol-Version":"2025-06-18"}});
export async function GET(){return NextResponse.json({name:"Bankole HQ MCP",version:"1.0.0",status:"ready"});}
export async function POST(req:NextRequest){if(!auth(req))return NextResponse.json({error:"Unauthorized"},{status:401});const b=await req.json();const id=b.id??null;
 if(b.method==="initialize")return result(id,{protocolVersion:"2025-06-18",capabilities:{tools:{}},serverInfo:{name:"bankole-hq",version:"1.0.0"}});
 if(b.method==="notifications/initialized")return new NextResponse(null,{status:202});
 if(b.method==="tools/list")return result(id,{tools});
 if(b.method!=="tools/call")return NextResponse.json({jsonrpc:"2.0",id,error:{code:-32601,message:"Method not found"}},{status:200});
 const name=b.params?.name,args=b.params?.arguments??{};let out:any;
 if(name==="get_today"){const [events,tasks]=await Promise.all([recentHqEvents(Math.min(args.limit??30,100)).catch(()=>[]),prisma.task.findMany({where:{status:{not:"DONE"}},take:30,orderBy:[{priority:"asc"},{createdAt:"desc"}],include:{venture:{select:{name:true}}}})]);out={events,tasks};}
 else if(name==="get_hq_state"){const [ventures,tasks,deals,leads,events,integrations]=await Promise.all([prisma.venture.findMany(),prisma.task.findMany({where:{status:{not:"DONE"}},include:{venture:{select:{name:true}}}}),prisma.deal.findMany({include:{venture:{select:{name:true}}}}),prisma.lead.findMany({include:{venture:{select:{name:true}}}}),recentHqEvents(100).catch(()=>[]),syncStatuses().catch(()=>[])]);out={ventures,tasks,deals,leads,events,integrations};}
 else if(name==="record_event"){out={id:await recordHqEvent(args)};}
 else if(name==="create_task"){const venture=args.ventureName?await prisma.venture.findUnique({where:{name:args.ventureName}}):null;out=await prisma.task.create({data:{title:args.title,priority:args.priority??3,dueAt:args.dueAt?new Date(args.dueAt):null,ventureId:venture?.id}});}
 else if(name==="update_task"){out=await prisma.task.update({where:{id:args.taskId},data:{status:args.status}});}
 else return result(id,{content:[{type:"text",text:"Unknown tool"}],isError:true});
 return result(id,{content:[{type:"text",text:JSON.stringify(out)}],structuredContent:out});
}
