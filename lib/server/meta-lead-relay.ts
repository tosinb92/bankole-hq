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
 try{const [forms,apps]=await Promise.all([formIds(pageId),graph(pageId+'/subscribed_apps',{fields:'id,subscribed_fields'})]);return {pageId,pageAccessVerified:true,formIds:forms,subscriptions:(apps.data||[]).map((a:any)=>({appId:a.id,leadgen:(a.subscribed_fields||[]).includes('leadgen')})),forwardConfigured:relayEnabled()};}
 catch(error){const rows=await windsorRows(pageId);return {pageId,pageAccessVerified:false,graphError:error instanceof Error?error.message:'Meta connection unavailable',windsorAccessVerified:true,availableLeads:rows.length,formIds:[...new Set(rows.map((r:any)=>String(r.form_id)))],forwardConfigured:relayEnabled(),subscriptionVerificationUnavailable:true,refresh:'Windsor provider cache applies; instant retrieval is not verified'};}
}
export async function relayLead(pageId:string,leadId:string){
 if(!/^\d{5,30}$/.test(leadId)||!/^\d{5,30}$/.test(pageId))throw Error('Invalid provider identifiers');
 let lead:any,provider='MetaGraphRelay';
 try{const result=await Promise.all([graph(leadId,{fields:'id,created_time,field_data,form_id,ad_id'}),formIds(pageId)]);lead=result[0];if(String(lead.id)!==leadId||!result[1].includes(String(lead.form_id)))throw Error('Lead does not belong to this Page');}
 catch{const rows=await windsorRows(pageId),row=rows.find((r:any)=>String(r.id)===leadId);if(!row)throw Error('Lead is not available from the connected Page yet; retry after upstream refresh');lead=fromWindsor(row);provider='WindsorRelay';}
 const destination=process.env.META_LEAD_FORWARD_URL,secret=process.env.META_LEAD_FORWARD_SECRET;
 if(!destination||!secret||new URL(destination).protocol!=='https:')throw Error('Secure forwarding is not configured');
 const r=await fetch(destination,{method:'POST',headers:{'content-type':'application/json','x-meta-relay-secret':secret},body:JSON.stringify({pageId,lead,provider}),signal:AbortSignal.timeout(20000),cache:'no-store'});
 if(!r.ok)throw Error('Lead destination rejected forwarding: HTTP '+r.status);
 const result=await r.json();return {forwarded:true,testOnly:Boolean(result.testOnly),processed:Number(result.processed)||0};
}
async function windsorRows(pageId:string){
 const key=process.env.WINDSOR_API_KEY;if(!key)throw Error('Lead recovery credential is not configured');
 const fields=['id','created_time','account_id','form_id','form_name','full_name','email','phone_number','choose_activity','choose_duration','choose_date__time','number_of_players','street_address'];
 const url=new URL('https://connectors.windsor.ai/facebook_leads');url.searchParams.set('api_key',key);url.searchParams.set('select_accounts',pageId);url.searchParams.set('fields',fields.join(','));url.searchParams.set('date_preset','last_90d');url.searchParams.set('refresh_since','3d');url.searchParams.set('refresh_interval','1h');
 let r=await fetch(url,{signal:AbortSignal.timeout(12000),cache:'no-store'});if(!r.ok&&(r.status===400||r.status===403)){url.searchParams.delete('refresh_interval');url.searchParams.delete('refresh_since');r=await fetch(url,{signal:AbortSignal.timeout(12000),cache:'no-store'});}if(!r.ok)throw Error('Lead recovery provider rejected access: HTTP '+r.status);const body=await r.json();const rows=Array.isArray(body)?body:Array.isArray(body.data)?body.data:[];
 return rows.filter((row:any)=>String(row.account_id)===pageId);
}
function fromWindsor(row:any){const metadata=new Set(['id','created_time','account_id','form_id','form_name']);return {id:String(row.id),created_time:row.created_time,form_id:String(row.form_id),field_data:Object.entries(row).filter(([key,value])=>!metadata.has(key)&&typeof value==='string').map(([name,value])=>({name,values:[value]}))};}
