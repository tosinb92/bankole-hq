import type {Prisma} from "@prisma/client";
import { prisma } from "@/lib/server/prisma";

function num(v: unknown) {
  const raw = String(v ?? "").replace(/[^0-9.]/g, "");
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}
function norm(v: unknown) { return String(v ?? "").trim().toLowerCase(); }

export async function calculateBubbleQuote(leadId: string) {
 return prisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${leadId}))`;
  return calculateLocked(leadId,tx);
 },{timeout:15000});
}
async function calculateLocked(leadId: string, db:Prisma.TransactionClient) {
  const lead = await db.lead.findUnique({ where: { id: leadId }, include: { venture: true } });
  if (!lead || lead.venture.name !== "Bubble Leisure") return { ok: false as const, reason: "lead-not-found" };
  const existing = await db.quote.findFirst({where:{leadId, status:{in:["Ready","Sent","Accepted","Paid"]}},orderBy:{createdAt:"desc"}});
  if(existing) return {ok:true as const,quoteId:existing.id,customerPrice:Number(existing.customerPrice),currency:"GBP"};
  const req: any = lead.requirements || {};
  const activity = String(req.activity || "").trim();
  const guests = num(req.players || req.guests);
  const duration = num(req.duration);
  if (!activity || !guests || !duration) return { ok: false as const, reason: "missing-requirements", missing: [!activity && "activity", !guests && "group-size", !duration && "duration"].filter(Boolean) };

  const rules = await db.pricingRule.findMany({ where: { ventureId: lead.ventureId, active: true } });
  // Approved pricing from the current Bubble Leisure Pricing sheet.
  // Red/excluded offers are deliberately absent.
  const approvedOffer = ["bubble football","nerf wars","dodgeball"].includes(norm(activity)) && /kids|birthday/i.test(String(req.occasion || ""));
  const approvedBase = approvedOffer ? (duration === 60 ? 250 : duration === 90 ? 300 : null) : null;
  const approvedPrice = approvedBase == null ? null : approvedBase + Math.max(0, guests - 10) * 10;
  const candidates = rules.filter(r => {
    if (norm(r.activity) !== norm(activity)) return false;
    if (r.customerType && norm(r.customerType) !== norm(req.customerType || req.occasion)) return false;
    if (r.groupMin != null && guests < r.groupMin) return false;
    if (r.groupMax != null && guests > r.groupMax) return false;
    if (r.durationMinutes != null && duration != null && Math.abs(r.durationMinutes - duration) > 1) return false;
    return true;
  });
  if (!candidates.length) {
    if (approvedPrice == null) return { ok: false as const, reason: "no-authoritative-pricing-rule", activity, guests, duration };
    const customerPrice = approvedPrice;
    let quote = await db.quote.findFirst({ where: { leadId: lead.id, status: { in: ["Draft","Ready","Sent"] } }, orderBy: { createdAt: "desc" } });
    if (!quote) quote = await db.quote.create({ data: { leadId: lead.id, customerPrice, directCosts: 0, grossProfit: customerPrice, status: "Ready" } });
    await db.lead.update({ where: { id: lead.id }, data: { estimatedValue: customerPrice, stage: "QUOTE" } });
    return { ok: true as const, quoteId: quote.id, customerPrice, currency: "GBP", activity, guests, duration, ruleId: "approved-sheet-v1" };
  }

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
  let quote = await db.quote.findFirst({ where: { leadId: lead.id, status: { in: ["Draft","Ready","Sent"] } }, orderBy: { createdAt: "desc" } });
  if (!quote) quote = await db.quote.create({ data: { leadId: lead.id, customerPrice, directCosts, grossProfit, status: "Ready" } });
  await db.lead.update({ where: { id: lead.id }, data: { estimatedValue: customerPrice, stage: "QUOTE" } });
  return { ok: true as const, quoteId: quote.id, customerPrice, currency: "GBP", activity, guests, duration, ruleId: rule.id };
}

export async function sendBubbleQuoteEmail(leadId: string, _bookingUrl?: string) {
  const {queueBubbleMessage,flushBubbleMessages} = await import('./bubble-workflow');
  await queueBubbleMessage(leadId,'quote');
  const result=await flushBubbleMessages();
  return {sent:result.sent>0,reason:result.blocked || 'queued-or-delivered'};
}
