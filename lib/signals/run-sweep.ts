import { db } from "@/lib/db";
import { fetchCompanyContacts } from "@/lib/watchlist/fetch-company-contacts";
import {
  collectWatchlistRawItems,
  collectDiscoveryRawItems,
  collectApolloPeopleMoves,
} from "./sources";
import { classifyItems } from "./classify";
import { linkExistingCompanies } from "./resolve-company";
import { dedupeKey } from "./dedupe";
import type { ScoredSignal, SignalFeed } from "./types";

// ── Réglages (faciles à ajuster) ─────────────────────────────────────────────
// Le tri par SUJET/PERSONA est fait en amont par le gate de pertinence
// (lib/signal-scoring) ; ces seuils ne filtrent que la qualité/fraîcheur, ils
// restent volontairement modérés pour laisser passer les news générales de
// marché (levées, M&A, expansion) qui scorent moyennement faute de décideur nommé.
const MIN_SCORE_WATCHLIST = 45;
const MIN_SCORE_DISCOVERY = 62; // barre plus haute pour le discovery
const FRESHNESS_DAYS = 14; // fenêtre de visibilité du feed
const CAP_PER_COMPANY = 5; // max signaux 'new' par compte watchlist
const CAP_DISCOVERY = 50; // max signaux 'new' discovery globaux
const COMPANY_CONCURRENCY = 4;

export interface SweepOptions {
  feed?: SignalFeed | "both";
  /** Restreindre à certains comptes (refresh ciblé). Sinon tous. */
  companyIds?: string[];
  /** Inclure Apollo (nouveaux décideurs ICP). Daily only. */
  includeApollo?: boolean;
  /** Inclure les datasets LinkedIn lents (jobs/posts). Daily only. */
  includeSlowSources?: boolean;
  userId?: string | null;
}

export interface SweepResult {
  ok: boolean;
  inserted: number;
  watchlist: number;
  discovery: number;
  expired: number;
  error?: string;
}

/**
 * Orchestrateur unique du pipeline Signals, réutilisé par le cron quotidien et
 * le refresh manuel. Récolte -> classify Claude -> dedupe -> upsert (insert only
 * new) -> rétention (expiration + plafonds).
 */
export async function runSignalsSweep(opts: SweepOptions = {}): Promise<SweepResult> {
  const feed = opts.feed ?? "both";
  const userId = opts.userId ?? null;
  try {
    const all: ScoredSignal[] = [];

    // ── Watchlist ──
    if (feed === "watchlist" || feed === "both") {
      let q = db.from("scope_companies").select("id, name").order("name", { ascending: true });
      if (opts.companyIds?.length) q = q.in("id", opts.companyIds);
      const { data: companiesRaw } = await q;
      const companies = (companiesRaw ?? []) as { id: string; name: string }[];

      const watchlistSignals = await mapLimit(companies, COMPANY_CONCURRENCY, async (c) => {
        const raw = await collectWatchlistRawItems(c, { includeSlowSources: opts.includeSlowSources });
        const scored = await classifyItems(raw, { userId });
        const out = scored.filter((s) => s.score >= MIN_SCORE_WATCHLIST);

        if (opts.includeApollo) {
          const { contacts } = await fetchCompanyContacts(c.id).catch(() => ({ contacts: [] }));
          const existingEmails = new Set(
            contacts.map((ct) => (ct.email ?? "").toLowerCase()).filter(Boolean),
          );
          const existingNames = new Set(
            contacts
              .map((ct) => `${ct.firstname ?? ""} ${ct.lastname ?? ""}`.trim().toLowerCase())
              .filter(Boolean),
          );
          const apollo = await collectApolloPeopleMoves({
            companyName: c.name,
            scopeCompanyId: c.id,
            existingEmails,
            existingNames,
          });
          out.push(...apollo.filter((s) => s.score >= MIN_SCORE_WATCHLIST));
        }
        return out;
      });
      for (const arr of watchlistSignals) all.push(...arr);
    }

    // ── Discovery ──
    if (feed === "discovery" || feed === "both") {
      const raw = await collectDiscoveryRawItems();
      const scored = await classifyItems(raw, { userId });
      const kept = scored.filter((s) => s.score >= MIN_SCORE_DISCOVERY);
      // Relie au watchlist si le compte y est déjà (bascule en feed watchlist).
      const { data: companiesRaw } = await db.from("scope_companies").select("id, name");
      const linked = linkExistingCompanies(kept, (companiesRaw ?? []) as { id: string; name: string }[]);
      all.push(...linked);
    }

    const inserted = await persistSignals(all, userId);
    const counts = all.reduce(
      (acc, s) => {
        acc[s.feed]++;
        return acc;
      },
      { watchlist: 0, discovery: 0 } as Record<SignalFeed, number>,
    );

    const expired = await applyRetention();

    return { ok: true, inserted, watchlist: counts.watchlist, discovery: counts.discovery, expired };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error("[signals/run-sweep] failed:", error);
    return { ok: false, inserted: 0, watchlist: 0, discovery: 0, expired: 0, error };
  }
}

