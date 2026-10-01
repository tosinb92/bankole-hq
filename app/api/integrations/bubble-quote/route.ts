import { NextRequest, NextResponse } from "next/server";
import { calculateBubbleQuote, sendBubbleQuoteEmail } from "@/lib/server/bubble-conversion";

export const runtime = "nodejs";

function authorised(req: NextRequest) {
  const secret = process.env.VAPI_SERVER_SECRET || process.env.HQ_MCP_TOKEN;
  return Boolean(secret && (req.headers.get("x-bubble-voice-secret") === secret || req.headers.get("authorization") === `Bearer ${secret}`));
}

export async function POST(req: NextRequest) {
  if (!authorised(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const leadId = String(body?.leadId || "");
  if (!leadId) return NextResponse.json({ error: "leadId is required" }, { status: 400 });

  const quote = await calculateBubbleQuote(leadId);
  if (!quote.ok) return NextResponse.json(quote, { status: quote.reason === "missing-requirements" ? 422 : 409 });

  const send = body?.send === false ? { sent:false, reason:"send-disabled" } : await sendBubbleQuoteEmail(leadId, body?.bookingUrl);
  return NextResponse.json({ ...quote, message: send });
}
