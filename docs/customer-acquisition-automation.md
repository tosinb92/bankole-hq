# Customer acquisition and revenue automation — implementation plan
Status: implementation specification, NOT a live integration. Do not display seeded/demo numbers as actual results.

## Shared funnel
Source (ads, content, outreach, referral) -> lead capture (UTM, source, consent/lawful basis) -> dedupe -> qualification -> personalised follow-up -> meeting/quote/proposal -> signed agreement or paid deposit -> fulfilment onboarding -> review/referral. Each transition creates an immutable activity and an owner/next action. Every inbound reply must be attached to its contact and opportunity. Stop follow-ups on opt-out, bounce, closed-lost, or human takeover. Payment and contract events must be verified from Stripe/DocuSign webhooks, never inferred from messages.

## FIRECOMPLIANCEUK
Two distinct funnels: service providers and demand-side property/FM buyers.
Provider: outreach -> reply -> registration -> credentials/services/coverage/rate bands -> verification -> approved supplier -> matched opportunity. Buyer: prospecting/SEO/content -> registration or enquiry -> property and compliance scope -> qualified opportunity -> provider match -> approved quote -> acceptance -> invoice/payment -> delivery.
Integrate Resend sent/delivered/bounced/replied and website registrations. Maintain a suppression list and dedupe across spreadsheets and CRM. Do not resend to contacted contacts except permitted follow-ups or positive replies. Do not claim provider verified without review.

## Bankole & Associates
Inbound/referral -> discuss mandate -> qualification (business, jurisdiction, investment amount, use of funds, readiness) -> conflict/compliance review -> engagement terms -> signed mandate -> data room/documents -> internal investor matching -> introductions -> milestone invoices and payment. Investor database and matching are OWNER-only, never shown in client portal. Each client has its own deal workspace, correspondence, documents and next action. Investments4all contract entity versus trading brand must be verified in engagement templates before sending.

## Brilliant AI Automations (BAA)
Short videos and founder-led outreach -> automation diagnosis form -> qualify budget/process/tools -> consultation -> scoped blueprint and tier -> proposal -> payment -> client-owned GitHub/Supabase/Vercel/OpenAI onboarding -> delivery and handover -> optional support. Don't provision paid resources or send proposals with unapproved scope/prices.

## Bubble Leisure
Meta short-form ads, school/community outreach, organic social -> mobile enquiry form (postcode, date, activity, age, group size) -> availability/venue and staffing check -> margin-safe quote -> deposit payment -> confirmed booking -> automated event instructions -> event -> review/referral. Never confirm availability before venue and staff confirmation.

## HQ data contracts
Common: venture_id, source_system, external_id, contact_id, organisation_id, lead/deal_id, campaign_id, event_type, occurred_at, payload, idempotency_key, last_synced_at, consent_status, owner_id, next_action_at. Events: lead.created, lead.qualified, email.sent, email.delivered, email.bounced, email.replied, meeting.booked, quote.sent, proposal.accepted, mandate.signed, invoice.issued, payment.succeeded, booking.confirmed, onboarding.completed. Persist raw source event and derived action. Dedupe by source_system + external_id + event_type; reconcile nightly.

## Cross-chat capture
No native account-wide ChatGPT transcript webhook is verified. Only ingest authorised structured actions from available connectors or an explicitly implemented supported ingestion path. Mark chat ideas as proposed, not approved or completed. Never represent a chat decision as deployed until verified.

## Automation gates
Auto: ingest, dedupe, classify, summarise, generate drafts, task creation, routine compliant follow-ups under approved templates and limits.
Approval: new campaigns, commercial terms, contractual changes, bulk sends, supplier approval, paid ad budget, investor introductions.
Human: legal/compliance sign-off, nonstandard deals, disputes, sensitive decisions.

## Revenue dashboard (actual data only)
Per venture: spend, reach, leads, qualified leads, response rate, meetings, proposals, signed contracts, paid revenue, CAC, gross margin, time to first response, time in stage, overdue actions. Mark metrics UNAVAILABLE when disconnected; never substitute demos.

## Delivery sequence
P0: verify live environments and data ownership; connect existing sources read-only; fix real-vs-demo labelling; ensure suppressions and opt-outs.
P1: inbound capture, CRM dedupe, reply classification and next actions for all four brands.
P2: stage-specific onboarding and quote/mandate/payment automations, tested end to end per brand.
P3: campaign attribution, content scheduling, conversion analytics, optimisation.
Acceptance test per brand: create test lead -> confirm source attribution -> reply -> qualify -> generate correct quote/proposal -> approve -> sign/pay sandbox -> update HQ -> stop follow-ups -> report real funnel status.