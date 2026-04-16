import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { MOCK_ARTICLES } from "@/lib/mock/marketing-data";
import { computeSeoBackendScores } from "@/lib/wordpress-seo";

export const dynamic = "force-dynamic";

/**
 * Enrich mock articles with live SEO Backend scores from WordPress.
 * Falls back to the mock seoBackend value when WP is unreachable.
 */
async function enrichWithSeoBackend() {
  const slugs = MOCK_ARTICLES.map((a) => a.slug);
  const seoMap = await computeSeoBackendScores(slugs);

  return MOCK_ARTICLES.map((a) => {
    const live = seoMap.get(a.slug);
    if (!live) return a;

    const newBreakdown = { ...a.scoreBreakdown, seoBackend: live.score };
    const newTotal =
      newBreakdown.traffic +
      newBreakdown.engagement +
      newBreakdown.conversion +
      newBreakdown.seo +
      newBreakdown.seoBackend;

    return {
      ...a,
      aiScore: newTotal,
      scoreBreakdown: newBreakdown,
      seoBackendDetails: live,
    };
  });
}

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const sort = req.nextUrl.searchParams.get("sort") || "aiScore";
  const order = req.nextUrl.searchParams.get("order") || "desc";
  const id = req.nextUrl.searchParams.get("id");

  const articles = await enrichWithSeoBackend();

  if (id) {
    const article = articles.find((a) => a.id === id);
    if (!article) return NextResponse.json({ error: "Article non trouvé" }, { status: 404 });
    return NextResponse.json({ article });
  }

  const sorted = [...articles].sort((a, b) => {
    const key = sort as keyof typeof a;
    const va = typeof a[key] === "number" ? (a[key] as number) : 0;
    const vb = typeof b[key] === "number" ? (b[key] as number) : 0;
    return order === "asc" ? va - vb : vb - va;
  });

  return NextResponse.json({ articles: sorted });
}
