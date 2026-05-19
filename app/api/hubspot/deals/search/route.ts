import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { searchDealsByName } from "@/lib/hubspot";

export const dynamic = "force-dynamic";

/**
 * Autocomplete des deals HubSpot par nom. Utilisé par l'UI Sales Coach pour
 * la résolution manuelle d'un meeting sans deal associé. Retourne jusqu'à 15
 * résultats enrichis (stage, owner, montant) pour disambiguation.
 */
export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ deals: [] });
  }

  const deals = await searchDealsByName(q, 15).catch((e) => {
    console.error("[hubspot/deals/search] error:", e);
    return [];
  });

  return NextResponse.json({ deals });
}
