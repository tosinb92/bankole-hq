import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "OPENAI_API_KEY is not configured on the server." }, { status: 503 });
  const { id } = await params;
  const response = await fetch(`https://api.openai.com/v1/videos/${encodeURIComponent(id)}/content`, { headers: { Authorization: `Bearer ${apiKey}` } });
  if (!response.ok) return NextResponse.json({ error: "Video content is not available yet." }, { status: response.status });
  return new Response(response.body, { headers: { "Content-Type": response.headers.get("content-type") ?? "video/mp4", "Content-Disposition": "inline; filename=bankole-hq-video.mp4" } });
}
