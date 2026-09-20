import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { evidenceId?: string; saved?: boolean };
    if (!body.evidenceId) return NextResponse.json({ error: "Evidence id is required." }, { status: 400 });
    const evidence = await prisma.intelligenceEvidence.update({
      where: { id: body.evidenceId },
      data: { activityStatus: body.saved === false ? "Observed" : "SAVED" },
    });
    return NextResponse.json({ evidence });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Swipe File could not be updated." }, { status: 500 });
  }
}
