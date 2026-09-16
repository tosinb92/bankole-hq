import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type ImageRequest = {
  venture?: string;
  project?: string;
  source?: string;
  prompt?: string;
  aspectRatio?: "square" | "portrait" | "landscape";
  action?: string;
};

const sizeFor = (ratio: ImageRequest["aspectRatio"]) =>
  ratio === "portrait" ? "1024x1536" : ratio === "landscape" ? "1536x1024" : "1024x1024";

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "OPENAI_API_KEY is not configured on the server." }, { status: 503 });

  let body: ImageRequest;
  try { body = await request.json() as ImageRequest; } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  if (!body.prompt?.trim()) return NextResponse.json({ error: "A visual prompt is required." }, { status: 400 });

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-image-1", prompt: body.prompt, size: sizeFor(body.aspectRatio), quality: "medium" }),
  });
  const payload = await response.json() as { data?: Array<{ b64_json?: string; revised_prompt?: string }>; error?: { message?: string; code?: string } };
  if (!response.ok || !payload.data?.[0]?.b64_json) {
    return NextResponse.json({ error: payload.error?.message ?? "Image generation did not return an image.", code: payload.error?.code ?? null }, { status: response.status || 502 });
  }

  // The data URL is returned only to the requesting browser. Durable asset storage is
  // deliberately separate from model execution and will use the existing Prisma model
  // once DATABASE_URL and object storage are configured.
  return NextResponse.json({
    asset: { id: crypto.randomUUID(), venture: body.venture ?? "Unassigned", project: body.project ?? "Creative Studio", source: body.source ?? "", prompt: body.prompt, revisedPrompt: payload.data[0].revised_prompt ?? body.prompt, imageUrl: `data:image/png;base64,${payload.data[0].b64_json}`, version: 1, aspectRatio: body.aspectRatio ?? "square", approvalStatus: "Needs Approval", createdAt: new Date().toISOString(), action: body.action ?? "Generate Image", persisted: false },
  });
}
