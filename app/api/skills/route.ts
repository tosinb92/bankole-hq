import { NextResponse } from "next/server";
import { importSkillZip, importSkillsDriveFolder } from "@/lib/server/import-skills";
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

/** Imports either directly uploaded ZIPs or the owner's configured Drive folder. */
export async function POST(request: Request) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "DATABASE_URL is not configured. Skills cannot be persisted." }, { status: 503 });
  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const files = form.getAll("files").filter((item): item is File => item instanceof File);
      if (!files.length) return NextResponse.json({ error: "Select at least one skill ZIP file." }, { status: 400 });
      if (files.length > 30) return NextResponse.json({ error: "Upload no more than 30 ZIP files at once." }, { status: 400 });
      const results: { fileName: string; skills: string[] }[] = [];
      for (const file of files) {
        if (!file.name.toLowerCase().endsWith(".zip")) throw new Error(`${file.name} is not a ZIP file.`);
        if (file.size > 10 * 1024 * 1024) throw new Error(`${file.name} exceeds the 10 MB upload limit.`);
        const uploadId = `manual-${crypto.randomUUID()}`;
        const skills = await importSkillZip({ fileId: uploadId, fileName: file.name, bytes: new Uint8Array(await file.arrayBuffer()) });
        results.push({ fileName: file.name, skills });
      }
      const imported = results.flatMap((item) => item.skills);
      return NextResponse.json({ source: "upload", results, importedCount: imported.length, imported });
    }

    const results = await importSkillsDriveFolder();
    const imported = results.flatMap((item) => item.skills);
    return NextResponse.json({ results, importedCount: imported.length, imported });
  } catch (cause) {
    const error = cause instanceof Error ? cause.message : "Drive skill import failed.";
    return NextResponse.json({ error }, { status: 502 });
  }
}
