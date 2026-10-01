import { prisma } from "@/lib/server/prisma";

function num(v: unknown) {
  const n = Number(String(v ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : null;
}
function norm(v: unknown) { return String(v ?? "").trim().toLowerCase(); }

export async function calculateBubbleQuote(leadId: string) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, include: { venture: true } });
  if (!lead || lead.venture.name !== "Bubble Leisure") return { ok: false as const, reason: "lead-not-found" };
  const req: any = lead.requirements || {};
  const activity = String(req.activity || "").trim();
  const guests = num(req.players || req.guests);
  const duration = num(req.duration);
  if (!activity || !guests) return { ok: false as const, reason: "missing-requirements", missing: [!activity && "activity", !guests && "group-size"].filter(Boolean) };

  const rules = await prisma.pricingRule.findMany({ where: { ventureId: lead.ventureId, active: true } });
  const candidates = rules.filter(r => {
    if (norm(r.activity) !== norm(activity)) return false;
    if (r.groupMin != null && guests < r.groupMin) return false;
    if (r.groupMax != null && guests > r.groupMax) return false;
    if (r.durationMinutes != null && duration != null && Math.abs(r.durationMinutes - duration) > 1) return false;
    return true;
  });
  if (!candidates.length) return { ok: false as const, reason: "no-authoritative-pricing-rule", activity, guests, duration };

  const rule = candidates.sort((a,b) => {
    const ar = Number(a.basePriceMax) - Number(a.basePriceMin);
    const br = Number(b.basePriceMax) - Number(b.basePriceMin);
    return ar - br;
  })[0];

  // Never invent a price. Only auto-quote a deterministic rule.
  const min = Number(rule.basePriceMin), max = Number(rule.basePriceMax);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min !== max) {
    return { ok: false as const, reason: "pricing-requires-review", ruleId: rule.id, range: { min, max } };
  }
  const customerPrice = min;
  const directCosts = Number(rule.staffingCost) + Number(rule.equipmentCost);
  const grossProfit = customerPrice - directCosts;
  let quote = await prisma.quote.findFirst({ where: { leadId: lead.id, status: { in: ["Draft","Ready","Sent"] } }, orderBy: { createdAt: "desc" } });
  if (!quote) quote = await prisma.quote.create({ data: { leadId: lead.id, customerPrice, directCosts, grossProfit, status: "Ready" } });
  await prisma.lead.update({ where: { id: lead.id }, data: { estimatedValue: customerPrice, stage: "QUOTE" } });
  return { ok: true as const, quoteId: quote.id, customerPrice, currency: "GBP", activity, guests, duration, ruleId: rule.id };
}

export async function sendBubbleQuoteEmail(leadId: string, bookingUrl?: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, include: { quotes: { orderBy: { createdAt: "desc" }, take: 1 } } });
  if (!lead?.email) return { sent: false as const, reason: "missing-email" };
  const quote = lead.quotes[0];
  if (!quote || quote.status === "Draft") return { sent: false as const, reason: "quote-not-ready" };
  if (!apiKey) return { sent: false as const, reason: "resend-not-configured" };
  const req: any = lead.requirements || {};
  const price = Number(quote.customerPrice).toFixed(2);
  const link = bookingUrl || process.env.BUBBLE_BOOKING_URL || "https://bubble-leisure.vercel.app/quote";
  const from = process.env.BUBBLE_FROM_EMAIL || "Bubble Leisure <bookings@bubbleleisure.com>";
  const subject = `Your Bubble Leisure quote – £${price}`;
  const html = `<p>Hi ${lead.customerName.split(" ")[0] || lead.customerName},</p><p>Thanks for your Bubble Leisure enquiry.</p><p><strong>${String(req.activity || "Your event")}: £${price}</strong></p><p>This quote is based on the event details you've provided and remains subject to availability.</p><p><a href="${link}">Continue your booking</a></p><p>Bubble Leisure</p>`;
  const r = await fetch("https://api.resend.com/emails", { method:"POST", headers:{ authorization:`Bearer ${apiKey}`, "content-type":"application/json" }, body:JSON.stringify({ from, to:[lead.email], subject, html }) });
  const body = await r.json().catch(()=>({}));
  if (!r.ok) return { sent:false as const, reason:"resend-error", status:r.status };
  await prisma.quote.update({ where:{id:quote.id}, data:{status:"Sent"} });
  await prisma.lead.update({ where:{id:lead.id}, data:{stage:"FOLLOW_UP"} });
  return { sent:true as const, providerMessageId:String(body?.id || ""), quoteId:quote.id };
}
