/**
 * Scrape hebdomadaire des posts LinkedIn PROPRES (page entreprise "pro" + profil
 * perso), via Bright Data, en remplacement de la saisie manuelle.
 *
 * On tourne en Background Function (runtime ~15 min) donc on utilise directement
 * `triggerDataset` + `pollSnapshot` avec un gros timeout (PAS `collectAndWait`,
 * best-effort ~25 s, qui renverrait souvent [] pour une page active). Le mapping
 * reprend les champs riches de `getCompanyPosts` (cf lib/brightdata/linkedin.ts),
 * appliqués aux DEUX sources : le `getPeopleActivity` existant perd
 * texte/likes/comments, on ne le réutilise pas.
 *
 * Effets : upsert dans `marketing_linkedin_posts` (clé post_url) +
 * actualisation des marqueurs `linkedin_pro`/`linkedin_perso` du graphe Trafic
 * (`marketing_events`, dédup par linkedin_post_url).
 */

import { DATASETS, triggerDataset, pollSnapshot } from "@/lib/brightdata/dataset";
import { db } from "@/lib/db";
import type { LinkedInPostSource } from "@/lib/marketing-types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function str(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}
function num0(v: unknown): number {
  return typeof v === "number" ? v : Number(v) || 0;
}
/** Parse une date Bright Data (`date_posted`) en ISO, ou null si inexploitable. */
function parseDate(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  const ms = Date.parse(s);
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}

/**
 * Clé canonique d'un post = son ID d'activité LinkedIn, stable et unique par
 * publication. ANTI-DOUBLON : Bright Data peut renvoyer la même publication sous
 * des URLs variables (params de tracking, format `/posts/slug-activity-ID-xyz`
 * vs `/feed/update/urn:li:activity:ID`). On reconstruit donc une URL canonique
 * (toujours identique pour un même post) qui sert de clé d'upsert ET reste un
 * permalien cliquable. Fallback (pas d'ID trouvé) : on retire query/fragment/slash final.
 */
