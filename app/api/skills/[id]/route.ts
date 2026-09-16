import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";

export const runtime = "nodejs";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "DATABASE_URL is not configured." }, { status: 503 });
  let body: { active?: boolean };
  try { body = await request.json() as { active?: boolean }; } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  if (typeof body.active !== "boolean") return NextResponse.json({ error: "active must be true or false." }, { status: 400 });
  const { id } = await params;
  try {
    const skill = await prisma.skill.update({ where: { id }, data: { active: body.active } });
    return NextResponse.json({ skill });
  } catch { return NextResponse.json({ error: "Skill not found." }, { status: 404 }); }
}
