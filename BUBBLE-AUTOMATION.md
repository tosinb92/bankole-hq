# Bubble Leisure customer flow

Companion website: `tosinb92/bubble-leisure`. HQ stores all customer, quote and booking data in its existing database. The implemented lead/payment pieces require no schema migration. Fully automatic resource scheduling is still outstanding.

## Implemented

- Website enquiries create an idempotent Lead, not just an alert.
- Exact active pricing rules generate quotes; the existing kids pricing sheet applies only to Bubble Football, Nerf Wars or Dodgeball birthday enquiries with 60/90 minute duration. Other enquiries receive a private details link and a review task.
- Signed customer links expire after 60 days. The website exchanges the fragment token for an HttpOnly cookie. Internal costs are excluded from customer responses.
- Customers can complete event details. Changes invalidate the old quote before repricing.
- Website `/owner` opens the existing private Bubble Leisure HQ at `https://bubble-leisure-hq.tosin-bankole20.chatgpt.site`. Its Ad automation tab displays the same HQ lead records through a server-only bridge; no second owner login is created.
- Approval records venue, staffing/equipment confirmation, event instant, total, amount due now and explicit customer terms. No deposit or cancellation policy is invented.
- Stripe Checkout uses server amounts and idempotency. Signed Stripe events verify session, approval, quote, GBP currency and paid amount before creating a confirmed Booking. A browser success redirect cannot confirm a booking.
- A persisted transactional email queue sends enquiry/quote, confirmation and event reminder messages. Immediate delivery runs after the response; the daily worker retries pending work.
- Meta webhook signature validation, cross-source Facebook deduplication and protected customer management endpoints.

## Required runtime settings

Set secrets in Vercel project settings; never put them in Git or chat.

| Project | Variable | Purpose |
| --- | --- | --- |
| Website, existing private HQ and HQ backend | `BUBBLE_SERVICE_SECRET` | Same new random value, at least 32 bytes; scoped website/HQ connection and customer link signatures. Do not rotate the existing generic HQ webhook credential. |
| HQ | `RESEND_API_KEY` | Sending key restricted to an approved domain. |
| HQ | `BUBBLE_FROM_EMAIL` | Verified Bubble Leisure sender, e.g. `Bubble Leisure <bookings@your-verified-domain>`. |
| HQ | `STRIPE_SECRET_KEY` | Start with the test-mode key; use live mode only after verification. |
| HQ | `STRIPE_WEBHOOK_SECRET` | Matching webhook signing secret. |
| HQ | `META_APP_SECRET` | Signing secret for the Meta app delivering the page lead webhook. |
| HQ | `CRON_SECRET` | At least 32 random bytes, protects `/api/bubble/worker`. |
| HQ | `VAPI_PHONE_NUMBER_ID` | Existing configured outbound number; do not buy a number automatically. |

Existing HQ database, Meta page token, webhook verification token, Vapi API/assistant/server secrets and public URL settings remain in use.

For controlled preview testing, set website `BUBBLE_HQ_URL` to the paired HQ preview origin and HQ `BUBBLE_WEBSITE_URL` to the paired website preview origin. Both default to the production origins when unset. Preview and production credentials/environments must be kept separate.

## External setup and deployment order

1. Configure the same scoped service credential on both Vercel projects and the existing private HQ runtime. Preserve the existing private HQ access controls. Browser credential/access changes need explicit approval or secure owner entry.
2. Verify the Bubble Leisure sending domain in Resend, then set the sender and sending key. No Bubble Leisure domain is verified in the connected account as of 2 October 2026.
3. Create a Stripe test webhook for `https://bankole-hq.vercel.app/api/bubble/payments/webhook`, subscribing to `checkout.session.completed` and `checkout.session.async_payment_succeeded`; set its signing secret.
4. Set the Meta app signing secret, verify the existing page webhook subscription actually delivers `leadgen` events for page `1098181786706854`, and submit a test lead. The signature gate intentionally rejects delivery until configured. No ad campaign changes are needed.
5. Configure the existing Vapi number if automatic calls are desired. The existing call route retains its current behaviour; phone consent, calling hours and failed-call retry policy still need operational review before live calls are enabled.
6. Deploy HQ first, then the website. The scoped website integration requires the new HQ intake response containing `leadId` and `bookingUrl`.
7. Verify with a controlled enquiry and Stripe test payment. Check one Lead/Quote/Booking, no duplicate emails on retries, recorded terms acceptance, payment amount and owner visibility. Then switch Stripe keys/webhook to matching live mode.
8. Verify the daily Vercel cron at 08:00 UTC. Provider configuration flags are not delivery proof.

## Availability and commercial controls

The current repos contain no authoritative staffing/equipment calendar or venue booking integration. The initial implementation retains an availability approval gate, which does not satisfy the requested fully unattended operation. The user explicitly requires humans only to arrive and host; automatic resource reservation, host assignment and host instructions are outstanding. Fully automatic availability requires the actual calendar/booking provider, capacity rules, staff/equipment resources and approved payment/cancellation policy. Do not replace those with a fabricated availability flag.

Payment is disabled without both Stripe credentials. Customer confirmations require verified payment and a prior availability approval. Historic Windsor imports do not trigger a bulk messaging or call campaign. This release does not automate balance collection, refunds, cancellations or calendar rescheduling.

Failed email attempts older than the provider's 24-hour idempotency window remain pending for manual review. This avoids duplicate messages after uncertain outcomes. Owner access lists at most 200 latest leads; pagination and long-term operational monitoring are follow-up requirements before larger volumes.

## Verification completed locally

- Website and HQ `npm run build`: passed, with existing CSS compatibility warnings.
- `node --test tests/bubble-workflow.test.cjs`: five tests passed (forged/expired access, duplicate payments, mismatched payment details, unpaid/non-GBP events, missing webhook gate).
- Both apps upgraded to Next.js 15.5.27.
- No live customer emails, calls, charges or bookings created during development.

The live end-to-end flow is **not verified or activated** until the runtime and external setup above is complete.
