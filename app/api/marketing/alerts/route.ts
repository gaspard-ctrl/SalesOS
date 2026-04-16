import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  MOCK_ALERTS,
  MOCK_HEATMAP,
  MOCK_ARTICLE_ROI,
  MOCK_SOCIAL_PERFORMANCE,
  MOCK_TITLE_VARIANTS,
} from "@/lib/mock/marketing-data";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  return NextResponse.json({
    alerts: MOCK_ALERTS,
    heatmap: MOCK_HEATMAP,
    roi: MOCK_ARTICLE_ROI,
    socialPerformance: MOCK_SOCIAL_PERFORMANCE,
    titleVariants: MOCK_TITLE_VARIANTS,
  });
}
