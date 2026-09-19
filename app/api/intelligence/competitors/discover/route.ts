import { NextResponse } from "next/server";

export const runtime = "nodejs";

const CONTEXT: Record<string,string> = {
  "Bubble Leisure":"UK mobile activity and events company offering bubble football, Nerf, dodgeball, axe throwing and archery for children, adults, schools and corporate events.",
  "Brilliant AI Automation":"AI automation consultancy/platform for businesses, focused on diagnosing workflows, implementing AI automation and producing measurable productivity or revenue gains.",
  "FireComplianceUK":"UK fire-compliance marketplace/broker matching property clients and procurement opportunities with qualified fire-door inspectors and fire-safety suppliers.",
  "Bankole & Associates":"capital advisory and deal-introduction business connecting mandates and companies seeking finance with investors, lenders and specialist arrangers.",
  "TradeCompare":"UK deal intelligence/comparison product intended to help users compare commercial opportunities and make better buying or investment decisions.",
  "Lucky Studios":"AI-native artist management and creative visual/music studio building virtual artists, campaigns, cinematic visuals and branded creative work.",
  "SAYAH":"independent American female R&B/rap artist persona with a growing social audience, original music, freestyles, visual storytelling and AI-assisted creative production.",
  "Oddly":"creative concept focused on trippy, surprising everyday visual content and short-form social ideas.",
  "TripleMMM":"creative agency producing story-driven short-form video, brand activations, marketing and merchandise for fashion, luxury, hospitality and lifestyle brands."
};

export async function POST(request: Request) {
  const body = await request.json().catch(()=>({})) as { venture?: string };
  const venture = body.venture?.trim() || "";
  if (!venture) return NextResponse.json({error:"Business is required."},{status:400});
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({error:"Competitor discovery needs the configured AI research provider."},{status:503});

  const prompt = `Research current real public competitors or strong comparison brands for this business:
BUSINESS: ${venture}
CONTEXT: ${CONTEXT[venture] || venture}

Find 6 relevant organisations/brands. Prefer direct competitors in the same target market; use adjacent comparison brands only where genuinely useful. Verify each from current public web sources. Do not invent companies or URLs.

Return ONLY valid JSON in this exact shape:
{"competitors":[{"name":"...","websiteUrl":"https://...","reason":"one plain-English sentence explaining why this is relevant","focus":"short label such as Direct competitor, Content benchmark, Offer benchmark or Adjacent competitor"}]}`;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method:"POST",
    headers:{"Content-Type":"application/json","Authorization":`Bearer ${process.env.OPENAI_API_KEY}`},
    body:JSON.stringify({model:"gpt-5-mini",tools:[{type:"web_search"}],input:prompt})
  });
  const raw = await response.json().catch(()=>({}));
  if (!response.ok) return NextResponse.json({error:"HQ could not research competitors right now."},{status:502});
  const text = (raw.output||[]).flatMap((x:any)=>x.content||[]).map((x:any)=>x.text||"").join("").trim();
  const cleaned = text.replace(/^\`\`\`json\s*/i,"").replace(/\`\`\`$/,"").trim();
  try {
    const parsed = JSON.parse(cleaned);
    return NextResponse.json({competitors:Array.isArray(parsed.competitors)?parsed.competitors.slice(0,6):[]});
  } catch {
    return NextResponse.json({error:"HQ researched the market but could not structure the competitor list. Try again."},{status:502});
  }
}
