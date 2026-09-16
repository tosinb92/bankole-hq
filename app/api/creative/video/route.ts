import { NextResponse } from "next/server";
import { getVideoProvider } from "@/lib/server/video-providers";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const body = await request.json() as { prompt?: string; aspectRatio?: "portrait" | "landscape"; referenceImage?: string; durationSeconds?: number; provider?: "runway" };
  if (!body.prompt?.trim()) return NextResponse.json({ error: "A video prompt is required." }, { status: 400 });
  const requestedSeconds = body.durationSeconds ?? 5;
  const clipCount = requestedSeconds === 15 ? 3 : 1;
  const provider = getVideoProvider(body.provider ?? "runway");
  try {
    const jobs = [];
    for (let clip = 0; clip < clipCount; clip += 1) {
      const sceneDirection = clipCount === 1 ? body.prompt : `${body.prompt}\nSequence segment ${clip + 1} of ${clipCount}: ${["opening hook", "active proof / payoff", "clear CTA end frame"][clip]}.`;
      jobs.push(await provider.submit({ prompt: sceneDirection, aspectRatio: body.aspectRatio ?? "portrait", durationSeconds: 5, ...(body.referenceImage ? { referenceImage: body.referenceImage } : {}) }));
    }
    return NextResponse.json({ provider: provider.name, requestedSeconds, jobs });
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "Runway video generation did not start." }, { status: 502 });
  }
}
