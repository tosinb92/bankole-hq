import { prisma } from "@/lib/server/prisma";
import { randomUUID } from "crypto";

export type HqEventInput={ventureName?:string|null;source:string;sourceRef?:string|null;eventType:string;title:string;detail?:string|null;payload?:unknown;importance?:number;occurredAt?:string|Date};

export async function recordHqEvent(e:HqEventInput){
 const id=randomUUID();
 const occurred=e.occurredAt?new Date(e.occurredAt):new Date();
 await prisma.$executeRaw`
 INSERT INTO "ActivityEvent" ("id","ventureName","source","sourceRef","eventType","title","detail","payload","importance","occurredAt")
 VALUES (${id},${e.ventureName??null},${e.source},${e.sourceRef??null},${e.eventType},${e.title},${e.detail??null},${e.payload?JSON.stringify(e.payload):null}::jsonb,${e.importance??50},${occurred})
 `;
 return id;
}
export async function recentHqEvents(limit=50){
 return prisma.$queryRaw<any[]>`SELECT * FROM "ActivityEvent" WHERE "status"='ACTIVE' ORDER BY "importance" DESC,"occurredAt" DESC LIMIT ${limit}`;
}
export async function markSync(key:string,label:string,status:string,error?:string|null,metadata?:unknown){
 await prisma.$executeRaw`
 INSERT INTO "IntegrationSync" ("key","label","status","lastAttemptAt","lastSuccessAt","lastError","metadata","updatedAt")
 VALUES (${key},${label},${status},NOW(),CASE WHEN ${status}='LIVE' THEN NOW() ELSE NULL END,${error??null},${metadata?JSON.stringify(metadata):null}::jsonb,NOW())
 ON CONFLICT ("key") DO UPDATE SET "label"=EXCLUDED."label","status"=EXCLUDED."status","lastAttemptAt"=NOW(),
 "lastSuccessAt"=CASE WHEN EXCLUDED."status"='LIVE' THEN NOW() ELSE "IntegrationSync"."lastSuccessAt" END,
 "lastError"=EXCLUDED."lastError","metadata"=EXCLUDED."metadata","updatedAt"=NOW()
 `;
}
export async function syncStatuses(){return prisma.$queryRaw<any[]>`SELECT * FROM "IntegrationSync" ORDER BY "label"`;}
