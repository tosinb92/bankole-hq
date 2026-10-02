import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { calculateBubbleQuote, sendBubbleQuoteEmail } from "@/lib/server/bubble-conversion";

export const runtime = "nodejs";

function getProviderCallId(message: any) {
  return String(message?.call?.id || message?.call?.providerCallId || "");
}

function cleanText(value: unknown, max = 12000) {
  const text = String(value || "").trim();
  return text ? text.slice(0, max) : null;
}

export async function POST(request: NextRequest) {
  const secret = process.env.VAPI_SERVER_SECRET;
  if (secret && request.headers.get("x-bubble-voice-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const message = body?.message;
  if (!message) return NextResponse.json({ ok: true });

  const providerCallId = getProviderCallId(message);
  if (!providerCallId) return NextResponse.json({ ok: true, ignored: "missing-call-id" });

  const call = await prisma.call.findFirst({
    where: { providerCallId },
    include: { lead: true },
  });
  if (!call) return NextResponse.json({ ok: true, ignored: "unknown-call" });

  if (message.type === "status-update") {
    const status = cleanText(message.status, 120) || "unknown";
    const completedAt = status === "ended" ? new Date() : undefined;
    await prisma.call.update({
      where: { id: call.id },
      data: { outcome: status, ...(completedAt ? { completedAt } : {}) },
    });
    return NextResponse.json({ ok: true });
  }

  if (message.type === "end-of-call-report") {
    const transcript = cleanText(message?.artifact?.transcript);
    const summary =
      cleanText(message?.analysis?.summary, 4000) ||
      cleanText(message?.artifact?.summary, 4000);
    const endedReason = cleanText(message?.endedReason, 500) || "ended";
    const notes = [
      summary ? `Summary: ${summary}` : null,
      transcript ? `Transcript:\n${transcript}` : null,
      `Ended reason: ${endedReason}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    await prisma.call.update({
      where: { id: call.id },
      data: {
        outcome: endedReason,
        notes,
        completedAt: new Date(),
      },
    });

    const successfulConversation =
      Boolean(transcript) &&
      !["customer-did-not-answer", "customer-busy", "voicemail"].some((x) =>
        endedReason.toLowerCase().includes(x)
      );

    await prisma.lead.updateMany({
      where: { id: call.leadId, stage: {notIn:["DEPOSIT","VENUE_SECURED","CONFIRMED","EVENT","WON","LOST"]} },
      data: { stage: successfulConversation ? "REQUIREMENTS" : "FOLLOW_UP" },
    });

    // After a successful qualification call, HQ—not the voice model—calculates
    // the price from stored Bubble Leisure PricingRule records and sends the
    // written quote automatically when the rule is deterministic.
    if (successfulConversation) {
      const pricing = await calculateBubbleQuote(call.leadId);
      if (pricing.ok) {
        await sendBubbleQuoteEmail(call.leadId);
      } else {
        const existingPricingTask = await prisma.task.findFirst({
          where: { leadId: call.leadId, status: { in: ["TODO", "IN_PROGRESS"] }, title: { startsWith: "Price " } },
        });
        if (!existingPricingTask) {
          await prisma.task.create({ data: { ventureId: call.lead.ventureId, leadId: call.leadId, title: `Price ${call.lead.customerName} enquiry`, priority: 1, status: "TODO" } });
        }
      }
    }

    if (!successfulConversation) {
      const existing = await prisma.task.findFirst({
        where: {
          leadId: call.leadId,
          status: { in: ["TODO", "IN_PROGRESS"] },
          title: { startsWith: "Follow up " },
        },
      });
      if (!existing) {
        await prisma.task.create({
          data: {
            ventureId: call.lead.ventureId,
            leadId: call.leadId,
            title: `Follow up ${call.lead.customerName}`,
            priority: 2,
            status: "TODO",
          },
        });
      }
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true, ignored: message.type || "unknown-message" });
}
