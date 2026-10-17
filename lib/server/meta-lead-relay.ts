import {timingSafeEqual} from 'node:crypto';
export function relayEnabled(){return Boolean(process.env.META_LEAD_FORWARD_URL&&process.env.META_LEAD_FORWARD_SECRET)}
export function relayAuthorized(header:string|null){const secret=process.env.META_LEAD_FORWARD_SECRET,value=header?.replace(/^Bearer /,'')||'';if(!secret)return false;const a=Buffer.from(secret),b=Buffer.from(value);return a.length===b.length&&timingSafeEqual(a,b)}
async function graph(path:string,params:Record<string,string>={}){
 const token=process.env.META_PAGE_ACCESS_TOKEN;if(!token)throw Error('Page token is not configured');
 const url=new URL('https://graph.facebook.com/'+(process.env.META_GRAPH_VERSION||'v23.0')+'/'+path);for(const [k,v]of Object.entries(params))url.searchParams.set(k,v);
 const r=await fetch(url,{headers:{authorization:'Bearer '+token},signal:AbortSignal.timeout(10000),cache:'no-store'});const body=await r.json();
 if(!r.ok)throw Error(`Meta request failed: HTTP ${r.status}; code ${Number(body.error?.code)||0}; subcode ${Number(body.error?.error_subcode)||0}`);
 return body;
}
async function formIds(pageId:string){
 const ids:string[]=[];let after='';
 for(let n=0;n<5;n++){
  const result=await graph(pageId+'/leadgen_forms',{fields:'id',limit:'100',...(after?{after}:{})});
  for(const form of result.data||[])if(typeof form.id==='string')ids.push(form.id);
  if(!result.paging?.next||!result.paging?.cursors?.after)break;after=result.paging.cursors.after;
 }
 return ids;
}
export async function relayDiagnostics(pageId:string){
 const [forms,apps]=await Promise.all([formIds(pageId),graph(pageId+'/subscribed_apps',{fields:'id,subscribed_fields'})]);
 return {pageId,pageAccessVerified:true,formIds:forms,subscriptions:(apps.data||[]).map((a:any)=>({appId:a.id,leadgen:(a.subscribed_fields||[]).includes('leadgen')})),forwardConfigured:relayEnabled()};
}
export async function relayLead(pageId:string,leadId:string){
 if(!/^\d{5,30}$/.test(leadId)||!/^\d{5,30}$/.test(pageId))throw Error('Invalid provider identifiers');
 const [lead,forms]=await Promise.all([graph(leadId,{fields:'id,created_time,field_data,form_id,ad_id'}),formIds(pageId)]);
 if(String(lead.id)!==leadId||!forms.includes(String(lead.form_id)))throw Error('Lead does not belong to a form on this Page');
 const destination=process.env.META_LEAD_FORWARD_URL,secret=process.env.META_LEAD_FORWARD_SECRET;
 if(!destination||!secret||new URL(destination).protocol!=='https:')throw Error('Secure forwarding is not configured');
 const r=await fetch(destination,{method:'POST',headers:{'content-type':'application/json','x-meta-relay-secret':secret},body:JSON.stringify({pageId,lead}),signal:AbortSignal.timeout(20000),cache:'no-store'});
 if(!r.ok)throw Error('Lead destination rejected forwarding: HTTP '+r.status);
 const result=await r.json();return {forwarded:true,testOnly:Boolean(result.testOnly),processed:Number(result.processed)||0};
}
