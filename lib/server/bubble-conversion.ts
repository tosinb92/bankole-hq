import { prisma } from "@/lib/server/prisma";

// Prices transcribed from the owner's calculator, updated 5 June 2026.
// This is a saved version, not a live Google Sheets connection.
export const BUBBLE_PRICING_SOURCE = "https://docs.google.com/spreadsheets/d/13a7kU08fnmi2Fi0OMZoYL2FMIbvG5eMnbmjQTASeYs0/edit";
function num(v: unknown) {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const text = String(v ?? "").trim();
  if (!/^£?\s*\d+(?:\.\d+)?$/.test(text)) return null;
  return Number(text.replace(/[£\s]/g, ""));
}
function norm(v: unknown) { return String(v ?? "").trim().toLowerCase(); }
function minutes(v: unknown) {
  const text = norm(v);
  const match = text.match(/^(\d+(?:\.\d+)?)\s*(minutes?|mins?|hours?|hrs?)?$/);
  if (!match) return null;
  return Number(match[1]) * (/^(hour|hr)/.test(match[2] || "") ? 60 : 1);
}
export function estimateBubblePrice(req: any) {
  const activity = String(req.activity || "").trim();
  const guests = num(req.players ?? req.guests);
  const duration = minutes(req.duration);
  if (!activity || guests == null || guests < 1 || !Number.isInteger(guests) || duration == null)
    return { ok: false as const, reason: "missing-or-unclear-requirements" };
  const packageName = norm(req.package || activity);
  const combo = /combo|2 activit|two activit/.test(packageName);
  const premium = /premium/.test(packageName);
  const basePrice = combo ? (duration === 90 ? (premium ? 395 : 350) : null)
    : premium ? null : duration === 60 ? 250 : duration === 90 ? 300 : null;
  if (basePrice == null) return { ok: false as const, reason: "package-requires-review" };
  const extraPlayers = Math.max(0, guests - 10);
  const activityPrice = basePrice + extraPlayers * 10;
  // Never interpret unanswered venue/travel questions as free.
  const venueFee = num(req.venueFee);
  const travelFee = num(req.travelFee);
  const addOnFee = num(req.addOnFee);
  const missing = [
    (venueFee == null || venueFee < 0) && "venue-charge",
    (travelFee == null || travelFee < 0) && "travel-charge",
    (addOnFee == null || addOnFee < 0) && "add-ons"
  ].filter(Boolean);
  const total = missing.length ? null : activityPrice + venueFee! + travelFee! + addOnFee!;
  return { ok: true as const, activity, guests, duration, basePrice, extraPlayers,
    extraPlayerCharge: extraPlayers * 10, activityPrice, customerPrice: total,
    depositAmount: 50, balanceAmount: total == null ? null : total - 50,
    currency: "GBP", missing, pricingSource: BUBBLE_PRICING_SOURCE };
}

export async function calculateBubbleQuote(leadId: string) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, include: { venture: true } });
  if (!lead || lead.venture.name !== "Bubble Leisure") return { ok: false as const, reason: "lead-not-found" };
  const req: any = lead.requirements || {};
  const estimate = estimateBubblePrice(req);
  if (!estimate.ok) return estimate;
  await prisma.lead.update({ where: { id: lead.id }, data: {
    estimatedValue: estimate.customerPrice ?? estimate.activityPrice
  } });
  if (estimate.customerPrice == null) return { ...estimate, ok: false as const, reason: "charges-require-confirmation" };
  // The calculator contains selling prices, not the actual cost of delivering an event.
  // Require confirmed costs rather than reporting fictitious profit.
  const directCosts = num(req.confirmedDirectCosts);
  if (directCosts == null || directCosts < 0)
    return { ...estimate, ok: false as const, reason: "delivery-costs-require-confirmation" };
  const customerPrice = estimate.customerPrice;
  const grossProfit = customerPrice - directCosts;
  let quote = await prisma.quote.findFirst({ where: { leadId: lead.id, status: { in: ["Draft","Ready","Sent"] } }, orderBy: { createdAt: "desc" } });
  if (quote?.status === "Sent" && Number(quote.customerPrice) !== customerPrice) return { ok: false as const, reason: "sent-quote-requires-review" };
  if (!quote) quote = await prisma.quote.create({ data: { leadId: lead.id, customerPrice, directCosts, grossProfit, status: "Ready" } });
  else if (quote.status !== "Sent") quote = await prisma.quote.update({ where: { id: quote.id }, data: { customerPrice, directCosts, grossProfit, status: "Ready" } });
  await prisma.lead.update({ where: { id: lead.id }, data: { estimatedValue: customerPrice, stage: "QUOTE" } });
  return { ...estimate, ok: true as const, quoteId: quote.id };
}

export async function sendBubbleQuoteEmail(leadId: string, bookingUrl?: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, include: { quotes: { orderBy: { createdAt: "desc" }, take: 1 } } });
  if (!lead?.email) return { sent: false as const, reason: "missing-email" };
  const quote = lead.quotes[0];
  if (quote?.status === "Sent") return { sent: false as const, reason: "already-sent", quoteId: quote.id };
  if (!quote || quote.status !== "Ready") return { sent: false as const, reason: "quote-not-ready" };
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