function canonicalPostUrl(rawUrl: string): string {
  const url = str(rawUrl).trim();
  if (!url) return url;
  const m = url.match(/(activity|share|ugcPost)[:\-](\d{6,})/i);
  if (m) return `https://www.linkedin.com/feed/update/urn:li:${m[1]}:${m[2]}/`;
  return url.split(/[?#]/)[0].replace(/\/+$/, "");
}

// ── Configuration des sources ──────────────────────────────────────────────────

export interface PostSource {
  url: string;
  source: LinkedInPostSource;
  discoverBy: "company_url" | "profile_url";
  /** Slug de l'entité (ex: "quentinbouche", "coachello-ai-coaching-platform"),
   *  utilisé pour ne garder que SES posts (cf filtre auteur). */
  slug: string;
}

/** Normalise un slug LinkedIn pour comparaison (décodage URL + minuscules). */
function normalizeSlug(s: string): string {
  try {
    return decodeURIComponent(s).trim().toLowerCase();
  } catch {
    return s.trim().toLowerCase();
  }
}

export interface ScrapeOptions {
  /** Timeout du poll Bright Data par source (défaut 6 min). */
  timeoutMs?: number;
  /** Crée les marqueurs du graphe Trafic (défaut true). `false` pour le backfill init. */
  syncEvents?: boolean;
  /** Ne garde que les posts des N derniers jours. Défaut 365 (dernière année). */
  sinceDays?: number;
}

/**
 * Détecte le type de source depuis l'URL :
 *  - `/company/...` → page entreprise ("pro", discovery company_url)
 *  - `/in/...`      → profil perso ("perso", discovery profile_url)
 * Renvoie null si l'URL ne matche ni l'un ni l'autre.
 */
export function detectSource(url: string): PostSource | null {
  const company = url.match(/linkedin\.com\/company\/([^/?#]+)/i);
  if (company) {
    // URL canonique envoyée à Bright Data (on retire /posts/, ?feedView=all, etc.).
    return {
      url: `https://www.linkedin.com/company/${company[1]}/`,
      source: "pro",
      discoverBy: "company_url",
      slug: normalizeSlug(company[1]),
    };
  }
  const profile = url.match(/linkedin\.com\/in\/([^/?#]+)/i);
  if (profile) {
    return {
      url: `https://www.linkedin.com/in/${profile[1]}/`,
      source: "perso",
      discoverBy: "profile_url",
      slug: normalizeSlug(profile[1]),
    };
  }
  return null;
}

/** Parse `LINKEDIN_OWN_POST_SOURCES` (CSV d'URLs) en sources typées. */
export function getConfiguredSources(): PostSource[] {
  const raw = process.env.LINKEDIN_OWN_POST_SOURCES || "";
  const sources: PostSource[] = [];
  for (const part of raw.split(",")) {
    const url = part.trim();
    if (!url) continue;
    const detected = detectSource(url);
    if (!detected) {
      console.warn(`[linkedin-posts] URL ignorée (ni /company/ ni /in/) : ${url}`);
      continue;
    }
    sources.push(detected);
  }
  return sources;
}

// ── Mapping + persistance ────────────────────────────────────────────────────

interface PostRow {
  post_url: string;
  source: LinkedInPostSource;
  source_url: string;
  author: string;
  content: string;
  posted_at: string | null;
  likes: number;
  comments: number;
  raw: Record<string, unknown>;
}

/** Ligne brute Bright Data → row d'upsert (champs riches, comme getCompanyPosts). */
function mapPostRow(raw: Record<string, unknown>, src: PostSource): PostRow | null {
  const post_url = canonicalPostUrl(str(raw.url));
  if (!post_url) return null; // pas d'URL = pas de clé d'upsert → ignoré
  return {
    post_url,
    source: src.source,
    source_url: src.url,
    author: str(raw.user_name || raw.user_title || raw.user_id),
    content: str(raw.post_text || raw.title || raw.headline),
    posted_at: parseDate(raw.date_posted),
    likes: num0(raw.num_likes),
    comments: num0(raw.num_comments),
    raw,
  };
}

// Shape minimale pour construire un marqueur de graphe (PostRow et les lignes DB
// la satisfont toutes les deux).
type EventSource = {
  post_url: string;
  source: LinkedInPostSource;
  content: string;
  posted_at: string | null;
};

/** Post → row marqueur graphe (`marketing_events`). */
function toEventRow(r: EventSource) {
  return {
    event_date: r.posted_at!.slice(0, 10), // YYYY-MM-DD
    event_type: r.source === "pro" ? "linkedin_pro" : "linkedin_perso",
    label: (r.content || "LinkedIn post").slice(0, 80),
    created_by: "auto:linkedin-scrape",
    linkedin_post_url: r.post_url,
  };
}

/**
 * Crée/actualise les marqueurs `linkedin_pro`/`linkedin_perso` du graphe Trafic
 * pour les posts datés. Dédup par `linkedin_post_url` (upsert) : les events
 * manuels (linkedin_post_url NULL) ne sont jamais touchés.
 */
async function syncEventsFromPosts(rows: PostRow[]): Promise<void> {
  const events = rows.filter((r) => r.posted_at).map(toEventRow);
  if (!events.length) return;
  const { error } = await db
    .from("marketing_events")
    .upsert(events, { onConflict: "linkedin_post_url" });
  if (error) console.error("[linkedin-posts] sync events échoué:", error.message);
}

export interface SourceScrapeResult {
  source: LinkedInPostSource;
  url: string;
  discovered: number; // posts ramenés par la découverte (profil + fil)
  scraped: number;    // posts retenus (auteur == source)
  upserted: number;
  error?: string;
}

/**
 * Scrape une source : trigger (discover_new) → poll (timeout long) → map →
 * upsert posts → sync events. Best-effort : ne throw pas.
 */
export async function scrapeOwnPostsForSource(
  src: PostSource,
  opts: ScrapeOptions = {},
): Promise<SourceScrapeResult> {
  const base: SourceScrapeResult = { source: src.source, url: src.url, discovered: 0, scraped: 0, upserted: 0 };
  try {
    // NB : on NE passe PAS start_date/end_date à la discovery. Beaucoup de posts
    // n'ont pas de date côté Bright Data, et une plage de dates les filtre tous
    // (Bright Data recommande lui-même de laisser ces champs vides). On borne donc
    // l'âge uniquement côté client, sur les posts effectivement datés.
    const snapshotId = await triggerDataset(
      DATASETS.posts,
      [{ url: src.url }],
      { type: "discover_new", discoverBy: src.discoverBy },
    );
    const raw = await pollSnapshot<Record<string, unknown>>(snapshotId, {
      timeoutMs: opts.timeoutMs ?? 6 * 60_000,
      intervalMs: 5_000,
    });
    if (!raw) return { ...base, error: "scrape timeout/failed" };
    base.discovered = raw.length;

    // FILTRE AUTEUR (clé du correctif) : la découverte renvoie le profil ciblé PLUS
    // tout son fil d'actualité (posts d'autres auteurs vus/repartagés). On ne garde
    // QUE les posts dont l'auteur == la source configurée (user_id == slug), sinon
    // on importerait le réseau entier (7Speaking, French Tech, etc.).
    const own = raw.filter((r) => normalizeSlug(str(r.user_id)) === src.slug);
    const mapped = own.map((r) => mapPostRow(r, src)).filter((r): r is PostRow => r !== null);
    // Dédup en mémoire par URL canonique : si Bright Data renvoie deux fois la même
    // publication (URLs variables → même canonique), un seul upsert par post — sinon
    // Postgres rejette le batch ("ON CONFLICT ... cannot affect row a second time").
    const byUrl = new Map<string, PostRow>();
    for (const r of mapped) byUrl.set(r.post_url, r);
    let rows = [...byUrl.values()];
    // Fenêtre d'âge : on ne garde que la dernière année (défaut 365 j), pour TOUS
    // les scrapes (init, refresh, cron). Les posts non datés sont conservés (rares).
    const sinceDays = opts.sinceDays ?? 365;
    const cutoff = Date.now() - sinceDays * 864e5;
    rows = rows.filter((r) => !r.posted_at || Date.parse(r.posted_at) >= cutoff);
    base.scraped = rows.length;
    if (!rows.length) return base;

    const now = new Date().toISOString();
    const { error } = await db
      .from("marketing_linkedin_posts")
      .upsert(
        rows.map((r) => ({ ...r, updated_at: now })),
        { onConflict: "post_url" },
      );
    if (error) return { ...base, error: error.message };
    base.upserted = rows.length;

    // Marqueurs du graphe Trafic : activés par défaut (cron hebdo + refresh manuel),
    // désactivés pour le backfill d'initialisation (on ne remplit que la page).
    if (opts.syncEvents !== false) await syncEventsFromPosts(rows);
    return base;
  } catch (e) {
    return { ...base, error: e instanceof Error ? e.message : String(e) };
  }
}

export interface WeeklyScrapeResult {
  ok: boolean;
  sources: number;
  scraped: number;
  upserted: number;
  errors: number;
  perSource: SourceScrapeResult[];
  reason?: string;
}

/**
 * Point d'entrée du cron hebdo : scrape toutes les sources configurées en
 * parallèle (allSettled : un échec de source n'arrête pas les autres).
 */
export async function runWeeklyPostScrape(
  opts: ScrapeOptions = {},
): Promise<WeeklyScrapeResult> {
  if (!process.env.BRIGHTDATA_API_KEY) {
    return { ok: true, sources: 0, scraped: 0, upserted: 0, errors: 0, perSource: [], reason: "brightdata_disabled" };
  }
  const sources = getConfiguredSources();
  if (!sources.length) {
    return { ok: true, sources: 0, scraped: 0, upserted: 0, errors: 0, perSource: [], reason: "no_sources_configured" };
  }

  const settled = await Promise.allSettled(
    sources.map((s) => scrapeOwnPostsForSource(s, opts)),
  );
  const perSource: SourceScrapeResult[] = settled.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : { source: sources[i].source, url: sources[i].url, discovered: 0, scraped: 0, upserted: 0, error: String(r.reason) },
  );

  const discovered = perSource.reduce((n, r) => n + r.discovered, 0);
  const scraped = perSource.reduce((n, r) => n + r.scraped, 0);
  const upserted = perSource.reduce((n, r) => n + r.upserted, 0);
  const errors = perSource.filter((r) => r.error).length;
  console.log(`[linkedin-posts] DONE sources=${sources.length} discovered=${discovered} kept=${scraped} upserted=${upserted} errors=${errors}`);
  return { ok: errors < sources.length, sources: sources.length, scraped, upserted, errors, perSource };
}

// ── Collecte directe par URL (rattrapage des posts ratés par la discovery) ──────

/**
 * Mappe une ligne Bright Data collectée PAR URL (mode `collect`) → row d'upsert.
 * Contrairement à la discovery, PAS de filtre auteur : la collecte est explicite
 * (l'utilisateur fournit l'URL d'un de ses posts). La source pro/perso vient d'abord
 * d'une source configurée matchant l'auteur, sinon de `account_type` Bright Data.
 */
function mapCollectedRow(raw: Record<string, unknown>, configured: PostSource[]): PostRow | null {
  const post_url = canonicalPostUrl(str(raw.url));
  if (!post_url) return null; // pas d'URL = pas de clé d'upsert
  const slug = normalizeSlug(str(raw.user_id));
  const matched = configured.find((s) => s.slug === slug);
  const isCompany = /company|organization/i.test(str(raw.account_type));
  const source: LinkedInPostSource = matched?.source ?? (isCompany ? "pro" : "perso");
  const source_url =
    matched?.url ??
    (source === "pro"
      ? `https://www.linkedin.com/company/${str(raw.user_id)}/`
      : `https://www.linkedin.com/in/${str(raw.user_id)}/`);
  return {
    post_url,
    source,
    source_url,
    author: str(raw.user_name || raw.user_title || raw.user_id),
    content: str(raw.post_text || raw.title || raw.headline),
    posted_at: parseDate(raw.date_posted),
    likes: num0(raw.num_likes),
    comments: num0(raw.num_comments),
    raw,
  };
}

export interface CollectResult {
  ok: boolean;
  requested: number;
  upserted: number;
  error?: string;
}

/**
 * Collecte de posts PAR URL (mode `collect`), FIABLE — contrairement à la discovery
 * par profil qui ne renvoie qu'une tranche récente et volatile du fil. Sert à
 * rattraper un post précis (souvent ancien) absent de la liste : on scrape l'URL
 * fournie et on upsert directement (clé post_url, dédup + marqueurs graphe inclus).
 */
export async function collectPostsByUrl(
  urls: string[],
  opts: { timeoutMs?: number; syncEvents?: boolean } = {},
): Promise<CollectResult> {
  const clean = [...new Set(urls.map((u) => str(u).trim()).filter(Boolean))];
  const baseRes: CollectResult = { ok: true, requested: clean.length, upserted: 0 };
  if (!process.env.BRIGHTDATA_API_KEY) return { ...baseRes, error: "brightdata_disabled" };
  if (!clean.length) return baseRes;

  const configured = getConfiguredSources();
  try {
    const snapshotId = await triggerDataset(DATASETS.posts, clean.map((url) => ({ url })));
    const raw = await pollSnapshot<Record<string, unknown>>(snapshotId, {
      timeoutMs: opts.timeoutMs ?? 6 * 60_000,
      intervalMs: 5_000,
    });
    if (!raw) return { ...baseRes, ok: false, error: "scrape timeout/failed" };

    const mapped = raw
      .filter((r) => !r.error && !r.error_code)
      .map((r) => mapCollectedRow(r, configured))
      .filter((r): r is PostRow => r !== null);
    const byUrl = new Map<string, PostRow>();
    for (const r of mapped) byUrl.set(r.post_url, r);
    const rows = [...byUrl.values()];
    if (!rows.length) return { ...baseRes, ok: false, error: "no_posts_collected" };

    const now = new Date().toISOString();
    const { error } = await db
      .from("marketing_linkedin_posts")
      .upsert(rows.map((r) => ({ ...r, updated_at: now })), { onConflict: "post_url" });
    if (error) return { ...baseRes, ok: false, error: error.message };

    if (opts.syncEvents !== false) await syncEventsFromPosts(rows);
    console.log(`[linkedin-posts] COLLECT done requested=${clean.length} upserted=${rows.length}`);
    return { ...baseRes, ok: true, upserted: rows.length };
  } catch (e) {
    return { ...baseRes, ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
