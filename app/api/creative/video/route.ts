import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "OPENAI_API_KEY is not configured on the server." }, { status: 503 });
  const body = await request.json() as { prompt?: string; aspectRatio?: "portrait" | "landscape"; seconds?: "8" | "16" | "20" };
  if (!body.prompt?.trim()) return NextResponse.json({ error: "A video prompt is required." }, { status: 400 });

  const form = new FormData();
  form.set("model", "sora-2");
  form.set("prompt", body.prompt);
  form.set("size", body.aspectRatio === "landscape" ? "1280x720" : "720x1280");
  form.set("seconds", body.seconds ?? "8");
  const response = await fetch("https://api.openai.com/v1/videos", { method: "POST", headers: { Authorization: `Bearer ${apiKey}` }, body: form });
  const payload = await response.json() as { id?: string; status?: string; progress?: number; error?: { message?: string; code?: string } };
  if (!response.ok || !payload.id) return NextResponse.json({ error: payload.error?.message ?? "Video generation did not start.", code: payload.error?.code ?? null }, { status: response.status || 502 });
  return NextResponse.json({ id: payload.id, status: payload.status ?? "queued", progress: payload.progress ?? 0 });
}
