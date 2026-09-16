import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";

export const runtime = "nodejs";
export const maxDuration = 60;

type CaptureRequest = {
  venture?: string;
  url?: string;
  note?: string;
  interaction?: "SAVED" | "LIKED" | "SAW" | "COMPETITOR";
  distribution?: "PAID" | "ORGANIC";
};

const allowedHosts = ["instagram.com", "facebook.com", "youtube.com", "youtu.be", "tiktok.com"];
const isAllowedHost = (host: string) => allowedHosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
const strip = (value: string) => value.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/gi, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
const meta = (html: string, property: string) => html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"))?.[1] ?? html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`, "i"))?.[1];
const platformFor = (host: string) => host.includes("instagram.com") ? "INSTAGRAM" : host.includes("youtube.com") || host.includes("youtu.be") ? "YOUTUBE" : host.includes("facebook.com") ? "META" : "TIKTOK";
const typeFor = (platform: string, pathname: string) => platform === "INSTAGRAM" ? pathname.includes("/reel") ? "REEL" : "INSTAGRAM_POST" : platform === "YOUTUBE" ? pathname.includes("/shorts") ? "YOUTUBE_SHORT" : "YOUTUBE_VIDEO" : platform === "META" ? "META_CONTENT" : "SHORT_VIDEO";

async function scrape(url: string) {
  const key = process.env.SCRAPERAPI_KEY;
  if (!key) throw new Error("SCRAPERAPI_KEY is not configured on the server.");
  const endpoint = new URL("https://api.scraperapi.com/");
  endpoint.searchParams.set("api_key", key);
  endpoint.searchParams.set("url", url);
  endpoint.searchParams.set("render", "true");
  const response = await fetch(endpoint, { cache: "no-store" });
  const html = await response.text();
  if (!response.ok) throw new Error(`ScraperAPI collection failed (${response.status}): ${strip(html).slice(0, 300) || "no response body"}`);
  return html;
}

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "DATABASE_URL is not configured." }, { status: 503 });
  const body = await request.json().catch(() => ({})) as CaptureRequest;
  if (!body.venture || !body.url?.trim()) return NextResponse.json({ error: "Venture and public social URL are required." }, { status: 400 });
  let source: URL;
  try { source = new URL(body.url.trim()); } catch { return NextResponse.json({ error: "Enter a complete public URL beginning with https://." }, { status: 400 }); }
  const host = source.hostname.toLowerCase().replace(/\.$/, "");
  if (source.protocol !== "https:" || !isAllowedHost(host)) return NextResponse.json({ error: "Research Inbox currently accepts public Instagram, Facebook, YouTube and TikTok HTTPS links only." }, { status: 400 });

  const allowedVentures = new Set(["Bubble Leisure", "TripleMMM", "Oddly", "Lucky Studios", "SAYAH", "FireComplianceUK", "Bankole & Associates"]);
  if (!allowedVentures.has(body.venture)) return NextResponse.json({ error: "Venture not found." }, { status: 404 });
  const venture = await prisma.venture.upsert({ where: { name: body.venture }, create: { name: body.venture }, update: {} });

  try {
    const html = await scrape(source.toString());
    const platform = platformFor(host);
    const contentType = typeFor(platform, source.pathname.toLowerCase());
    const title = strip(meta(html, "og:title") ?? meta(html, "twitter:title") ?? html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? `${platform} research capture`);
    const description = strip(meta(html, "og:description") ?? meta(html, "description") ?? meta(html, "twitter:description") ?? "");
    const image = meta(html, "og:image") ?? meta(html, "twitter:image");
    const now = new Date();
    const note = body.note?.trim();
    const evidence = await prisma.intelligenceEvidence.create({
      data: {
        ventureId: venture.id,
        competitorName: host.replace(/^www\./, ""),
        accountName: meta(html, "og:site_name") ?? host,
        platform,
        distribution: body.distribution ?? "ORGANIC",
        contentType,
        format: contentType.replaceAll("_", " "),
        title: title || `${platform} research capture`,
        sourceUrl: source.toString(),
        mediaUrl: image || null,
        contentText: [description, note ? `YOUR NOTE: ${note}` : ""].filter(Boolean).join("\n\n") || "Public page captured; no caption was exposed by the source.",
        firstSeenAt: now,
        lastSeenAt: now,
        activityStatus: "Captured",
        provenance: "User-selected public social URL collected server-side through ScraperAPI",
        observableSignals: { interaction: body.interaction ?? "SAW", userNote: note ?? null, publicMetadataExposed: Boolean(title || description || image), sourceHost: host } as Prisma.InputJsonValue,
      },
    });
    return NextResponse.json({ evidence, notice: description || image ? "Public source captured. Select it below to run an approved skill." : "The URL was saved, but the public page did not expose caption or media metadata. The source and your note remain usable evidence." }, { status: 201 });
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "Public source collection failed." }, { status: 502 });
  }
}
