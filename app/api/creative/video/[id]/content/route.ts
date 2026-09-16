import { NextResponse } from "next/server";
import { getVideoProvider } from "@/lib/server/video-providers";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const response = await getVideoProvider("runway").getContent(id);
    return new Response(response.body, { headers: { "Content-Type": response.headers.get("content-type") ?? "video/mp4", "Content-Disposition": "inline; filename=bankole-hq-runway-video.mp4", "Cache-Control": "no-store" } });
  } catch (cause) { return NextResponse.json({ error: cause instanceof Error ? cause.message : "Runway video content is unavailable." }, { status: 502 }); }
}
