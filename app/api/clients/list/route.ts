import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/clients/list?owner=<email|all>
//
// Liste tous les clients (closed-won) connus de SalesOS. Par défaut on filtre
// sur les clients dont l'owner_email matche l'email du user connecté ; pass
// `owner=all` pour voir tout. La page UI utilise un toggle "Mes clients /
// Tout le monde" en s'appuyant sur ça.
export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const ownerParam = req.nextUrl.searchParams.get("owner");
  const q = req.nextUrl.searchParams.get("q")?.trim().toLowerCase() ?? "";

  let query = db
    .from("clients")
    .select(
      "id, hubspot_deal_id, hubspot_company_id, company_name, owner_email, owner_name, closedwon_at, deal_amount, health, enrichment_status, enrichment_error, last_enriched_at, am_cs_notified_at, created_at",
    )
    .order("closedwon_at", { ascending: false, nullsFirst: false });

  if (ownerParam !== "all") {
    // Owner par défaut : l'utilisateur connecté (filtre sur owner_email).
    // Si owner=<email> est passé explicitement, on l'utilise tel quel.
    const ownerEmail = ownerParam || user.email;
    if (ownerEmail) query = query.eq("owner_email", ownerEmail);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = data ?? [];
  const filtered = q ? rows.filter((r) => (r.company_name ?? "").toLowerCase().includes(q)) : rows;

  return NextResponse.json({ clients: filtered });
}
