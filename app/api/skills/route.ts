import { NextResponse } from "next/server";
import { importSkillsDriveFolder } from "@/lib/server/import-skills";
import { prisma } from "@/lib/server/prisma";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "DATABASE_URL is not configured." }, { status: 503 });
  const skills = await prisma.skill.findMany({
    orderBy: { name: "asc" },
    include: { sources: { orderBy: { importedAt: "desc" }, take: 1 }, _count: { select: { executions: true, intelligenceRuns: true } } },
  });
  return NextResponse.json({ skills: skills.map(({ sources, ...skill }) => ({ ...skill, source: sources[0] ?? null })) });
}

/** Reads ZIP sources from the owner's configured Drive folder; source ZIPs remain untouched. */
export async function POST() {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "DATABASE_URL is not configured. Skills cannot be persisted." }, { status: 503 });
  try {
    const results = await importSkillsDriveFolder();
    const imported = results.flatMap((item) => item.skills);
    return NextResponse.json({ results, importedCount: imported.length, imported });
  } catch (cause) {
    const error = cause instanceof Error ? cause.message : "Drive skill import failed.";
    return NextResponse.json({ error }, { status: 502 });
  }
}
