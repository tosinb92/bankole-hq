import { NextRequest, NextResponse } from "next/server";
import tls from "node:tls";

export const runtime = "nodejs";

type Recipient = { email:string; name?:string; subject:string; body:string };

function clean(s:string){ return String(s||"").replace(/[\r\n]+/g," ").trim(); }
function dotStuff(s:string){ return s.replace(/\r?\n/g,"\r\n").replace(/^\./gm,".."); }

async function smtpSend(to:Recipient){
  const host=process.env.FIRE_SMTP_HOST||"smtp0001.neo.space";
  const port=Number(process.env.FIRE_SMTP_PORT||465);
  const user=process.env.FIRE_SMTP_USER;
  const pass=process.env.FIRE_SMTP_PASSWORD;
  if(!user||!pass) throw new Error("FireComplianceUK SMTP credentials are not configured");

  await new Promise<void>((resolve,reject)=>{
    const socket=tls.connect({host,port,servername:host,rejectUnauthorized:true});
    let buffer=""; let step=0;
    const fail=(e:unknown)=>{try{socket.destroy()}catch{} reject(e instanceof Error?e:new Error(String(e)))};
    const send=(x:string)=>socket.write(x+"\r\n");
    const auth=Buffer.from("\0"+user+"\0"+pass).toString("base64");
    const from=clean(user), dest=clean(to.email), subject=clean(to.subject);
    const display=clean(to.name||dest);
    const msg=[
      "From: FireComplianceUK <"+from+">",
      "To: "+display+" <"+dest+">",
      "Subject: "+subject,
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: 8bit",
      "",
      to.body.trim(),
      "",
      "--",
      "Tosin Bankole",
      "Founder & Director | FireComplianceUK",
      "firecomplianceuk.co.uk"
    ].join("\r\n");

    socket.setTimeout(15000,()=>fail(new Error("SMTP timeout")));
    socket.on("error",fail);
    socket.on("data",(chunk)=>{
      buffer+=chunk.toString();
      if(!/\r\n$/.test(buffer)) return;
      const line=buffer; buffer="";
      if(/^4|^5/.test(line)) return fail(new Error("SMTP: "+line.trim()));
      if(step===0&&/^220/.test(line)){step=1;send("EHLO bankolehq");return;}
      if(step===1&&/^250[ -]/.test(line)&&/250 /.test(line)){step=2;send("AUTH PLAIN "+auth);return;}
      if(step===2&&/^235/.test(line)){step=3;send("MAIL FROM:<"+from+">");return;}
      if(step===3&&/^250/.test(line)){step=4;send("RCPT TO:<"+dest+">");return;}
      if(step===4&&/^250/.test(line)){step=5;send("DATA");return;}
      if(step===5&&/^354/.test(line)){step=6;send(dotStuff(msg)+"\r\n.");return;}
      if(step===6&&/^250/.test(line)){step=7;send("QUIT");resolve();}
    });
  });
}

export async function POST(req:NextRequest){
  try{
    const token=req.headers.get("x-hq-send-token");
    if(!process.env.HQ_SEND_TOKEN||token!==process.env.HQ_SEND_TOKEN)
      return NextResponse.json({error:"Approval token required"},{status:401});
    const body=await req.json();
    const recipients:Recipient[]=Array.isArray(body?.recipients)?body.recipients:[];
    if(!recipients.length||recipients.length>25)
      return NextResponse.json({error:"Provide 1-25 approved recipients"},{status:400});
    const results=[];
    for(const r of recipients){
      if(!r.email||!r.subject||!r.body){results.push({email:r.email,status:"skipped",error:"Missing email, subject or body"});continue;}
      try{await smtpSend(r);results.push({email:r.email,status:"sent"});}
      catch(e){results.push({email:r.email,status:"failed",error:e instanceof Error?e.message:"Send failed"});}
    }
    return NextResponse.json({ok:results.every(x=>x.status==="sent"),results});
  }catch(e){
    return NextResponse.json({error:e instanceof Error?e.message:"Unexpected send error"},{status:500});
  }
}
