# Bankole HQ

Private operating system for Bankole & Associates and its ventures.

## Current state

This repository was initialised without application code, configuration, deployment files, workflows, or a database schema. This document establishes the initial product boundary so implementation can begin without overwriting any pre-existing work.

## Product goal

One private workspace to manage:

- ventures, opportunities and deal pipelines
- contacts, tasks and follow-ups
- revenue, costs and personal/business cash-flow visibility
- reusable playbooks and AI-assisted operating workflows

## Recommended first release

Build one secure dashboard focused on the immediate operating loop:

1. **Dashboard** — today's priorities, cash snapshot, upcoming follow-ups.
2. **Deals** — opportunities, value, stage, owner, next action and documents.
3. **Tasks** — tasks linked to a venture or deal, with due dates and status.
4. **Ventures** — a concise profile and key metrics for each business.

Keep integrations read-only or manual-entry first. Add messaging, calling, bank feeds, scraping, automations and public-facing tools only after the core data model and permissions are stable.

## Proposed architecture

- **Web app:** Next.js + TypeScript
- **UI:** Tailwind CSS + accessible component library
- **Data/auth:** Supabase (Postgres, Auth, Row Level Security, Storage)
- **Deployment:** Vercel
- **Automation:** server-side API routes/background jobs; secrets held only in deployment settings

This is a recommendation, not an installed stack.

## Initial data model

- `users`
- `ventures`
- `contacts`
- `deals`
- `deal_activities`
- `tasks`
- `documents`
- `financial_entries`

Every record should support ownership, created/updated timestamps and optional venture/deal links. No API keys or personal financial credentials belong in client code or committed files.

## Next implementation step

Scaffold the authenticated Next.js application with Supabase connected, then ship the `ventures`, `deals`, and `tasks` data model and basic CRUD screens before adding automations or third-party integrations.

## Repository conventions

- Keep secrets in environment variables only; commit an `.env.example` with placeholders.
- Protect `main`; work through branches and pull requests once collaborators are involved.
- Add tests alongside business logic and run them in CI before deployment.
