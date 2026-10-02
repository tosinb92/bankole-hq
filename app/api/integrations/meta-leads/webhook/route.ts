import { NextRequest, NextResponse, after } from "next/server";
import { prisma } from "@/lib/server/prisma";
import {progressBubbleLead,flushBubbleMessages} from "@/lib/server/bubble-workflow";
import {createHmac,createHash} from "node:crypto";
import {equalSecret} from "@/lib/server/bubble-security";

export const runtime = "nodejs";

const PAGE_ID = "1098181786706854";

function normalizeUkPhone(input: unknown) {
  const raw = String(input || "").trim().replace(/[()\s-]/g, "");
  if (!raw) return null;
  if (raw.startsWith("+")) return raw;
  if (raw.startsWith("00")) return "+" + raw.slice(2);
  if (raw.startsWith("0")) return "+44" + raw.slice(1);
  if (/^44\d+$/.test(raw)) return "+" + raw;
  return null;
}

function fieldsToObject(fieldData: any[] = []) {
  const out: Record<string, string> = {};
  for (const item of fieldData) {
    const key = String(item?.name || "").trim();
    const value = Array.isArray(item?.values) ? item.values[0] : item?.value;
    if (key && value != null) out[key] = String(value);
  }
  return out;
}

function pick(fields: Record<string, string>, ...keys: string[]) {
  for (const key of keys) {
    if (fields[key] && fields[key].trim()) return fields[key].trim();
  }
  return null;
}

