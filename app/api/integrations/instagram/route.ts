import { NextRequest, NextResponse } from "next/server";

const SAYAH_ACCOUNT = "17841440323682684";
const FIELDS = [
  "media_caption","media_id","media_permalink","media_type","media_url","timestamp",
  "media_like_count","media_comments_count","media_reach","media_saved","media_shares",
  "media_views","media_reel_avg_watch_time","media_reel_skip_rate"
].join(",");

export async function GET(request: NextRequest) {
  const venture = request.nextUrl.searchParams.get("venture") || "";
  if (venture !== "SAYAH") return NextResponse.json({ connected:false, posts:[], message:"Owned social connection is not configured for this business yet." });
  const apiKey = process.env.WINDSOR_API_KEY;
  if (!apiKey) return NextResponse.json({ connected:false, posts:[], message:"Windsor is connected to ChatGPT, but Bankole HQ still needs WINDSOR_API_KEY in its server environment." });
  const url = new URL("https://connectors.windsor.ai/instagram");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("fields", FIELDS);
  url.searchParams.set("select_accounts", SAYAH_ACCOUNT);
  url.searchParams.set("date_preset", "last_30dT");
  const response = await fetch(url.toString(), { cache:"no-store", headers:{ "User-Agent":"Bankole-HQ/1.0" } });
  const body = await response.json().catch(()=>({}));
  if (!response.ok) return NextResponse.json({ connected:false, posts:[], message:"Instagram analytics could not be refreshed.", providerStatus:response.status }, { status:502 });
  const rows = Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : [];
  const posts = rows.map((x:any)=>({
    id:String(x.media_id||""),
    caption:x.media_caption||"",
    permalink:x.media_permalink||null,
    mediaType:x.media_type||"",
    mediaUrl:x.media_url||null,
    timestamp:x.timestamp||null,
    likes:Number(x.media_like_count||0),
    comments:Number(x.media_comments_count||0),
    reach:Number(x.media_reach||0),
    saves:Number(x.media_saved||0),
    shares:Number(x.media_shares||0),
    views:Number(x.media_views||0),
    avgWatchMs:x.media_reel_avg_watch_time==null?null:Number(x.media_reel_avg_watch_time),
    skipRate:x.media_reel_skip_rate==null?null:Number(x.media_reel_skip_rate)
  }));
  return NextResponse.json({ connected:true, source:"Windsor.ai · Instagram Insights", account:"sayahworld", posts });
}
