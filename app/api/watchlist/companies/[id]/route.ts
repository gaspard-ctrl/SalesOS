import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getBriefs, type BriefRow, type AeAnalysisContent, type NewsContent } from "@/lib/watchlist/briefs";

export const dynamic = "force-dynamic";

// Conservé pour compat de signature : la prospection passe désormais par les listes.
export interface WatchProspect {
  id: string;
  is_champion: boolean;
  hubspot_id: string | null;
}

export interface WatchCompanyDetail {
  id: string;
  name: string;
  owner: string | null;
  sector: string | null;
  current_coaching_platform: string | null;
  notes: string | null;
  hubspot_company_id: string | null;
}

export interface WatchCompanyDetailResponse {
  company: WatchCompanyDetail | null;
  prospects: WatchProspect[];
  briefs: {
    ae_analysis: BriefRow<AeAnalysisContent> | null;
    news: BriefRow<NewsContent> | null;
  };
  outreach_count: number;
  error?: string;
}

const EMPTY: Omit<WatchCompanyDetailResponse, "error"> = {
  company: null,
  prospects: [],
  briefs: { ae_analysis: null, news: null },
  outreach_count: 0,
};

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ ...EMPTY, error: "Non authentifié" }, { status: 401 });
  }

  const { id } = await params;

  const { data: company, error: companyErr } = await db
    .from("scope_companies")
    .select("id, name, owner, sector, current_coaching_platform, notes, hubspot_company_id")
    .eq("id", id)
    .maybeSingle();

  if (companyErr) {
    // Erreur SQL (ex: colonne absente parce que la migration n'est pas appliquée)
    return NextResponse.json(
      { ...EMPTY, error: `Erreur DB: ${companyErr.message}` },
      { status: 500 },
    );
  }
  if (!company) {
    return NextResponse.json({ ...EMPTY, error: "Compte introuvable" }, { status: 404 });
  }

  const briefs = await getBriefs(company.id);

  const response: WatchCompanyDetailResponse = {
    company,
    prospects: [],
    briefs,
    outreach_count: 0,
  };

  return NextResponse.json(response);
}
