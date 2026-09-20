import {NextRequest,NextResponse} from "next/server";
import {prisma} from "@/lib/server/prisma";
export const runtime="nodejs";

export async function GET(){
 if(!process.env.DATABASE_URL)return NextResponse.json({error:"HQ data connection is unavailable."},{status:503});
 const venture=await prisma.venture.findUnique({where:{name:"Bubble Leisure"}});
 if(!venture)return NextResponse.json({error:"Bubble Leisure is not connected to HQ."},{status:404});
 const [leads,venues]=await Promise.all([
  prisma.lead.findMany({where:{ventureId:venture.id},orderBy:{updatedAt:"desc"},include:{quotes:{orderBy:{createdAt:"desc"},take:1},calls:{orderBy:{createdAt:"desc"},take:1}}}),
  prisma.venue.findMany({orderBy:{createdAt:"desc"},take:30})
 ]);
 return NextResponse.json({generatedAt:new Date().toISOString(),leads:leads.map(l=>({id:l.id,customerName:l.customerName,email:l.email,phone:l.phone,location:l.requestedLocation,postcode:l.postcode,stage:l.stage,estimatedValue:l.estimatedValue?Number(l.estimatedValue):null,requirements:l.requirements,updatedAt:l.updatedAt,latestQuote:l.quotes[0]?{id:l.quotes[0].id,customerPrice:Number(l.quotes[0].customerPrice),grossProfit:Number(l.quotes[0].grossProfit),status:l.quotes[0].status}:null,latestCall:l.calls[0]?{outcome:l.calls[0].outcome,notes:l.calls[0].notes,createdAt:l.calls[0].createdAt}:null})),venues:venues.map(v=>({id:v.id,name:v.name,postcode:v.postcode,price:v.price?Number(v.price):null,priceStatus:v.priceStatus,availabilityStatus:v.availabilityStatus,permittedActivities:v.permittedActivities,sourceUrl:v.sourceUrl}))});
}


export async function PATCH(request:NextRequest){
 if(!process.env.DATABASE_URL)return NextResponse.json({error:"HQ data connection is unavailable."},{status:503});
 const body=await request.json().catch(()=>({})); const id=String(body.id||""); const action=String(body.action||"");
 if(!id)return NextResponse.json({error:"Lead id is required."},{status:400});
 const lead=await prisma.lead.findUnique({where:{id},include:{venture:true}});
 if(!lead||lead.venture.name!=="Bubble Leisure")return NextResponse.json({error:"Bubble lead not found."},{status:404});
 const stageMap:Record<string,any>={qualify:"REQUIREMENTS",venue:"VENUE_SOURCING",pricing:"PRICING",call:"CALL",quote:"QUOTE",followup:"FOLLOW_UP",deposit:"DEPOSIT",confirm:"CONFIRMED",won:"WON",lost:"LOST"};
 const stage=stageMap[action]; if(!stage)return NextResponse.json({error:"Unsupported lead action."},{status:400});
 const updated=await prisma.lead.update({where:{id},data:{stage}});
 if(action==="followup")await prisma.task.create({data:{ventureId:lead.ventureId,leadId:id,title:`Follow up ${lead.customerName}`,priority:2,status:"TODO"}});
 return NextResponse.json({updated:true,id:updated.id,stage:updated.stage});
}

export async function POST(request:NextRequest){
 if(!process.env.DATABASE_URL)return NextResponse.json({error:"HQ data connection is unavailable."},{status:503});
 const body=await request.json().catch(()=>({})); const id=String(body.id||"");
 const lead=await prisma.lead.findUnique({where:{id},include:{venture:true}}); if(!lead||lead.venture.name!=="Bubble Leisure")return NextResponse.json({error:"Bubble lead not found."},{status:404});
 const customerPrice=Number(body.customerPrice); const directCosts=Number(body.directCosts); if(!Number.isFinite(customerPrice)||customerPrice<=0||!Number.isFinite(directCosts)||directCosts<0)return NextResponse.json({error:"Valid customer price and direct costs are required."},{status:400});
 const quote=await prisma.quote.create({data:{leadId:id,customerPrice,directCosts,grossProfit:customerPrice-directCosts,status:"Draft"}});
 await prisma.lead.update({where:{id},data:{stage:"QUOTE",estimatedValue:customerPrice}});
 return NextResponse.json({created:true,quote:{id:quote.id,customerPrice:Number(quote.customerPrice),directCosts:Number(quote.directCosts),grossProfit:Number(quote.grossProfit),status:quote.status}});
}
