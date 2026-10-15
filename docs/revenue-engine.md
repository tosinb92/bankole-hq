# Revenue Engine: initial integrated release

The /revenue-engine page reads the existing HQ Venture, Lead and Task tables. It has business/search filters, clickable record counts, sourced signal capture, deterministic scoring, next-action editing, dated follow-up tasks, unsent draft storage, existing offer links, suppression and acceptance evidence. Source records in other business CRMs remain authoritative. Revenue-prefixed HQ tasks point back to those records rather than copying their customer data.

Access uses an existing HQ MCP bearer token or a separate server-only REVENUE_ACCESS_KEY. The owner capability may be delivered in a URL fragment (#access=...), consumed into page memory and immediately removed from the visible URL; it is never a public environment variable or included in the repository. The page itself contains no private records until authentication succeeds. The capability grants portfolio-wide owner access. Do not share it with staff or prospects. Rotate the dedicated environment secret to revoke that link. No existing user accounts/auth flows are changed.

The existing five HQ MCP tools remain unchanged; get_revenue_engine, ingest_buying_signal and progress_revenue_lead are additive. Data uses existing Lead.requirements.revenueEngine JSON; no schema migration or separate CRM is required. Ingestion serializes a business/source key with a transaction advisory lock. Progress edits use updatedAt optimistic concurrency. No external messages are sent by these methods.

A six-hour Work automation, Bankole Revenue Follow-through, has been enabled separately. It coordinates with the existing FireComplianceUK sweep and approval rules. Scheduling success does not establish successful future execution. Every run must report actual writes and access failures. Its FireComplianceUK work creates pointers/tasks; it does not recreate that business's CRM.

## Verified

- TypeScript check and production build pass locally.
- 23 automated checks pass, including signal confidence caps, expired/stale sources, financial/contact provenance validation, canonical URLs, dedup preservation, scheduled tasks, suppression and stale edit prevention.
- Existing Bubble webhook checks pass. Bubble pricing tests were stale relative to the already-implemented owner calculator; tests now verify its confirmed-charge/cost and sent-quote safeguards. Production Bubble pricing code was not changed.
- Missing portfolio venture configurations were inserted and read back; VEYRO is explicitly prelaunch.
- The existing West Lancashire domestic FRA opportunity was found in the authoritative FireComplianceUK database (last source verification 14 October); a dated delivery-partner/portal eligibility task was inserted into HQ. It is not a newly verified buyer or sale.

## Release status

The owner explicitly approved publishing these changes to the existing public repository and deployment on 15 October 2026. The separate scheduled workflow and read-back-verified HQ configuration/task writes are active. Deployment readiness must be verified from Vercel and live endpoint responses before reporting this module as live.

## Still required for complete master prompt

- Actual end-to-end live verification of email approval/send, inbound reply and suppression synchronisation for each brand.
- Reconcile BAA saved sender identities with its actual authorised business mailbox. Its original Supabase project is currently INACTIVE.
- Automatic quote/checkout generation, signing and trusted payment webhook reconciliation. The initial page links existing offers; it does not create prices, charge customers or verify receipts.
- Scheduled job execution evidence, broader source coverage, error notifications and per-brand scoring settings.
- Competitor research and evidence-backed proposals for each qualified prospect.
- Full eight-page module; the initial release is one integrated actionable workspace.
- Normal owner account sign-in; the initial release uses a private scoped capability.

Won/accepted records are never reported as collected revenue. No live customer send or payment was used for testing. No subscriptions or paid APIs were purchased.
