import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";

export const runtime = "nodejs";
const PAGE_ID = "1098181786706854";
const FIELDS = ["id","created_time","campaign","campaign_id","adset_name","adset_id","ad_name","form_id","form_name","full_name","email","phone_number","choose_activity","choose_duration","choose_date__time","number_of_players","street_address"].join(",");

function rowsFrom(body:any){ return Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : []; }
function requirements(x:any){ return { source:"Facebook Instant Form", provider:"Windsor.ai", facebookLeadId:String(x.id||""), campaign:x.campaign||null, campaignId:x.campaign_id||null, adSet:x.adset_name||null, adSetId:x.adset_id||null, ad:x.ad_name||null, form:x.form_name||null, formId:x.form_id||null, activity:x.choose_activity||null, duration:x.choose_duration||null, eventDateTime:x.choose_date__time||null, players:x.number_of_players||null, submittedAt:x.created_time||null }; }

async function pull(){
 const apiKey=process.env.WINDSOR_API_KEY;
 if(!apiKey) return {ok:false,status:503,message:"Bankole HQ needs WINDSOR_API_KEY in Vercel before it can sync Facebook leads.",rows:[]};
 const url=new URL("https://connectors.windsor.ai/facebook_leads");
 url.searchParams.set("api_key",apiKey); url.searchParams.set("fields",FIELDS); url.searchParams.set("select_accounts",PAGE_ID); url.searchParams.set("date_preset","last_90d");
 const response=await fetch(url.toString(),{cache:"no-store",headers:{"User-Agent":"Bankole-HQ/1.0"}});
 const body=await response.json().catch(()=>({}));
 if(!response.ok)return {ok:false,status:502,message:"Facebook Lead Ads could not be refreshed.",providerStatus:response.status,rows:[]};
 return {ok:true,status:200,rows:rowsFrom(body)};
}

export async function GET(){
 const result=await pull();
 return NextResponse.json({connected:result.ok,source:"Windsor.ai · Facebook Lead Ads",pageId:PAGE_ID,availableLeads:result.rows.length,message:result.ok?"Facebook Lead Ads connection is reachable.":"Facebook Lead Ads connection is not reachable.",providerStatus:(result as any).providerStatus||null},{status:result.status});
}

export async function POST(request:NextRequest){
 if(!process.env.DATABASE_URL)return NextResponse.json({error:"HQ data connection is unavailable."},{status:503});
 const secret=process.env.HQ_SYNC_SECRET; if(secret && request.headers.get("x-hq-sync-secret")!==secret)return NextResponse.json({error:"Unauthorized"},{status:401});
 const result=await pull(); if(!result.ok)return NextResponse.json({error:result.message,providerStatus:(result as any).providerStatus||null},{status:result.status});
 const venture=await prisma.venture.findUnique({where:{name:"Bubble Leisure"}});
 if(!venture)return NextResponse.json({error:"Bubble Leisure venture is not present in HQ."},{status:404});
 let created=0,existing=0;
 for(const x of result.rows){
  const externalId=String(x.id||""); if(!externalId)continue;
  const duplicate=await prisma.lead.findFirst({where:{ventureId:venture.id,requirements:{path:["facebookLeadId"],equals:externalId}}});
  if(duplicate){existing++;continue;}
  await prisma.lead.create({data:{ventureId:venture.id,customerName:x.full_name||"Facebook lead",email:x.email||null,phone:x.phone_number||null,requestedLocation:x.street_address||null,requirements:requirements(x),stage:"NEW_LEAD"}});
  created++;
 }
 return NextResponse.json({synced:true,source:"Facebook Instant Forms",pageId:PAGE_ID,fetched:result.rows.length,created,existing,syncedAt:new Date().toISOString()});
}
