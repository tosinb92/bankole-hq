import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";

export const runtime = "nodejs";
type CompetitorInput = { venture?: string; name?: string; websiteUrl?: string; instagramUrl?: string; facebookUrl?: string; youtubeChannelUrl?: string; metaAdLibraryUrl?: string };

async function ventureId(value: string) {
  const venture = await prisma.venture.findFirst({ where: { OR: [{ id: value }, { name: value }] }, select: { id: true } });
  return venture?.id;
}

export async function GET(request: Request) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "DATABASE_URL is not configured. Competitors cannot be read until the Bankole HQ database is connected." }, { status: 503 });
  const venture = new URL(request.url).searchParams.get("venture");
  if (!venture) return NextResponse.json({ error: "A venture is required." }, { status: 400 });
  const id = await ventureId(venture);
  if (!id) return NextResponse.json({ competitors: [], evidence: [], opportunities: [] });
  const [competitors, evidence, opportunities] = await Promise.all([
    prisma.competitor.findMany({ where: { ventureId: id }, orderBy: { createdAt: "asc" } }),
    prisma.intelligenceEvidence.findMany({ where: { ventureId: id }, include: { competitor: true }, orderBy: { capturedAt: "desc" }, take: 250 }),
    prisma.intelligenceOpportunity.findMany({ where: { ventureId: id }, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);
  return NextResponse.json({ ventureId: id, competitors, evidence, opportunities });
}

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "DATABASE_URL is not configured. Competitors cannot be persisted until the Bankole HQ database is connected." }, { status: 503 });
  let body: CompetitorInput;
  try { body = await request.json() as CompetitorInput; } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  if (!body.venture || !body.name?.trim()) return NextResponse.json({ error: "Venture and competitor name are required." }, { status: 400 });
  const id = await ventureId(body.venture);
  if (!id) return NextResponse.json({ error: "The selected venture does not exist in the connected database." }, { status: 404 });
  const competitor = await prisma.competitor.upsert({ where: { ventureId_name: { ventureId: id, name: body.name.trim() } }, update: { websiteUrl: body.websiteUrl || null, instagramUrl: body.instagramUrl || null, facebookUrl: body.facebookUrl || null, youtubeChannelUrl: body.youtubeChannelUrl || null, metaAdLibraryUrl: body.metaAdLibraryUrl || null }, create: { ventureId: id, name: body.name.trim(), websiteUrl: body.websiteUrl || null, instagramUrl: body.instagramUrl || null, facebookUrl: body.facebookUrl || null, youtubeChannelUrl: body.youtubeChannelUrl || null, metaAdLibraryUrl: body.metaAdLibraryUrl || null } });
  return NextResponse.json({ competitor }, { status: 201 });
}
