import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const checks = {
    database: Boolean(process.env.DATABASE_URL),
    metaAppSecret: Boolean(process.env.META_APP_SECRET),
    websiteServiceSecret: Boolean(process.env.BUBBLE_SERVICE_SECRET),
    emailSender: Boolean(process.env.RESEND_API_KEY && process.env.BUBBLE_FROM_EMAIL),
    payments: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET),
    scheduledWorker: Boolean(process.env.CRON_SECRET),
    metaWebhookVerifyToken: Boolean(process.env.META_WEBHOOK_VERIFY_TOKEN),
    metaPageAccessToken: Boolean(process.env.META_PAGE_ACCESS_TOKEN),
    vapiApiKey: Boolean(process.env.VAPI_API_KEY),
    vapiAssistantId: Boolean(process.env.VAPI_ASSISTANT_ID),
    vapiPhoneNumberId: Boolean(process.env.VAPI_PHONE_NUMBER_ID),
    vapiServerSecret: Boolean(process.env.VAPI_SERVER_SECRET),
    publicUrl: Boolean(process.env.BANKOLE_HQ_PUBLIC_URL),
  };

  const required = [
    "database",
    "metaAppSecret",
    "websiteServiceSecret",
    "emailSender",
    "payments",
    "scheduledWorker",
    "metaWebhookVerifyToken",
    "metaPageAccessToken",
    "vapiApiKey",
    "vapiAssistantId",
    "vapiPhoneNumberId",
  ] as const;

  const ready = required.every((key) => checks[key]);

  return NextResponse.json({
    ready,
    system: "Bubble Leisure automated lead conversion",
    flow: [
      "Meta Instant Form webhook",
      "Bankole HQ lead creation",
      "Automatic Vapi outbound call",
      "Call status/transcript saved to HQ",
      "No-answer follow-up task",
      "Private customer booking page",
      "Availability and commercial terms approval",
      "Stripe Checkout and verified payment reconciliation",
      "Confirmed booking and event reminder",
    ],
    checks,
    endpoints: {
      metaWebhook: "/api/integrations/meta-leads/webhook",
      vapiWebhook: "/api/integrations/vapi",
    },
  });
}
