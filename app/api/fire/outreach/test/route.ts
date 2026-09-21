import { NextResponse } from "next/server";
import tls from "node:tls";

export const runtime = "nodejs";

async function sendTest() {
  const host = process.env.FIRE_SMTP_HOST || "smtp0001.neo.space";
  const port = Number(process.env.FIRE_SMTP_PORT || 465);
  const user = process.env.FIRE_SMTP_USER;
  const pass = process.env.FIRE_SMTP_PASSWORD;
  const to = "tosin.bankole20@gmail.com";
  if (!user || !pass) throw new Error("SMTP credentials missing");

  await new Promise<void>((resolve, reject) => {
    const socket = tls.connect({ host, port, servername: host, rejectUnauthorized: true });
    let buffer = ""; let step = 0;
    const fail = (e: unknown) => { try { socket.destroy(); } catch {} reject(e instanceof Error ? e : new Error(String(e))); };
    const send = (s: string) => socket.write(s + "\r\n");
    const auth = Buffer.from("\0" + user + "\0" + pass).toString("base64");
    const msg = [
      "From: FireComplianceUK <" + user + ">",
      "To: Tosin Bankole <" + to + ">",
      "Subject: FireComplianceUK HQ email test",
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=UTF-8",
      "",
      "This is a live sending test from Bankole HQ using the FireComplianceUK Neo mailbox.",
      "",
      "If you received this, the HQ outbound email connection is working.",
      "",
      "Tosin Bankole",
      "Founder & Director | FireComplianceUK"
    ].join("\r\n");

    socket.setTimeout(15000, () => fail(new Error("SMTP timeout")));
    socket.on("error", fail);
    socket.on("data", chunk => {
      buffer += chunk.toString();
      if (!/\r\n$/.test(buffer)) return;
      const line = buffer; buffer = "";
      if (/^[45]/.test(line)) return fail(new Error("SMTP: " + line.trim()));
      if (step === 0 && /^220/.test(line)) { step=1; send("EHLO bankolehq"); return; }
      if (step === 1 && /^250[ -]/.test(line) && /250 /.test(line)) { step=2; send("AUTH PLAIN " + auth); return; }
      if (step === 2 && /^235/.test(line)) { step=3; send("MAIL FROM:<"+user+">"); return; }
      if (step === 3 && /^250/.test(line)) { step=4; send("RCPT TO:<"+to+">"); return; }
      if (step === 4 && /^250/.test(line)) { step=5; send("DATA"); return; }
      if (step === 5 && /^354/.test(line)) { step=6; send(msg+"\r\n."); return; }
      if (step === 6 && /^250/.test(line)) { send("QUIT"); resolve(); }
    });
  });
}

export async function GET() {
  try { await sendTest(); return NextResponse.json({ ok:true, sentTo:"tosin.bankole20@gmail.com" }); }
  catch(e) { return NextResponse.json({ ok:false, error:e instanceof Error?e.message:"SMTP test failed" }, {status:500}); }
}
