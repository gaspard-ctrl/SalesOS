import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  MOCK_CONTENT_ANALYSIS,
  MOCK_ARTICLE_RECOMMENDATIONS,
  MOCK_ARTICLE_DRAFTS,
} from "@/lib/mock/marketing-data";

export const dynamic = "force-dynamic";

// In-memory state for mock interactions
let recommendations = MOCK_ARTICLE_RECOMMENDATIONS.map((r) => ({ ...r }));

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  return NextResponse.json({
    analysis: MOCK_CONTENT_ANALYSIS,
    recommendations,
    drafts: MOCK_ARTICLE_DRAFTS,
  });
}

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json();
  const { action, recommendationId } = body;

  if (action === "analyze") {
    return NextResponse.json({ analysis: MOCK_CONTENT_ANALYSIS });
  }

  if (action === "approve" && recommendationId) {
    const rec = recommendations.find((r) => r.id === recommendationId);
    if (rec) rec.status = "approved";
    return NextResponse.json({ success: true, recommendations });
  }

  if (action === "reject" && recommendationId) {
    recommendations = recommendations.filter((r) => r.id !== recommendationId);
    return NextResponse.json({ success: true, recommendations });
  }

  if (action === "generate" && recommendationId) {
    const rec = recommendations.find((r) => r.id === recommendationId);
    if (rec) rec.status = "writing";
    const draft = MOCK_ARTICLE_DRAFTS.find((d) => d.recommendationId === recommendationId);
    return NextResponse.json({ success: true, draft: draft || MOCK_ARTICLE_DRAFTS[0], recommendations });
  }

  if (action === "publish" && recommendationId) {
    const rec = recommendations.find((r) => r.id === recommendationId);
    if (rec) rec.status = "published";
    return NextResponse.json({ success: true, recommendations });
  }

  return NextResponse.json({ error: "Action invalide" }, { status: 400 });
}
