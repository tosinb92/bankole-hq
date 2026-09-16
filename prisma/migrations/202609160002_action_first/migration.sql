-- Action-first operating system: queue, B&A economics and commitments,
-- communications, FireCompliance professional network, skills executions.
CREATE TYPE "ActionLane" AS ENUM ('AI_CAN_HANDLE','NEEDS_APPROVAL','NEEDS_ME','WAITING_EXTERNAL');
CREATE TYPE "ActionKind" AS ENUM ('ANALYSE_EMAIL','ANALYSE_THREAD','DRAFT_REPLY','DRAFT_FOLLOW_UP','PREPARE_MEETING_BRIEF','ANALYSE_AGREEMENT','CALCULATE_ENTITLEMENT','REVIEW_DOCUMENTS','CHASE_COMMITMENT','FIND_PROFESSIONAL','PREPARE_QUOTE','GENERATE_CONTENT','RUN_SKILL');
CREATE TYPE "CommunicationStatus" AS ENUM ('DRAFT','NEEDS_APPROVAL','APPROVED','SENT','FAILED');
CREATE TYPE "EvidenceStatus" AS ENUM ('PROJECTED','CONTRACTUALLY_EVIDENCED','EARNED','INVOICED','PAID');
CREATE TYPE "ProfessionalVerification" AS ENUM ('UNREVIEWED','POTENTIAL_MATCH','CONTACTED','CAPABILITY_CONFIRMED','CREDENTIALS_VERIFIED','RATE_CONFIRMED','AVAILABLE','APPROVED_SUPPLIER','PREVIOUSLY_USED');
CREATE TYPE "SkillExecutionStatus" AS ENUM ('QUEUED','RUNNING','NEEDS_APPROVAL','COMPLETED','FAILED','BLOCKED');

