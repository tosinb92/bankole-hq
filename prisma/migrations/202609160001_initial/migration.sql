-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "SystemRole" AS ENUM ('OWNER', 'VENTURE_ADMIN', 'SALES', 'OPERATIONS', 'FINANCE', 'ASSOCIATE', 'VIEWER');

-- CreateEnum
CREATE TYPE "LeadStage" AS ENUM ('NEW_LEAD', 'REQUIREMENTS', 'VENUE_SOURCING', 'PRICING', 'CALL', 'QUOTE', 'FOLLOW_UP', 'DEPOSIT', 'VENUE_SECURED', 'CONFIRMED', 'EVENT', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "VenuePriceStatus" AS ENUM ('ESTIMATED', 'HISTORICAL', 'VERIFIED', 'BOOKED');

-- CreateEnum
CREATE TYPE "AiJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'NEEDS_APPROVAL', 'COMPLETED', 'FAILED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" "SystemRole" NOT NULL DEFAULT 'VIEWER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Venture" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sector" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Venture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VentureMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ventureId" TEXT NOT NULL,
    "role" "SystemRole" NOT NULL,
    "canViewFinancials" BOOLEAN NOT NULL DEFAULT false,
    "canViewCosts" BOOLEAN NOT NULL DEFAULT false,
    "canViewMargins" BOOLEAN NOT NULL DEFAULT false,
    "canViewCommissions" BOOLEAN NOT NULL DEFAULT false,
    "canManageMembers" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VentureMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deal" (
    "id" TEXT NOT NULL,
    "ventureId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "value" DECIMAL(12,2),
    "sensitiveFinancials" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "canViewFinancials" BOOLEAN NOT NULL DEFAULT false,
    "canEdit" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "DealAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organisation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT,
    "website" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organisation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "role" TEXT,
    "ventureId" TEXT,
    "organisationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "ventureId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "requestedLocation" TEXT,
    "postcode" TEXT,
    "requirements" JSONB,
    "stage" "LeadStage" NOT NULL DEFAULT 'NEW_LEAD',
    "estimatedValue" DECIMAL(12,2),
    "assignedToId" TEXT,
    "venueId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Venue" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "postcode" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "facilities" JSONB,
    "permittedActivities" JSONB,
    "capacity" INTEGER,
    "dimensions" TEXT,
    "price" DECIMAL(12,2),
    "pricingUnit" TEXT,
    "priceStatus" "VenuePriceStatus" NOT NULL DEFAULT 'ESTIMATED',
    "sourceUrl" TEXT,
    "priceVerifiedAt" TIMESTAMP(3),
    "availabilityStatus" TEXT,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "bookingMethod" TEXT,
    "depositRequirement" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Venue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricingRule" (
    "id" TEXT NOT NULL,
    "ventureId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "activity" TEXT NOT NULL,
    "customerType" TEXT NOT NULL,
    "durationMinutes" INTEGER,
    "groupMin" INTEGER,
    "groupMax" INTEGER,
    "basePriceMin" DECIMAL(12,2) NOT NULL,
    "basePriceMax" DECIMAL(12,2) NOT NULL,
    "staffingCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "equipmentCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "travelCostPerMile" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "minMarginPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "extras" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PricingRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "customerPrice" DECIMAL(12,2) NOT NULL,
    "directCosts" DECIMAL(12,2) NOT NULL,
    "grossProfit" DECIMAL(12,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Call" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "notes" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "providerCallId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Call_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "ventureId" TEXT NOT NULL,
    "venueId" TEXT,
    "status" TEXT NOT NULL,
    "eventAt" TIMESTAMP(3),
    "depositAmount" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "priority" INTEGER NOT NULL DEFAULT 3,
    "dueAt" TIMESTAMP(3),
    "ventureId" TEXT,
    "leadId" TEXT,
    "assigneeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiJob" (
    "id" TEXT NOT NULL,
    "ventureId" TEXT NOT NULL,
    "skillId" TEXT,
    "title" TEXT NOT NULL,
    "input" JSONB,
    "output" JSONB,
    "status" "AiJobStatus" NOT NULL DEFAULT 'QUEUED',
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "approvedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "error" TEXT,
    "integrationKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sourceUrl" TEXT,
    "integrationKey" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "ventureId" TEXT,
    "title" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "type" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RevenueEntry" (
    "id" TEXT NOT NULL,
    "ventureId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RevenueEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Venture_name_key" ON "Venture"("name");

-- CreateIndex
CREATE UNIQUE INDEX "VentureMembership_userId_ventureId_key" ON "VentureMembership"("userId", "ventureId");

-- CreateIndex
CREATE UNIQUE INDEX "DealAssignment_userId_dealId_key" ON "DealAssignment"("userId", "dealId");

-- CreateIndex
CREATE INDEX "PricingRule_ventureId_activity_idx" ON "PricingRule"("ventureId", "activity");

-- CreateIndex
CREATE UNIQUE INDEX "Skill_name_key" ON "Skill"("name");

-- AddForeignKey
ALTER TABLE "VentureMembership" ADD CONSTRAINT "VentureMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VentureMembership" ADD CONSTRAINT "VentureMembership_ventureId_fkey" FOREIGN KEY ("ventureId") REFERENCES "Venture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_ventureId_fkey" FOREIGN KEY ("ventureId") REFERENCES "Venture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealAssignment" ADD CONSTRAINT "DealAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealAssignment" ADD CONSTRAINT "DealAssignment_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_ventureId_fkey" FOREIGN KEY ("ventureId") REFERENCES "Venture"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_ventureId_fkey" FOREIGN KEY ("ventureId") REFERENCES "Venture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PricingRule" ADD CONSTRAINT "PricingRule_ventureId_fkey" FOREIGN KEY ("ventureId") REFERENCES "Venture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Call" ADD CONSTRAINT "Call_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_ventureId_fkey" FOREIGN KEY ("ventureId") REFERENCES "Venture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiJob" ADD CONSTRAINT "AiJob_ventureId_fkey" FOREIGN KEY ("ventureId") REFERENCES "Venture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_ventureId_fkey" FOREIGN KEY ("ventureId") REFERENCES "Venture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevenueEntry" ADD CONSTRAINT "RevenueEntry_ventureId_fkey" FOREIGN KEY ("ventureId") REFERENCES "Venture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Database-level tenancy and financial-data boundary.
-- The authenticated server must set `app.user_id` per transaction from the verified session.
-- Never expose the direct Postgres connection or a service-role key to a browser.
CREATE FUNCTION app_current_user_id() RETURNS text
LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.user_id', true), '') $$;
CREATE FUNCTION app_is_owner() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (SELECT 1 FROM "User" WHERE id = app_current_user_id() AND role = 'OWNER')
$$;
CREATE FUNCTION app_can_access_venture(target_venture_id text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT app_is_owner() OR EXISTS (
    SELECT 1 FROM "VentureMembership" m
    WHERE m."userId" = app_current_user_id() AND m."ventureId" = target_venture_id
  )
$$;
CREATE FUNCTION app_can_view_financials(target_venture_id text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT app_is_owner() OR EXISTS (
    SELECT 1 FROM "VentureMembership" m
    WHERE m."userId" = app_current_user_id() AND m."ventureId" = target_venture_id
    AND m."canViewFinancials" = true
  )
$$;
CREATE FUNCTION app_can_access_lead(target_lead_id text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT app_is_owner() OR EXISTS (
    SELECT 1 FROM "Lead" l
    LEFT JOIN "VentureMembership" m ON m."ventureId" = l."ventureId" AND m."userId" = app_current_user_id()
    WHERE l.id = target_lead_id
      AND (l."assignedToId" = app_current_user_id() OR m.role IN ('OWNER','VENTURE_ADMIN','OPERATIONS'))
  )
$$;
ALTER TABLE "Venture" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Lead" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Quote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Call" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Task" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AiJob" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Document" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RevenueEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Deal" ENABLE ROW LEVEL SECURITY;
CREATE POLICY venture_access ON "Venture" USING (app_can_access_venture(id));
CREATE POLICY lead_access ON "Lead" USING (app_can_access_lead(id));
CREATE POLICY quote_access ON "Quote" USING (app_can_access_lead("leadId"));
CREATE POLICY call_access ON "Call" USING (app_can_access_lead("leadId"));
CREATE POLICY task_access ON "Task" USING (app_can_access_venture("ventureId") OR "assigneeId" = app_current_user_id());
CREATE POLICY ai_job_access ON "AiJob" USING (app_can_access_venture("ventureId"));
CREATE POLICY document_access ON "Document" USING (app_can_access_venture("ventureId"));
CREATE POLICY revenue_access ON "RevenueEntry" USING (app_can_view_financials("ventureId"));
CREATE POLICY deal_access ON "Deal" USING (
  app_is_owner() OR EXISTS (SELECT 1 FROM "DealAssignment" a WHERE a."dealId" = id AND a."userId" = app_current_user_id())
  OR EXISTS (SELECT 1 FROM "VentureMembership" m WHERE m."ventureId" = "Deal"."ventureId" AND m."userId" = app_current_user_id() AND m.role IN ('OWNER','VENTURE_ADMIN'))
);
-- Safe operational projection: costs/margin only populate for financial users.
CREATE VIEW "QuoteOperational" WITH (security_invoker = true) AS
SELECT q.id, q."leadId", q."customerPrice", q.status, q."createdAt",
  CASE WHEN app_can_view_financials(l."ventureId") THEN q."directCosts" ELSE NULL END AS "directCosts",
  CASE WHEN app_can_view_financials(l."ventureId") THEN q."grossProfit" ELSE NULL END AS "grossProfit"
FROM "Quote" q JOIN "Lead" l ON l.id = q."leadId";
