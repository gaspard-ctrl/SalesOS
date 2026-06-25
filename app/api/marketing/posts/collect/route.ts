import { NextRequest, NextResponse, after } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { collectPostsByUrl } from "@/lib/marketing/linkedin-posts";

export const dynamic = "force-dynamic";

const BG_FN = "marketing-posts-scrape-background";

export interface CollectPostsResponse {
  ok: boolean;
  queued?: boolean;
  count?: number;
  error?: string;
}

// Rattrapage d'un (ou plusieurs) post(s) raté(s) par la discovery hebdo : collecte
// directe par URL (mode `collect`, fiable). Comme le refresh, le scrape passe par la
// Background Function en prod (durée > limite sync Netlify) ; in-process en dev.
export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });

  let body: { url?: unknown; urls?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const candidates = Array.isArray(body.urls) ? body.urls : body.url != null ? [body.url] : [];
  const urls = candidates
    .map((u) => String(u).trim())
    .filter((u) => /linkedin\.com\//i.test(u));
  if (!urls.length) {
    return NextResponse.json({ ok: false, error: "Provide a LinkedIn post URL" }, { status: 400 });
  }

  const siteUrl = process.env.URL ?? process.env.SITE_URL ?? req.nextUrl.origin;
  const cronSecret = process.env.CRON_SECRET;

  if (process.env.NETLIFY === "true") {
    if (!cronSecret) {
      return NextResponse.json(
        { ok: false, error: "Collect unavailable: CRON_SECRET is not configured." },
        { status: 503 },
      );
    }
    fetch(`${siteUrl}/.netlify/functions/${BG_FN}`, {
      method: "POST",
      headers: { authorization: `Bearer ${cronSecret}`, "content-type": "application/json" },
      body: JSON.stringify({ collectUrls: urls }),
    }).catch((e) => console.error("[marketing/posts/collect] background invoke failed:", e));
    return NextResponse.json({ ok: true, queued: true, count: urls.length }, { status: 202 });
  }

  // Dev local : exécution in-process après la réponse.
  after(async () => {
    const res = await collectPostsByUrl(urls);
    if (!res.ok) console.error("[marketing/posts/collect] dev run failed:", JSON.stringify(res));
  });
  return NextResponse.json({ ok: true, queued: true, count: urls.length }, { status: 202 });
}