CREATE TABLE "Action" (
  "id" TEXT NOT NULL, "ventureId" TEXT NOT NULL, "dealId" TEXT, "contactId" TEXT,
  "title" TEXT NOT NULL, "kind" "ActionKind" NOT NULL, "lane" "ActionLane" NOT NULL,
  "urgency" INTEGER NOT NULL DEFAULT 3, "monetaryRelevance" DECIMAL(12,2),
  "recommendation" TEXT NOT NULL, "executionState" TEXT NOT NULL DEFAULT 'Ready', "outcome" TEXT,
  "requiresIntegration" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Action_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "DealEconomics" (
  "id" TEXT NOT NULL, "dealId" TEXT NOT NULL, "transactionValue" DECIMAL(16,2), "feeBasis" TEXT NOT NULL,
  "fixedFee" DECIMAL(12,2), "percentageFee" DECIMAL(7,4), "introductionFee" DECIMAL(12,2), "successFee" DECIMAL(12,2), "milestoneFees" JSONB,
  "projectedEntitlement" DECIMAL(12,2) NOT NULL DEFAULT 0, "evidencedEntitlement" DECIMAL(12,2) NOT NULL DEFAULT 0, "earnedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "invoicedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0, "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0, "expectedPaymentDate" TIMESTAMP(3),
  "responsibleCounterparty" TEXT, "evidenceSource" TEXT, "evidenceStatus" "EvidenceStatus" NOT NULL DEFAULT 'PROJECTED', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DealEconomics_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "DealCommitment" (
  "id" TEXT NOT NULL, "dealId" TEXT NOT NULL, "promisedBy" TEXT NOT NULL, "commitment" TEXT NOT NULL, "dueAt" TIMESTAMP(3),
  "evidenceSource" TEXT, "linkedMilestone" TEXT, "status" TEXT NOT NULL DEFAULT 'Open', "recommendedFollowUp" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DealCommitment_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Communication" (
  "id" TEXT NOT NULL, "ventureId" TEXT NOT NULL, "dealId" TEXT, "subject" TEXT NOT NULL, "body" TEXT,
  "status" "CommunicationStatus" NOT NULL DEFAULT 'DRAFT', "providerMessageId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Communication_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Professional" (
  "id" TEXT NOT NULL, "name" TEXT NOT NULL, "company" TEXT, "role" TEXT, "email" TEXT, "phone" TEXT, "linkedinUrl" TEXT, "website" TEXT,
  "geography" TEXT, "serviceArea" TEXT, "capabilities" JSONB, "qualifications" JSONB, "insuranceDetails" TEXT, "rates" JSONB,
  "availability" TEXT, "capacity" TEXT, "previousJobs" JSONB, "qualityNotes" TEXT, "source" TEXT, "lastVerifiedAt" TIMESTAMP(3),
  "verification" "ProfessionalVerification" NOT NULL DEFAULT 'UNREVIEWED', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Professional_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ProfessionalImport" (
  "id" TEXT NOT NULL, "sourceSpreadsheetId" TEXT NOT NULL, "sourceTab" TEXT NOT NULL, "sourceRow" INTEGER, "rawRecord" JSONB NOT NULL,
  "professionalId" TEXT, "classification" TEXT, "dedupeKey" TEXT NOT NULL, "importStatus" TEXT NOT NULL DEFAULT 'Pending', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProfessionalImport_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "SkillExecution" (
  "id" TEXT NOT NULL, "skillId" TEXT NOT NULL, "ventureId" TEXT NOT NULL, "dealId" TEXT, "projectRef" TEXT, "sourceFile" TEXT, "sourceVersion" TEXT,
  "requiredInputs" JSONB, "input" JSONB, "output" JSONB, "status" "SkillExecutionStatus" NOT NULL DEFAULT 'QUEUED', "approvalState" TEXT NOT NULL DEFAULT 'Not required',
  "downstreamActionId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "completedAt" TIMESTAMP(3), CONSTRAINT "SkillExecution_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "VentureBrandSettings" (
  "id" TEXT NOT NULL, "ventureId" TEXT NOT NULL, "logoUrl" TEXT, "colours" JSONB, "typographyPreference" TEXT, "imagery" JSONB, "headerLabel" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "VentureBrandSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DealEconomics_dealId_key" ON "DealEconomics"("dealId");
CREATE UNIQUE INDEX "ProfessionalImport_sourceSpreadsheetId_sourceTab_sourceRow_key" ON "ProfessionalImport"("sourceSpreadsheetId","sourceTab","sourceRow");
CREATE UNIQUE INDEX "VentureBrandSettings_ventureId_key" ON "VentureBrandSettings"("ventureId");
CREATE INDEX "Action_ventureId_lane_idx" ON "Action"("ventureId","lane");
CREATE INDEX "Action_dealId_idx" ON "Action"("dealId");
CREATE INDEX "DealCommitment_dealId_dueAt_idx" ON "DealCommitment"("dealId","dueAt");
CREATE INDEX "Communication_ventureId_status_idx" ON "Communication"("ventureId","status");
CREATE INDEX "SkillExecution_ventureId_status_idx" ON "SkillExecution"("ventureId","status");
CREATE INDEX "ProfessionalImport_dedupeKey_idx" ON "ProfessionalImport"("dedupeKey");

ALTER TABLE "Action" ADD CONSTRAINT "Action_ventureId_fkey" FOREIGN KEY ("ventureId") REFERENCES "Venture"("id") ON DELETE CASCADE;
ALTER TABLE "Action" ADD CONSTRAINT "Action_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE;
ALTER TABLE "Action" ADD CONSTRAINT "Action_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL;
ALTER TABLE "DealEconomics" ADD CONSTRAINT "DealEconomics_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE;
ALTER TABLE "DealCommitment" ADD CONSTRAINT "DealCommitment_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE;
ALTER TABLE "Communication" ADD CONSTRAINT "Communication_ventureId_fkey" FOREIGN KEY ("ventureId") REFERENCES "Venture"("id") ON DELETE CASCADE;
ALTER TABLE "Communication" ADD CONSTRAINT "Communication_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE;
ALTER TABLE "SkillExecution" ADD CONSTRAINT "SkillExecution_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE RESTRICT;
ALTER TABLE "SkillExecution" ADD CONSTRAINT "SkillExecution_ventureId_fkey" FOREIGN KEY ("ventureId") REFERENCES "Venture"("id") ON DELETE CASCADE;
ALTER TABLE "SkillExecution" ADD CONSTRAINT "SkillExecution_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE;
ALTER TABLE "ProfessionalImport" ADD CONSTRAINT "ProfessionalImport_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE SET NULL;
ALTER TABLE "VentureBrandSettings" ADD CONSTRAINT "VentureBrandSettings_ventureId_fkey" FOREIGN KEY ("ventureId") REFERENCES "Venture"("id") ON DELETE CASCADE;

-- Database-side access: financial rows require finance permission or an explicit financial deal assignment.
ALTER TABLE "Action" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Communication" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SkillExecution" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DealEconomics" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DealCommitment" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "action_venture_access" ON "Action" USING (app_can_access_venture("ventureId"));
CREATE POLICY "communication_venture_access" ON "Communication" USING (app_can_access_venture("ventureId"));
CREATE POLICY "skill_execution_venture_access" ON "SkillExecution" USING (app_can_access_venture("ventureId"));
CREATE POLICY "deal_commitment_access" ON "DealCommitment" USING (EXISTS (SELECT 1 FROM "Deal" d WHERE d.id="DealCommitment"."dealId" AND app_can_access_venture(d."ventureId")));
CREATE POLICY "deal_economics_financial_access" ON "DealEconomics" USING (app_is_owner() OR EXISTS (SELECT 1 FROM "Deal" d LEFT JOIN "VentureMembership" m ON m."ventureId"=d."ventureId" AND m."userId"=app_current_user_id() LEFT JOIN "DealAssignment" a ON a."dealId"=d.id AND a."userId"=app_current_user_id() WHERE d.id="DealEconomics"."dealId" AND (m."canViewFinancials" OR a."canViewFinancials")));
