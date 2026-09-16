-- Evidence-backed Intelligence runs use approved Skill records rather than a parallel analysis engine.
CREATE TABLE "IntelligenceEvidence" (
  "id" TEXT NOT NULL, "ventureId" TEXT NOT NULL, "competitorName" TEXT NOT NULL,
  "platform" TEXT NOT NULL, "contentType" TEXT, "title" TEXT NOT NULL, "sourceUrl" TEXT,
  "observedAt" TIMESTAMP(3), "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "contentText" TEXT, "metrics" JSONB, "provenance" TEXT NOT NULL,
  CONSTRAINT "IntelligenceEvidence_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "IntelligenceSkillRun" (
  "id" TEXT NOT NULL, "ventureId" TEXT NOT NULL, "skillId" TEXT NOT NULL,
  "scope" JSONB, "input" JSONB NOT NULL, "output" JSONB,
  "status" "SkillExecutionStatus" NOT NULL DEFAULT 'QUEUED', "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "completedAt" TIMESTAMP(3),
  CONSTRAINT "IntelligenceSkillRun_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "IntelligenceSkillRunEvidence" (
  "runId" TEXT NOT NULL, "evidenceId" TEXT NOT NULL,
  CONSTRAINT "IntelligenceSkillRunEvidence_pkey" PRIMARY KEY ("runId", "evidenceId")
);
CREATE INDEX "IntelligenceEvidence_ventureId_competitorName_platform_idx" ON "IntelligenceEvidence"("ventureId", "competitorName", "platform");
CREATE INDEX "IntelligenceSkillRun_ventureId_status_idx" ON "IntelligenceSkillRun"("ventureId", "status");
ALTER TABLE "IntelligenceEvidence" ADD CONSTRAINT "IntelligenceEvidence_ventureId_fkey" FOREIGN KEY ("ventureId") REFERENCES "Venture"("id") ON DELETE CASCADE;
ALTER TABLE "IntelligenceSkillRun" ADD CONSTRAINT "IntelligenceSkillRun_ventureId_fkey" FOREIGN KEY ("ventureId") REFERENCES "Venture"("id") ON DELETE CASCADE;
ALTER TABLE "IntelligenceSkillRun" ADD CONSTRAINT "IntelligenceSkillRun_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE RESTRICT;
ALTER TABLE "IntelligenceSkillRunEvidence" ADD CONSTRAINT "IntelligenceSkillRunEvidence_runId_fkey" FOREIGN KEY ("runId") REFERENCES "IntelligenceSkillRun"("id") ON DELETE CASCADE;
ALTER TABLE "IntelligenceSkillRunEvidence" ADD CONSTRAINT "IntelligenceSkillRunEvidence_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "IntelligenceEvidence"("id") ON DELETE CASCADE;

ALTER TABLE "IntelligenceEvidence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "IntelligenceSkillRun" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "IntelligenceSkillRunEvidence" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "intelligence_evidence_venture_access" ON "IntelligenceEvidence" USING (app_can_access_venture("ventureId"));
CREATE POLICY "intelligence_skill_run_venture_access" ON "IntelligenceSkillRun" USING (app_can_access_venture("ventureId"));
CREATE POLICY "intelligence_skill_run_evidence_access" ON "IntelligenceSkillRunEvidence" USING (EXISTS (SELECT 1 FROM "IntelligenceSkillRun" r WHERE r.id="IntelligenceSkillRunEvidence"."runId" AND app_can_access_venture(r."ventureId")));
