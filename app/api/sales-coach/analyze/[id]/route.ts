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

  // In prod (Netlify), kick the background function so the analysis can run up to
  // 15 min — Next.js routes on Netlify are capped at ~26s, which truncates Claude
  // mid-flight and leaves the row stuck in "analyzing" forever.
  // In dev (no Netlify), run inline.
  const siteUrl = req.nextUrl.origin;
  const isNetlify = !!process.env.NETLIFY;

  if (isNetlify) {
    fetch(`${siteUrl}/.netlify/functions/sales-coach-analyze-background`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": internalSecret,
      },
      body: JSON.stringify({ id, transcriptUrl }),
    }).catch((e) => {
      console.error(`[sales-coach/analyze/${id}] background trigger failed:`, e);
    });
    return NextResponse.json({ ok: true, queued: true });
  }

  const result = await runSalesCoachAnalysis(id, transcriptUrl);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result);
}