async function fetchLead(leadgenId: string) {
  const accessToken = process.env.META_PAGE_ACCESS_TOKEN;
  if (!accessToken) throw new Error("META_PAGE_ACCESS_TOKEN is not configured");
  const version = process.env.META_GRAPH_VERSION || "v23.0";
  const url = new URL(`https://graph.facebook.com/${version}/${encodeURIComponent(leadgenId)}`);
  url.searchParams.set("fields", "id,created_time,field_data,form_id,ad_id,adgroup_id,campaign_id");
  url.searchParams.set("access_token", accessToken);
  const response = await fetch(url, { cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Meta lead fetch failed (${response.status})`);
  return body;
}

async function startVoiceCall(lead: {
  id: string;
  customerName: string;
  phone: string | null;
  requestedLocation: string | null;
  requirements: any;
}) {
  const apiKey = process.env.VAPI_API_KEY;
  const assistantId = process.env.VAPI_ASSISTANT_ID;
  const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID;
  const serverSecret = process.env.VAPI_SERVER_SECRET;
  const baseUrl = process.env.BANKOLE_HQ_PUBLIC_URL || "https://bankole-hq.vercel.app";
  const phone = normalizeUkPhone(lead.phone);

  if (!apiKey || !assistantId || !phoneNumberId || !phone) {
    return { started: false, reason: !phone ? "missing-valid-phone" : "vapi-not-configured" };
  }

  const r = await fetch("https://api.vapi.ai/call/phone", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      assistantId,
      phoneNumberId,
      customer: {
        number: phone,
        name: lead.customerName,
      },
      assistantOverrides: {
        variableValues: {
          leadId: lead.id,
          customerName: lead.customerName,
          activity: String(lead.requirements?.activity || ""),
          duration: String(lead.requirements?.duration || ""),
          eventDateTime: String(lead.requirements?.eventDateTime || ""),
          players: String(lead.requirements?.players || ""),
          location: String(lead.requestedLocation || ""),
          source: "Facebook Instant Form",
        },
      },
      ...(serverSecret
        ? {
            server: {
              url: `${baseUrl.replace(/\/$/, "")}/api/integrations/vapi`,
              headers: { "x-bubble-voice-secret": serverSecret },
              timeoutSeconds: 20,
            },
            serverMessages: ["status-update", "end-of-call-report"],
          }
        : {}),
    }),
    cache: "no-store",
  });

  const body = await r.json().catch(() => ({}));
  if (!r.ok) {
    await prisma.call.create({
      data: {
        leadId: lead.id,
        outcome: "voice-call-failed",
        notes: `Vapi call creation failed: ${r.status} ${JSON.stringify(body)}`,
      },
    });
    return { started: false, reason: "vapi-error", status: r.status };
  }

  const providerCallId = String(body?.id || "");
  await prisma.call.create({
    data: {
      leadId: lead.id,
      outcome: "queued",
      notes: "Automatic AI follow-up call created for new Meta Instant Form lead.",
      providerCallId: providerCallId || null,
      scheduledAt: new Date(),
    },
  });
  await prisma.lead.update({ where: { id: lead.id }, data: { stage: "CALL" } });
  return { started: true, providerCallId };
}

async function ingestLeadgenId(leadgenId: string, webhookValue: any) {
  const external = await fetchLead(leadgenId);
  const fields = fieldsToObject(external?.field_data);
  const fullName =
    pick(fields, "full_name", "name") ||
    [pick(fields, "first_name"), pick(fields, "last_name")].filter(Boolean).join(" ") ||
    "Facebook lead";
  const email = pick(fields, "email");
  const phone = pick(fields, "phone_number", "phone", "mobile_number");
  const location = pick(fields, "street_address", "location", "city", "postcode", "post_code");
  const activity = pick(fields, "choose_activity", "activity");
  const duration = pick(fields, "choose_duration", "duration");
  const eventDateTime = pick(fields, "choose_date__time", "event_date", "preferred_date", "date");
  const players = pick(fields, "number_of_players", "players", "number_of_guests", "guests");

  const venture = await prisma.venture.findUnique({ where: { name: "Bubble Leisure" } });
  if (!venture) throw new Error("Bubble Leisure venture is not present in HQ.");

  const duplicate = await prisma.lead.findFirst({
    where: {
      ventureId: venture.id,
      OR: [{requirements:{path:["metaLeadId"],equals:leadgenId}},{requirements:{path:["facebookLeadId"],equals:leadgenId}}],
    },
  });
  if (duplicate) { if((duplicate.requirements as any)?.workflowVersion==="customer-flow-v1")await progressBubbleLead(duplicate.id); return { created: false, leadId: duplicate.id, duplicate: true }; }

  const requirements = {
    source: "Facebook Instant Form",
    provider: "Meta Webhook",
    workflowVersion:"customer-flow-v1",
    metaLeadId: leadgenId,
    pageId: String(webhookValue?.page_id || ""),
    formId: String(external?.form_id || webhookValue?.form_id || ""),
    campaignId: String(external?.campaign_id || ""),
    adSetId: String(external?.adgroup_id || ""),
    adId: String(external?.ad_id || ""),
    activity,
    duration,
    eventDateTime,
    players,
    submittedAt: external?.created_time || null,
    rawFields: fields,
  };

  const lead = await prisma.lead.upsert({
    where:{id:`bubble-meta-${createHash("sha256").update(leadgenId).digest("hex").slice(0,40)}`},
    update:{},
    create: {
      id:`bubble-meta-${createHash("sha256").update(leadgenId).digest("hex").slice(0,40)}`,
      ventureId: venture.id,
      customerName: fullName,
      email,
      phone,
      requestedLocation: location,
      requirements,
      stage: "NEW_LEAD",
    },
  });

  // If the Instant Form already contains enough information and HQ has an exact
  // active pricing rule, create/send the quote immediately. Otherwise the lead
  // remains available for voice qualification or a pricing task.
  const pricing = await progressBubbleLead(lead.id);
  const message = {queued:true};

  const voice = await startVoiceCall({
    id: lead.id,
    customerName: lead.customerName,
    phone: lead.phone,
    requestedLocation: lead.requestedLocation,
    requirements,
  });

  return { created: true, leadId: lead.id, duplicate: false, pricing, message, voice };
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN;

  if (mode === "subscribe" && verifyToken && token === verifyToken && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json(
    {
      ok: true,
      integration: "Bubble Leisure Meta Instant Forms",
      pageId: PAGE_ID,
      verificationConfigured: Boolean(verifyToken),
      metaAccessConfigured: Boolean(process.env.META_PAGE_ACCESS_TOKEN),
      voiceConfigured: Boolean(
        process.env.VAPI_API_KEY &&
          process.env.VAPI_ASSISTANT_ID &&
          process.env.VAPI_PHONE_NUMBER_ID
      ),
    },
    { status: mode ? 403 : 200 }
  );
}

export async function POST(request: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "HQ data connection is unavailable." }, { status: 503 });
  }

  const appSecret=process.env.META_APP_SECRET;
  if(!appSecret)return NextResponse.json({error:"Meta webhook signature verification is not configured"},{status:503});
  const raw=await request.text();
  const expected=`sha256=${createHmac('sha256',appSecret).update(raw).digest('hex')}`;
  if(!equalSecret(request.headers.get('x-hub-signature-256'),expected))return NextResponse.json({error:"Invalid signature"},{status:401});
  let body;try{body=JSON.parse(raw);}catch{return NextResponse.json({error:"Invalid payload"},{status:400});}
  if (!body || body.object !== "page" || !Array.isArray(body.entry)) {
    return NextResponse.json({ error: "Unsupported Meta webhook payload." }, { status: 400 });
  }

  const leadEvents: any[] = [];
  for (const entry of body.entry) {
    for (const change of Array.isArray(entry?.changes) ? entry.changes : []) {
      if (change?.field !== "leadgen") continue;
      const value = change?.value || {};
      if (PAGE_ID && value?.page_id && String(value.page_id) !== PAGE_ID) continue;
      if (!value?.leadgen_id) continue;
      leadEvents.push(value);
    }
  }

  const results = [];
  for (const value of leadEvents) {
    try {
      results.push(await ingestLeadgenId(String(value.leadgen_id), value));
    } catch (error) {
      console.error("Bubble Leisure Meta lead ingestion failed");
      results.push({
        created: false,
        leadgenId: String(value.leadgen_id),
        error: "Ingestion failed; retry required",
      });
    }
  }

  after(async()=>{await flushBubbleMessages();});
  return NextResponse.json({ received: true, processed: results.length, results },{status:results.some(x=>"error" in x)?503:200});
}
