import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";

export const runtime = "nodejs";
export const maxDuration = 60;

const strip = (value: string) => value.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/gi, " ").replace(/\s+/g, " ").trim();
const meta = (html: string, property: string) => html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"))?.[1];
const scraperFetch = async (url: string) => {
  const key = process.env.SCRAPERAPI_KEY;
  if (!key) throw new Error("SCRAPERAPI_KEY is not configured on the server.");
  const endpoint = new URL("https://api.scraperapi.com/"); endpoint.searchParams.set("api_key", key); endpoint.searchParams.set("url", url);
  const response = await fetch(endpoint, { cache: "no-store" });
  const html = await response.text();
  if (!response.ok) throw new Error(`ScraperAPI collection failed (${response.status}): ${strip(html).slice(0, 300) || "no response body"}`);
  return html;
};

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "DATABASE_URL is not configured. Collection cannot persist observations." }, { status: 503 });
  const { id } = await params;
  const competitor = await prisma.competitor.findUnique({ where: { id } });
  if (!competitor) return NextResponse.json({ error: "Competitor not found." }, { status: 404 });
  if (!competitor.websiteUrl) return NextResponse.json({ error: "Add a public website URL before collecting. Instagram, Meta Ad Library and YouTube need their own supported public-source collectors; this collector will not pretend a website exposes those feeds." }, { status: 409 });
  try {
    const html = await scraperFetch(competitor.websiteUrl);
    const title = meta(html, "og:title") ?? html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? competitor.name;
    const description = meta(html, "og:description") ?? meta(html, "description") ?? strip(html).slice(0, 1200);
    const image = meta(html, "og:image");
    const now = new Date();
    const evidence = await prisma.intelligenceEvidence.create({ data: { ventureId: competitor.ventureId, competitorId: competitor.id, competitorName: competitor.name, accountName: competitor.name, platform: "WEB", distribution: "ORGANIC", contentType: "WEBSITE_PAGE", format: "Web page", title: strip(title), sourceUrl: competitor.websiteUrl, mediaUrl: image || null, contentText: description, firstSeenAt: now, lastSeenAt: now, activityStatus: "Observed", provenance: "ScraperAPI collection of publicly accessible page", observableSignals: { fetched: true } } });
    await prisma.competitor.update({ where: { id }, data: { lastCollectedAt: now, lastCollectionError: null } });
    return NextResponse.json({ evidence, notice: "Collected observable public website metadata only. No Meta/Instagram/YouTube performance or private advertising metrics were inferred." });
  } catch (cause) {
    const error = cause instanceof Error ? cause.message : "Collection failed.";
    await prisma.competitor.update({ where: { id }, data: { lastCollectionError: error } });
    return NextResponse.json({ error }, { status: 502 });
  }
}
