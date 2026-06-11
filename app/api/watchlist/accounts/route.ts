import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export interface WatchAccount {
  id: string;
  name: string;
  owner: string | null;
  sector: string | null;
  current_coaching_platform: string | null;
  notes: string | null;
  status: string;
  email_count: number;
}

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Not authenticated", accounts: [] }, { status: 401 });

  const owner = req.nextUrl.searchParams.get("owner")?.trim() ?? "";

  // Tente avec `status` ; si la migration n'est pas encore appliquee, on retombe
  // sur les colonnes de base (status traite comme null => statut auto).
  const baseCols = "id, name, owner, sector, current_coaching_platform, notes";
  const run = (cols: string) => {
    let q = db.from("scope_companies").select(cols).order("name", { ascending: true });
    if (owner) q = q.ilike("owner", owner);
    return q;
  };

  let res = await run(`${baseCols}, status`);
  if (res.error) res = await run(baseCols);
  const { data: companiesRaw, error } = res;
  if (error) return NextResponse.json({ error: error.message, accounts: [] }, { status: 500 });
  const companies = (companiesRaw ?? []) as unknown as Array<Record<string, string | null>>;
  if (companies.length === 0) return NextResponse.json({ accounts: [] });

  // Nombre d'emails (envois distincts) par company : on compte les source_id
  // distincts dans outreach_log, scope au user courant.
  const emailCounts = new Map<string, Set<string>>();
  const { data: logRows } = await db
    .from("outreach_log")
    .select("scope_company_id, source_id")
    .eq("user_id", user.id)
    .not("scope_company_id", "is", null);
  for (const r of logRows ?? []) {
    const cid = r.scope_company_id as string | null;
    if (!cid) continue;
    const set = emailCounts.get(cid) ?? new Set<string>();
    // 1 envoi = 1 source_id ; un source_id null (cas limite) compte pour 1.
    set.add((r.source_id as string | null) ?? randomUUID());
    emailCounts.set(cid, set);
  }

  // Companies dont l'AE analysis a tourné avec succès => statut auto "Enriched".
  const enrichedIds = new Set<string>();
  const { data: briefRows } = await db
    .from("watchlist_company_briefs")
    .select("scope_company_id")
    .eq("kind", "ae_analysis")
    .eq("status", "ok");
  for (const b of briefRows ?? []) {
    const cid = b.scope_company_id as string | null;
    if (cid) enrichedIds.add(cid);
  }

  const accounts: WatchAccount[] = companies.map((c) => {
    const id = String(c.id);
    const emailCount = emailCounts.get(id)?.size ?? 0;
    const manual = (c.status ?? "").trim();
    // Auto: contacté (>=1 email) prime sur enrichi (AE analysis), sinon à enrichir.
    const auto = emailCount > 0 ? "Contacted" : enrichedIds.has(id) ? "Enriched" : "To enrich";
    const status = manual || auto;
    return {
      id,
      name: c.name ?? "",
      owner: c.owner ?? null,
      sector: c.sector ?? null,
      current_coaching_platform: c.current_coaching_platform ?? null,
      notes: c.notes ?? null,
      status,
      email_count: emailCount,
    };
  });

  return NextResponse.json({ accounts });
}
