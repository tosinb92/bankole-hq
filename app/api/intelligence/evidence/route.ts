import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";

export const runtime = "nodejs";

type EvidenceRequest = { ventureId?: string; competitorName?: string; platform?: string; title?: string; sourceUrl?: string; contentType?: string; contentText?: string; provenance?: string };

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "DATABASE_URL is not configured. Evidence cannot be persisted until the Bankole HQ database is connected." }, { status: 503 });
  let body: EvidenceRequest;
  try { body = await request.json() as EvidenceRequest; } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  if (!body.ventureId || !body.competitorName?.trim() || !body.platform?.trim() || !body.title?.trim() || !body.provenance?.trim()) return NextResponse.json({ error: "Venture, competitor, platform, title and provenance are required." }, { status: 400 });
  const evidence = await prisma.intelligenceEvidence.create({ data: { ventureId: body.ventureId, competitorName: body.competitorName.trim(), platform: body.platform.trim(), title: body.title.trim(), sourceUrl: body.sourceUrl?.trim() || null, contentType: body.contentType?.trim() || null, contentText: body.contentText?.trim() || null, provenance: body.provenance.trim() } });
  return NextResponse.json({ evidence }, { status: 201 });
}
