import { z } from 'zod';
export const businesses=['FireComplianceUK','Brilliant AI Automation','Bankole & Associates','Bubble Leisure','SeekSignal','MiniMii Moments','MiniMii','TradeCompare','UNLOOP','VEYRO','Doit'];
const https=z.string().url().refine(v=>new URL(v).protocol==='https:','Use an HTTPS source');
export const signalSchema=z.object({ventureName:z.string().min(1).max(120),customerName:z.string().min(1).max(200),sourceUrl:https,evidence:z.string().min(20).max(10000),observedAt:z.string().datetime(),deadline:z.string().datetime().optional(),intent:z.enum(['explicit','inferred','weak']),urgency:z.number().int().min(0).max(25),fit:z.number().int().min(0).max(20),evidenceQuality:z.number().int().min(0).max(10),contactEmail:z.string().email().optional(),contactSource:https.optional(),contactName:z.string().max(200).optional(),nextAction:z.string().min(5).max(2000),salesArgument:z.string().max(5000).optional(),estimatedValue:z.number().min(0).max(999999999).optional(),valueEvidence:z.string().min(10).optional(),externalRecordUrl:https.optional()}).refine(v=>!v.contactEmail||!!v.contactSource,{message:'Published contact source required',path:['contactSource']}).refine(v=>v.estimatedValue===undefined||!!v.valueEvidence,{message:'Value evidence required',path:['valueEvidence']}).refine(v=>new Date(v.observedAt).getTime()<=Date.now()+60000,{message:'Observation cannot be in future',path:['observedAt']});
export type Signal=z.infer<typeof signalSchema>;
export function canonicalUrl(value:string){const u=new URL(value);u.hash='';for(const k of [...u.searchParams.keys()])if(/^utm_|^(fbclid|gclid)$/.test(k))u.searchParams.delete(k);u.searchParams.sort();return u.toString().replace(/\/$/,'');}
export function scoreSignal(s:Signal,now=Date.now()){
 const expired=!!s.deadline&&new Date(s.deadline).getTime()<now;
 const parts={intent:s.intent==='explicit'?30:s.intent==='inferred'?12:0,urgency:s.urgency,fit:s.fit,contact:s.contactEmail&&s.contactSource?15:0,evidence:s.evidenceQuality};
 const raw=Object.values(parts).reduce((a,b)=>a+b,0);
 const stale=now-new Date(s.observedAt).getTime()>30*86400000;
 const score=expired?0:Math.min(raw,s.intent==='weak'?39:s.intent==='inferred'||stale?59:100);
 return {score,parts,expired,stale,priority:expired?'Expired':score>=80?'Immediate priority':score>=60?'Qualification required':'Monitor'};
}
export const progressSchema=z.object({id:z.string().min(1),expectedUpdatedAt:z.string().datetime(),stage:z.enum(['NEW_LEAD','REQUIREMENTS','QUOTE','FOLLOW_UP','WON','LOST']).optional(),nextAction:z.string().min(5).max(2000),followUpAt:z.string().datetime().optional(),offerUrl:https.optional(),offerDescription:z.string().max(5000).optional(),draftSubject:z.string().max(300).optional(),draftBody:z.string().max(10000).optional(),suppressed:z.boolean().optional(),outcomeEvidence:z.string().max(5000).optional()});
