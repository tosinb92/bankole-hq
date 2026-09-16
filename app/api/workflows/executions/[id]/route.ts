import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "DATABASE_URL is not configured." }, { status: 503 });
  const { id } = await context.params;
  const body = await request.json().catch(() => ({})) as { output?: string; approvalState?: string };
  if (!body.output?.trim() || body.approvalState !== "Approved") {
    return NextResponse.json({ error: "An edited output and explicit approval are required." }, { status: 400 });
  }
  const existing = await prisma.skillExecution.findUnique({ where: { id }, select: { output: true } });
  if (!existing) return NextResponse.json({ error: "Skill execution not found." }, { status: 404 });

  const original = existing.output && typeof existing.output === "object" && !Array.isArray(existing.output)
    ? existing.output as Prisma.JsonObject
    : {};
  const execution = await prisma.skillExecution.update({
    where: { id },
    data: {
      output: { ...original, text: body.output, approvedAt: new Date().toISOString() } as Prisma.InputJsonValue,
      approvalState: "Approved",
      status: "COMPLETED",
    },
    select: { id: true, status: true, approvalState: true },
  });
  return NextResponse.json({ execution });
}
