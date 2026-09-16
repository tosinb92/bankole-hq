import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";

export const runtime = "nodejs";
type OpportunityRequest = { venture?: string; title?: string; brief?: string; evidenceId?: string; skillRunId?: string };

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "DATABASE_URL is not configured. Opportunities cannot be saved until the Bankole HQ database is connected." }, { status: 503 });
  let body: OpportunityRequest;
  try { body = await request.json() as OpportunityRequest; } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  if (!body.venture || !body.title?.trim() || !body.brief?.trim()) return NextResponse.json({ error: "Venture, opportunity title and evidence-backed brief are required." }, { status: 400 });
  const venture = await prisma.venture.findFirst({ where: { OR: [{ id: body.venture }, { name: body.venture }] }, select: { id: true } });
  if (!venture) return NextResponse.json({ error: "The selected venture does not exist in the connected database." }, { status: 404 });
  const opportunity = await prisma.intelligenceOpportunity.create({ data: { ventureId: venture.id, title: body.title.trim(), brief: body.brief.trim(), evidenceId: body.evidenceId || null, skillRunId: body.skillRunId || null } });
  return NextResponse.json({ opportunity }, { status: 201 });
}
