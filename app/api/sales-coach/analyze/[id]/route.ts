import { NextRequest, NextResponse } from "next/server";
import { runSalesCoachAnalysis } from "@/lib/sales-coach/run-analysis";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const internalSecret = process.env.INTERNAL_SECRET;
  if (!internalSecret || req.headers.get("x-internal-secret") !== internalSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { transcriptUrl } = (await req.json().catch(() => ({}))) as { transcriptUrl?: string };
  if (!transcriptUrl) {
    return NextResponse.json({ error: "transcriptUrl missing" }, { status: 400 });
  }

  // Always delegate to the background function in prod — Next.js routes on Netlify
  // are capped at ~26-60s, which truncates Claude mid-flight and leaves the row
  // stuck. The background function (filename suffix -background.mts) gets 15 min.
  // Detection: NETLIFY env is the canonical signal but isn't always set in the
  // Next.js Runtime on Netlify; URL is auto-set by Netlify and is more reliable.
  // Only fall back to inline in real dev (NODE_ENV=development AND no Netlify URL).
  const siteUrl = req.nextUrl.origin;
  const isNetlifyEnv = !!(process.env.NETLIFY || process.env.URL || process.env.DEPLOY_URL);
  const isDev = process.env.NODE_ENV === "development";
  const useBackground = isNetlifyEnv && !isDev;

  console.log(`[sales-coach/analyze/${id}] path:`, {
    useBackground,
    NETLIFY: process.env.NETLIFY ?? null,
    URL: process.env.URL ?? null,
    NODE_ENV: process.env.NODE_ENV,
  });

  if (useBackground) {
    // Await with short timeout so the request actually leaves before the parent
    // lambda freezes. Netlify returns 202 immediately for -background.mts files
    // (the function then runs for up to 15 min), so this is fast.
    try {
      const bgRes = await fetch(`${siteUrl}/.netlify/functions/sales-coach-analyze-background`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-secret": internalSecret,
        },
        body: JSON.stringify({ id, transcriptUrl }),
        signal: AbortSignal.timeout(8000),
      });
      console.log(`[sales-coach/analyze/${id}] bg trigger status:`, bgRes.status);
      if (bgRes.status !== 202 && !bgRes.ok) {
        const text = await bgRes.text().catch(() => "");
        console.error(`[sales-coach/analyze/${id}] bg trigger non-202/2xx (${bgRes.status}):`, text.slice(0, 200));
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes("aborted") && !msg.includes("timeout")) {
        console.error(`[sales-coach/analyze/${id}] bg trigger failed:`, msg);
      }
    }
    return NextResponse.json({ ok: true, queued: true });
  }

  const result = await runSalesCoachAnalysis(id, transcriptUrl);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result);
}