// ── Persistance (insert only new) ────────────────────────────────────────────

async function persistSignals(signals: ScoredSignal[], userId: string | null): Promise<number> {
  if (signals.length === 0) return 0;

  // Dédup en mémoire sur dedupe_key avant l'upsert (garde le meilleur score).
  const byKey = new Map<string, { s: ScoredSignal; key: string }>();
  for (const s of signals) {
    const key = dedupeKey(s);
    const prev = byKey.get(key);
    if (!prev || s.score > prev.s.score) byKey.set(key, { s, key });
  }

  const rows = [...byKey.values()].map(({ s, key }) => ({
    scope_company_id: s.scope_company_id,
    feed: s.feed,
    company_name: s.company_name,
    company_domain: s.company_domain,
    company_linkedin: null,
    signal_type: s.signal_type,
    source: s.source,
    category: s.category,
    title: s.title.slice(0, 300),
    url: s.url,
    summary: s.summary,
    why_relevant: s.why_relevant,
    suggested_action: s.suggested_action,
    score: s.score,
    dedupe_key: key,
    signal_date: s.signal_date,
    created_by: userId,
  }));

  // ignoreDuplicates : ON CONFLICT (dedupe_key) DO NOTHING. Renvoie seulement
  // les lignes réellement insérées.
  const { data, error } = await db
    .from("prospect_signals")
    .upsert(rows, { onConflict: "dedupe_key", ignoreDuplicates: true })
    .select("id");
  if (error) {
    console.error("[signals/persist] upsert error:", error.message);
    return 0;
  }
  return data?.length ?? 0;
}

// ── Rétention (anti-empilement) ──────────────────────────────────────────────

async function applyRetention(): Promise<number> {
  let expired = 0;
  const cutoff = new Date(Date.now() - FRESHNESS_DAYS * 86_400_000).toISOString();
  const nowIso = new Date().toISOString();

  // 0) Réveil des signaux snoozés dont l'échéance est passée : snoozed -> new.
  //    Sans ça le snooze équivaut à un dismiss définitif (le feed ne lit que
  //    'new'). L'étape 1 ci-dessous ré-expirera ceux redevenus hors fenêtre.
  await db
    .from("prospect_signals")
    .update({ status: "new", snooze_until: null, updated_at: nowIso })
    .eq("status", "snoozed")
    .lte("snooze_until", nowIso);

  // 1) Expiration des 'new' hors fenêtre de fraîcheur. On se base sur created_at
  //    (date de DÉCOUVERTE du signal), pas signal_date : ce dernier est à la
  //    granularité du mois (snappé au 1er) et ferait expirer à tort des signaux
  //    récents. Un signal découvert aujourd'hui reste 14 j quoi qu'il arrive.
  const stale = await db
    .from("prospect_signals")
    .update({ status: "expired", updated_at: nowIso })
    .eq("status", "new")
    .lt("created_at", cutoff)
    .select("id");
  expired += stale.data?.length ?? 0;

  // 2) Plafonds : on récupère les 'new' restants et on expire le surplus.
  const { data: live } = await db
    .from("prospect_signals")
    .select("id, feed, scope_company_id, score")
    .eq("status", "new")
    .order("score", { ascending: false })
    .range(0, 9_999); // au-delà du défaut Supabase (~1000) pour ne pas rater le surplus
  const rows = (live ?? []) as { id: string; feed: SignalFeed; scope_company_id: string | null; score: number }[];

  const toExpire: string[] = [];
  const perCompany = new Map<string, number>();
  let discoveryCount = 0;
  for (const r of rows) {
    if (r.feed === "watchlist" && r.scope_company_id) {
      const n = (perCompany.get(r.scope_company_id) ?? 0) + 1;
      perCompany.set(r.scope_company_id, n);
      if (n > CAP_PER_COMPANY) toExpire.push(r.id);
    } else {
      discoveryCount++;
      if (discoveryCount > CAP_DISCOVERY) toExpire.push(r.id);
    }
  }

  if (toExpire.length > 0) {
    // Chunk pour éviter une clause IN trop longue.
    for (let i = 0; i < toExpire.length; i += 200) {
      const chunk = toExpire.slice(i, i + 200);
      const res = await db
        .from("prospect_signals")
        .update({ status: "expired", updated_at: nowIso })
        .in("id", chunk)
        .select("id");
      expired += res.data?.length ?? 0;
    }
  }

  return expired;
}

// ── Utilitaire concurrence ───────────────────────────────────────────────────

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let idx = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (idx < items.length) {
      const cur = idx++;
      out[cur] = await fn(items[cur]);
    }
  });
  await Promise.all(workers);
  return out;
}
