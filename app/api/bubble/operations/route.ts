import {NextResponse} from "next/server";
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
