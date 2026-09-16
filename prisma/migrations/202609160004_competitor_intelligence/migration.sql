-- Observable competitor intelligence only. Private performance claims are never stored as inferred facts.
CREATE TABLE "Competitor" (
  "id" TEXT NOT NULL, "ventureId" TEXT NOT NULL, "name" TEXT NOT NULL,
  "websiteUrl" TEXT, "instagramUrl" TEXT, "facebookUrl" TEXT, "youtubeChannelUrl" TEXT, "metaAdLibraryUrl" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true, "lastCollectedAt" TIMESTAMP(3), "lastCollectionError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Competitor_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "IntelligenceEvidence" ADD COLUMN "competitorId" TEXT;
ALTER TABLE "IntelligenceEvidence" ADD COLUMN "accountName" TEXT;
ALTER TABLE "IntelligenceEvidence" ADD COLUMN "distribution" TEXT NOT NULL DEFAULT 'ORGANIC';
ALTER TABLE "IntelligenceEvidence" ADD COLUMN "mediaUrl" TEXT;
ALTER TABLE "IntelligenceEvidence" ADD COLUMN "hook" TEXT;
ALTER TABLE "IntelligenceEvidence" ADD COLUMN "offer" TEXT;
ALTER TABLE "IntelligenceEvidence" ADD COLUMN "cta" TEXT;
ALTER TABLE "IntelligenceEvidence" ADD COLUMN "audienceAngle" TEXT;
ALTER TABLE "IntelligenceEvidence" ADD COLUMN "format" TEXT;
ALTER TABLE "IntelligenceEvidence" ADD COLUMN "durationSeconds" INTEGER;
ALTER TABLE "IntelligenceEvidence" ADD COLUMN "landingPageUrl" TEXT;
ALTER TABLE "IntelligenceEvidence" ADD COLUMN "firstSeenAt" TIMESTAMP(3);
ALTER TABLE "IntelligenceEvidence" ADD COLUMN "lastSeenAt" TIMESTAMP(3);
ALTER TABLE "IntelligenceEvidence" ADD COLUMN "activityStatus" TEXT;
ALTER TABLE "IntelligenceEvidence" ADD COLUMN "observableSignals" JSONB;
CREATE TABLE "IntelligenceOpportunity" (
  "id" TEXT NOT NULL, "ventureId" TEXT NOT NULL, "evidenceId" TEXT, "skillRunId" TEXT,
  "title" TEXT NOT NULL, "brief" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'Needs Approval',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "IntelligenceOpportunity_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Competitor_ventureId_name_key" ON "Competitor"("ventureId", "name");
CREATE INDEX "Competitor_ventureId_active_idx" ON "Competitor"("ventureId", "active");
CREATE INDEX "IntelligenceEvidence_competitorId_capturedAt_idx" ON "IntelligenceEvidence"("competitorId", "capturedAt");
CREATE INDEX "IntelligenceOpportunity_ventureId_status_idx" ON "IntelligenceOpportunity"("ventureId", "status");
ALTER TABLE "Competitor" ADD CONSTRAINT "Competitor_ventureId_fkey" FOREIGN KEY ("ventureId") REFERENCES "Venture"("id") ON DELETE CASCADE;
ALTER TABLE "IntelligenceEvidence" ADD CONSTRAINT "IntelligenceEvidence_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "Competitor"("id") ON DELETE SET NULL;
ALTER TABLE "IntelligenceOpportunity" ADD CONSTRAINT "IntelligenceOpportunity_ventureId_fkey" FOREIGN KEY ("ventureId") REFERENCES "Venture"("id") ON DELETE CASCADE;
ALTER TABLE "IntelligenceOpportunity" ADD CONSTRAINT "IntelligenceOpportunity_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "IntelligenceEvidence"("id") ON DELETE SET NULL;
ALTER TABLE "Competitor" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "IntelligenceOpportunity" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "competitor_venture_access" ON "Competitor" USING (app_can_access_venture("ventureId"));
CREATE POLICY "intelligence_opportunity_venture_access" ON "IntelligenceOpportunity" USING (app_can_access_venture("ventureId"));
