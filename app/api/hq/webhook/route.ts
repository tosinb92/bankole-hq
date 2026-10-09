import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/server/prisma";
import { recordHqEvent, markSync } from "@/lib/server/hq-live";
import { calculateBubbleQuote, sendBubbleQuoteEmail } from "@/lib/server/bubble-conversion";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const suppliedSecret = req.headers.get("x-hq-webhook-secret");
  const hqAccess = !!process.env.HQ_WEBHOOK_SECRET && suppliedSecret === process.env.HQ_WEBHOOK_SECRET;
  const bubbleAccess = !!process.env.BUBBLE_HQ_WEBHOOK_SECRET && suppliedSecret === process.env.BUBBLE_HQ_WEBHOOK_SECRET;
  if (!hqAccess && !bubbleAccess)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let b: any;
  try { b = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!b || typeof b !== "object" || Array.isArray(b))
    return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  const source = String(b.source || "webhook");
  if (!hqAccess && (source !== "bubble-leisure-website" || b.type !== "LEAD_CREATED"))
    return NextResponse.json({ error: "Unauthorized event source" }, { status: 403 });
  let leadId: string | undefined;
  if (source === "bubble-leisure-website" && b.type === "LEAD_CREATED") {
    const p = b.payload;
    if (!p || !["name", "email", "occasion", "activity", "location"].every(k => typeof p[k] === "string" && p[k].trim()))
      return NextResponse.json({ error: "Missing enquiry details" }, { status: 400 });
    const enquiryId = String(b.id || p.submissionId || randomUUID());
    const venture = await prisma.venture.findUnique({ where: { name: "Bubble Leisure" } });
    if (!venture) return NextResponse.json({ error: "Bubble Leisure is not configured in HQ" }, { status: 503 });
    const lead = await prisma.$transaction(async tx => {
      // Serialize retries of the same enquiry before checking its external ID.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"bubble-enquiry:" + enquiryId}))`;
      const existing = await tx.lead.findFirst({ where: {
        ventureId: venture.id, requirements: { path: ["websiteEnquiryId"], equals: enquiryId }
      } });
      if (existing) return existing;
      return tx.lead.create({ data: {
        ventureId: venture.id, customerName: p.name.trim(), email: p.email.trim(),
        phone: p.phone ? String(p.phone).trim() : null, requestedLocation: p.location.trim(),
        stage: "NEW_LEAD", requirements: {
          source: "Bubble Leisure Website", websiteEnquiryId: enquiryId,
          occasion: p.occasion, activity: p.activity, eventDateTime: p.date || null,
          players: p.guests || null, duration: p.duration || null, customerType: p.customerType || null, notes: p.notes || null, submittedAt: p.receivedAt || null
        }
      } });
    });
    leadId = lead.id;
    // Website enquiries now capture quote-ready details. Try to turn the lead into
    // revenue immediately when an authoritative deterministic pricing rule exists.
    // If pricing still needs human review, create one visible task instead of silently stopping.
    const pricing = await calculateBubbleQuote(lead.id);
    if (pricing.ok) {
      await sendBubbleQuoteEmail(lead.id);
    } else {
      const existingPricingTask = await prisma.task.findFirst({ where: { leadId: lead.id, status: { in: ["TODO", "IN_PROGRESS"] }, title: { startsWith: "Price " } } });
      if (!existingPricingTask) await prisma.task.create({ data: { ventureId: venture.id, leadId: lead.id, title: `Price ${lead.customerName} enquiry`, priority: 1, status: "TODO" } });
    }
    const recorded = await prisma.$queryRaw<any[]>`SELECT "id" FROM "ActivityEvent" WHERE "source"=${source} AND "sourceRef"=${enquiryId} LIMIT 1`;
    if (!recorded.length) await recordHqEvent({ source, sourceRef: enquiryId,
      eventType: "LEAD_CREATED", ventureName: "Bubble Leisure", title: b.title || "New Bubble Leisure enquiry",
      detail: b.detail, payload: { ...b, leadId }, importance: 85, occurredAt: b.occurredAt });
  } else {
    await recordHqEvent({ source, sourceRef: b.id || b.ref, eventType: b.type || "EXTERNAL_EVENT",
      ventureName: b.ventureName, title: b.title || `${source} update`, detail: b.detail,
      payload: b, importance: b.importance ?? 60, occurredAt: b.occurredAt });
  }
  await markSync(source, source, "LIVE", null, { lastEvent: b.type || "EXTERNAL_EVENT" });
  return NextResponse.json({ ok: true, ...(leadId ? { leadId } : {}) });
}
