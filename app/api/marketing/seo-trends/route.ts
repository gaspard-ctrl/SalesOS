import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { fetchPageTrends } from "@/lib/google-search-console";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  if (!process.env.SEARCH_CONSOLE_SITE_URL) {
    return NextResponse.json({
      winners: [],
      losers: [],
      error: "SEARCH_CONSOLE_SITE_URL not set. Add it in your environment variables.",
    });
  }

  const days = parseInt(req.nextUrl.searchParams.get("days") || "28", 10);
  const validDays = [7, 14, 28, 90].includes(days) ? days : 28;

  try {
    const { winners, losers } = await fetchPageTrends(user.id, validDays, true, 10);
    return NextResponse.json({ winners, losers });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[marketing/seo-trends] Search Console error:", msg);
    return NextResponse.json({
      winners: [],
      losers: [],
      error: msg,
    });
  }
}
