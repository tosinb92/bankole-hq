import { NextResponse } from "next/server";
import { getVideoProvider } from "@/lib/server/video-providers";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try { return NextResponse.json(await getVideoProvider("runway").getTask(id)); }
  catch (cause) { return NextResponse.json({ error: cause instanceof Error ? cause.message : "Runway status check failed." }, { status: 502 }); }
}
