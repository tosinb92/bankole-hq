-- Bankole HQ live integration/event layer
CREATE TABLE IF NOT EXISTS "ActivityEvent" (
  "id" TEXT PRIMARY KEY,
  "ventureName" TEXT,
  "source" TEXT NOT NULL,
  "sourceRef" TEXT,
  "eventType" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "detail" TEXT,
  "payload" JSONB,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "importance" INTEGER NOT NULL DEFAULT 50,
  "occurredAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "ActivityEvent_ventureName_occurredAt_idx" ON "ActivityEvent" ("ventureName","occurredAt" DESC);
CREATE INDEX IF NOT EXISTS "ActivityEvent_source_sourceRef_idx" ON "ActivityEvent" ("source","sourceRef");
CREATE TABLE IF NOT EXISTS "IntegrationSync" (
  "key" TEXT PRIMARY KEY,
  "label" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'NOT_CONFIGURED',
  "lastSuccessAt" TIMESTAMPTZ,
  "lastAttemptAt" TIMESTAMPTZ,
  "lastError" TEXT,
  "metadata" JSONB,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
