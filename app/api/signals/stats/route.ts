import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export interface SignalsStatsResponse {
  ok: boolean;
  error?: string;
  /** Dernier signal inséré, tous statuts confondus = dernière activité du sweep. */
  newest_at: string | null;
  /** Nb de signaux 'new' (visibles dans le feed). */
  total_new: number;
  by_feed: { watchlist: number; discovery: number };
  /** Par source (signaux 'new') : compte + date du plus récent. */
  by_source: { source: string; count: number; newest: string | null }[];
}

/**
 * Stats de monitoring du feed Signals : quand date le dernier signal trouvé et
 * répartition par source (pour vérifier que chaque source - News, LinkedIn,
 * Apollo - alimente bien le feed). Léger : agrégation en mémoire des 'new'.
 */
export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }

  try {
    // Dernière activité du sweep : max(created_at) tous statuts confondus.
    const { data: newestRow } = await db
      .from("prospect_signals")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Signaux visibles ('new') : agrégés par feed + source.
    const { data: rows } = await db
      .from("prospect_signals")
      .select("feed, source, created_at")
      .eq("status", "new")
      .order("created_at", { ascending: false })
      .limit(2000);

    const newRows = (rows ?? []) as { feed: string; source: string; created_at: string }[];
    const by_feed = { watchlist: 0, discovery: 0 };
    const sources = new Map<string, { count: number; newest: string | null }>();
    for (const r of newRows) {
      if (r.feed === "watchlist") by_feed.watchlist++;
      else if (r.feed === "discovery") by_feed.discovery++;
      const cur = sources.get(r.source) ?? { count: 0, newest: null };
      cur.count++;
      // rows triées created_at desc => le premier vu par source est le plus récent.
      if (!cur.newest) cur.newest = r.created_at;
      sources.set(r.source, cur);
    }

    const by_source = [...sources.entries()]
      .map(([source, v]) => ({ source, count: v.count, newest: v.newest }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({
      ok: true,
      newest_at: (newestRow?.created_at as string | null) ?? null,
      total_new: newRows.length,
      by_feed,
      by_source,
    } satisfies SignalsStatsResponse);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
