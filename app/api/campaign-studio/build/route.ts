import {NextResponse} from "next/server";
import sharp from "sharp";
import launch from "../../../../content/campaign-studio/launch-wave-1.json";
export const runtime="nodejs";
export const maxDuration=60;
const bucket="campaign-assets";
const esc=(s:string)=>s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const safe=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
function wrap(s:string,max=19){const words=s.toUpperCase().split(" ");const lines:string[]=[];let line="";for(const w of words){if((line+" "+w).trim().length>max&&line){lines.push(line);line=w}else line=(line+" "+w).trim()}if(line)lines.push(line);return lines.slice(0,5)}
export async function POST(req:Request){try{
 const {brand="BAA",offset=0,count=5}=await req.json() as {brand?:string;offset?:number;count?:number};
 if(brand!=="BAA")return NextResponse.json({error:"BAA first batch only; other brands follow."},{status:400});
 const base=(process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL||"").trim().replace(/\/+$/,"");const key=process.env.SUPABASE_SERVICE_ROLE_KEY||"";
 if(!base||!key)return NextResponse.json({error:"Supabase configuration missing"},{status:503});
 const headers={apikey:key,Authorization:"Bearer "+key};
 const get=async(path:string)=>fetch(base+"/storage/v1/"+path,{headers,cache:"no-store"});
 const meta=await get("object/"+bucket+"/avatars/baa.json");if(!meta.ok)throw Error("Approved BAA avatar missing");
 const avatar=await meta.json() as {imageUrl:string};
 const avatarRes=await fetch(avatar.imageUrl,{cache:"no-store"});if(!avatarRes.ok)throw Error("Could not load approved BAA avatar");
 const photo=await sharp(Buffer.from(await avatarRes.arrayBuffer())).resize(660,800,{fit:"cover",position:"attention"}).jpeg({quality:85}).toBuffer();
 const photoB64=photo.toString("base64");
 const posts=launch.posts.filter(p=>p.brand===brand).slice(Math.max(0,offset),Math.max(0,offset)+Math.min(5,Math.max(1,count)));
 const results=[];
 for(const [i,p] of posts.entries()){
 const variant=(offset+i)%4;const lines=wrap(p.hook,variant===1?17:20);const font=lines.length>3?63:74;
 const lineSvg=lines.map((line,j)=>'<tspan x="74" dy="'+(j===0?0:font*1.1)+'">'+esc(line)+'</tspan>').join("");
 const imgX=variant%2===0?420:455;
 const svg='<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350"><defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#0c0f13"/><stop offset="1" stop-color="'+(["#28211a","#12212a","#24201a","#192625"][variant])+'"/></linearGradient><linearGradient id="fade" x1="0" x2="1"><stop stop-color="#0c0f13" stop-opacity="1"/><stop offset=".8" stop-color="#0c0f13" stop-opacity=".28"/><stop offset="1" stop-color="#0c0f13" stop-opacity="0"/></linearGradient><clipPath id="photo"><rect x="'+imgX+'" y="265" width="620" height="835" rx="22"/></clipPath></defs><rect width="1080" height="1350" fill="url(#bg)"/><rect x="28" y="28" width="1024" height="1294" rx="24" fill="none" stroke="#b89965" stroke-width="2"/><image href="data:image/jpeg;base64,'+photoB64+'" x="'+imgX+'" y="265" width="620" height="835" preserveAspectRatio="xMidYMid slice" clip-path="url(#photo)"/><rect x="0" y="235" width="860" height="900" fill="url(#fade)"/><text x="74" y="125" font-family="Georgia,serif" font-size="70" fill="#d6b47a">BA</text><text x="190" y="94" font-family="Arial,sans-serif" font-size="25" letter-spacing="4" fill="#fff">BRILLIANT AI</text><text x="190" y="127" font-family="Arial,sans-serif" font-size="25" letter-spacing="4" fill="#fff">AUTOMATIONS</text><line x1="74" y1="171" x2="1006" y2="171" stroke="#a78c60"/><text x="74" y="325" font-family="Arial,sans-serif" font-weight="900" font-size="'+font+'" fill="#f7edda">'+lineSvg+'</text><rect x="74" y="1115" width="930" height="104" rx="52" fill="#d8b87b"/><text x="539" y="1181" text-anchor="middle" font-family="Arial,sans-serif" font-weight="bold" font-size="43" fill="#101316">DM BLUEPRINT</text><text x="540" y="1270" text-anchor="middle" font-family="Arial,sans-serif" font-size="23" letter-spacing="3" fill="#e8dcc5">AUTOMATE  ·  GROW  ·  SCALE</text></svg>';
 const buffer=await sharp(Buffer.from(svg)).jpeg({quality:88}).toBuffer();
 const filename="images/"+safe(p.postId)+".jpg";
 const up=await fetch(base+"/storage/v1/object/"+bucket+"/"+filename,{method:"POST",headers:{...headers,"Content-Type":"image/jpeg","x-upsert":"true"},body:new Uint8Array(buffer)});if(!up.ok)throw Error("Image upload failed: "+(await up.text()).slice(0,150));
 const imageUrl=base+"/storage/v1/object/public/"+bucket+"/"+filename;
 const record={postId:p.postId,brand,topic:p.hook,slide:0,imageUrl,prompt:"Approved-avatar branded graphic rendered from locked 40-post campaign",createdAt:new Date().toISOString(),status:"Awaiting owner approval"};
 const m=await fetch(base+"/storage/v1/object/"+bucket+"/posts/"+safe(p.postId)+"-slide-0.json",{method:"POST",headers:{...headers,"Content-Type":"application/json","x-upsert":"true"},body:JSON.stringify(record)});if(!m.ok)throw Error("Metadata upload failed: "+(await m.text()).slice(0,150));results.push(record);
 }
 return NextResponse.json({created:results.length,assets:results});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Creative build failed"},{status:503})}}

// Temporary single-use operator bootstrap; remove immediately after importing approved-avatar artwork.
export async function GET(req:Request){const q=new URL(req.url).searchParams;if(q.get("bootstrap")!=="baa-20260923-initial-creative-import")return NextResponse.json({error:"Not found"},{status:404});return POST(new Request(req.url,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({brand:"BAA",offset:Number(q.get("offset")||0),count:5})}));}
