import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "OPENAI_API_KEY is not configured on the server." }, { status: 503 });
  const { id } = await params;
  const response = await fetch(`https://api.openai.com/v1/videos/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${apiKey}` }, cache: "no-store" });
  const payload = await response.json();
  return NextResponse.json(payload, { status: response.status });
}
