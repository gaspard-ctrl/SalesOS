import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { MOCK_KEYWORDS, MOCK_CANNIBALIZATION_ALERTS } from "@/lib/mock/marketing-data";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const articleId = req.nextUrl.searchParams.get("articleId");
  const opportunities = req.nextUrl.searchParams.get("opportunities") === "true";

  let keywords = [...MOCK_KEYWORDS];

  if (articleId) {
    keywords = keywords.filter((k) => k.articleId === articleId);
  }

  if (opportunities) {
    keywords = keywords.filter((k) => k.position >= 5 && k.position <= 20 && k.ctr < 3);
  }

  return NextResponse.json({
    keywords,
    cannibalizationAlerts: MOCK_CANNIBALIZATION_ALERTS,
  });
}
