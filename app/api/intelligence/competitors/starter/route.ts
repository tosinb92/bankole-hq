import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";

export const runtime = "nodejs";

const BUBBLE_LEISURE_STARTERS = [
  ["Bubble Boy Events", "https://www.bubbleboyevents.co.uk/"],
  ["Bubble Football / Excel Activity Group", "https://www.bubble-football.co.uk/"],
  ["London Bubble Football", "https://londonbubblefootball.co.uk/"],
  ["Bubble Soccer World", "https://www.bubblesoccerworld.com/"],
  ["Absolute Bubble Football", "https://absolutebubblefootball.co.uk/"],
  ["Bubble Footie", "https://www.bubblefootie.co.uk/"],
] as const;

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "DATABASE_URL is not configured. Competitors cannot be saved." }, { status: 503 });
  const body = await request.json().catch(() => ({})) as { venture?: string };
  const venture = await prisma.venture.findFirst({ where: { OR: [{ id: body.venture }, { name: body.venture ?? "Bubble Leisure" }] }, select: { id: true, name: true } });
  if (!venture || venture.name !== "Bubble Leisure") return NextResponse.json({ error: "The Bubble Leisure venture is required." }, { status: 404 });
  const competitors = await Promise.all(BUBBLE_LEISURE_STARTERS.map(([name, websiteUrl]) => prisma.competitor.upsert({
    where: { ventureId_name: { ventureId: venture.id, name } },
    update: { websiteUrl },
    create: { ventureId: venture.id, name, websiteUrl },
  })));
  return NextResponse.json({ competitors, notice: "Saved public website sources only. No ads or performance data has been claimed." });
}
