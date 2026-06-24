import { fetchSerp, parseGoogleDate, BRIGHTDATA_API_KEY } from "@/lib/brightdata/serp";
import { getCompanyJobs, getCompanyPosts } from "@/lib/brightdata/linkedin";
import { slugifyCompany } from "@/lib/slugify-company";
import { searchPeople as apolloSearchPeople, isApolloConfigured } from "@/lib/apollo/client";
import { GLOBAL_SCAN_QUERIES } from "@/lib/signal-scoring";
import type { RawItem, ScoredSignal, SignalType } from "./types";

// Fenêtre de fraîcheur des sources (jours). On récolte large puis Claude trie.
const SINCE_DAYS = 21;

// Presets ICP Coachello (buyers RH / People / L&D).
const ICP_TITLES = ["CHRO", "DRH", "VP People", "Head of L&D", "People", "Talent", "HRBP", "Learning"];
const ICP_SENIORITIES = ["c_suite", "vp", "head", "director"];

function sinceDate(days = SINCE_DAYS): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

interface GoogleNewsItem {
  title?: string;
  link?: string;
  url?: string;
  source?: string;
  date?: string;
  time?: string;
  description?: string;
  snippet?: string;
}

/**
 * Lance une requête Google News arbitraire (pas liée à une société) via la SERP
 * API et renvoie des RawItem. Best-effort : [] si pas de clé / échec.
 */
async function fetchNews(
  query: string,
  opts: {
    feed: RawItem["feed"];
    kindHint: SignalType;
    knownCompanyName?: string | null;
    knownCompanyId?: string | null;
    country?: string;
    lang?: string;
    num?: number;
  },
): Promise<RawItem[]> {
  if (!BRIGHTDATA_API_KEY || !query.trim()) return [];
  const country = (opts.country ?? "fr").toLowerCase();
  const lang = (opts.lang ?? "fr").toLowerCase();
  const num = opts.num ?? 20;
  const q = `${query} after:${sinceDate()}`;
  const url = `https://www.google.com/search?q=${encodeURIComponent(q)}&tbm=nws&brd_json=1&num=${num}&hl=${lang}&gl=${country}`;

  const r = await fetchSerp(url).catch(() => null);
  if (!r || !r.isJson || !r.ok) return [];
  const data = r.data as { news?: GoogleNewsItem[] } | null;
  const news = Array.isArray(data?.news) ? data!.news : [];
  const items: RawItem[] = [];
  for (const n of news) {
    const link = n.link || n.url || "";
    const title = (n.title || "").trim();
    if (!link || !title) continue;
    items.push({
      feed: opts.feed,
      source: "brightdata_serp",
      kindHint: opts.kindHint,
      title,
      url: link,
      snippet: (n.description || n.snippet || "").trim(),
      date: (n.date || n.time || "").trim() || null,
      knownCompanyName: opts.knownCompanyName ?? null,
      knownCompanyId: opts.knownCompanyId ?? null,
    });
  }
  return items;
}

// ── Discovery : requêtes thématiques larges (max recall) ────────────────────

/**
 * Construit la liste des requêtes discovery : déclencheurs de changement (FR+EN)
 * croisés avec l'ICP Coachello, plus le scan marché global (levées, M&A,
 * expansion...). On récolte large ; le tri sujet/persona est fait ensuite par
 * Claude (gate de pertinence dans lib/signal-scoring), qui écarte notamment les
 * nominations de dirigeants hors RH/People/L&D (CRO, CFO...).
 */
export function buildDiscoveryQueries(): { query: string; lang: string; country: string }[] {
  const fr = [
    "nouveau DRH nomination",
    "nouvelle directrice des ressources humaines",
    '"Head of L&D" OR "responsable formation" nomination',
    "restructuration réorganisation entreprise",
    "plan social transformation managériale",
    "levée de fonds scale-up recrutement managers",
    "développement leadership programme managers",
    "VP People Talent nomination",
  ];
  const en = [
    "appoints new CHRO Chief People Officer",
    '"Head of Learning and Development" appointed',
    "company restructuring reorganization leadership",
    "leadership development program managers",
    "layoffs management transformation",
    "raises funding scaling management team",
    "new VP People Talent hire",
  ];
  return [
    ...fr.map((query) => ({ query, lang: "fr", country: "fr" })),
    ...en.map((query) => ({ query, lang: "en", country: "us" })),
    ...GLOBAL_SCAN_QUERIES.map((query) => ({ query, lang: "fr", country: "fr" })),
  ];
}

/** Récolte tous les RawItem discovery (Google News thématique). */
export async function collectDiscoveryRawItems(): Promise<RawItem[]> {
  const queries = buildDiscoveryQueries();
  const batches = await Promise.allSettled(
    queries.map((q) =>
      fetchNews(q.query, {
        feed: "discovery",
        kindHint: "nomination",
        country: q.country,
        lang: q.lang,
        num: 20,
      }),
    ),
  );
  const items: RawItem[] = [];
  for (const b of batches) if (b.status === "fulfilled") items.push(...b.value);
  return dedupeByUrl(items);
}

// ── Watchlist : par compte ──────────────────────────────────────────────────

/**
 * Récolte les RawItem d'un compte watchlist (news ciblées + hiring + posts).
 * `includeSlowSources=false` (refresh manuel) saute les datasets LinkedIn
 * (jobs/posts), lents, et ne garde que la news SERP (rapide).
 */
export async function collectWatchlistRawItems(
  company: { id: string; name: string },
  opts: { includeSlowSources?: boolean } = {},
): Promise<RawItem[]> {
  const name = company.name.trim();
  if (!name) return [];
  const quoted = `"${name}"`;
  const slug = slugifyCompany(name);

  const newsQueries: { q: string; kind: SignalType }[] = [
    { q: `${quoted} (levée OR financement OR acquisition OR rachat OR funding OR raises)`, kind: "funding" },
    { q: `${quoted} (nomination OR "nouveau directeur" OR "nouvelle directrice" OR DRH OR appoints OR "joins as")`, kind: "nomination" },
    { q: `${quoted} (restructuration OR réorganisation OR "plan social" OR layoffs OR restructuring)`, kind: "restructuring" },
  ];

  const tasks: Promise<RawItem[]>[] = newsQueries.map((nq) =>
    fetchNews(nq.q, {
      feed: "watchlist",
      kindHint: nq.kind,
      knownCompanyName: name,
      knownCompanyId: company.id,
      num: 15,
    }),
  );

  if (opts.includeSlowSources) {
    // Hiring (dataset LinkedIn, best-effort court).
    tasks.push(
      getCompanyJobs(name, { timeoutMs: 20_000 })
        .then((r) =>
          (r.data ?? []).slice(0, 10).map<RawItem>((j) => ({
            feed: "watchlist",
            source: "brightdata_linkedin",
            kindHint: "hiring",
            title: `${name} is hiring: ${j.title}`,
            url: j.url || null,
            snippet: `Open role: ${j.title}${j.location ? ` (${j.location})` : ""}`,
            date: j.postedAt || null,
            knownCompanyName: name,
            knownCompanyId: company.id,
          })),
        )
        .catch(() => [] as RawItem[]),
    );
    // Posts entreprise (dataset LinkedIn, best-effort).
    tasks.push(
      getCompanyPosts(slug, { timeoutMs: 22_000 })
        .then((r) =>
          (r.data ?? []).slice(0, 8).map<RawItem>((p) => ({
            feed: "watchlist",
            source: "brightdata_linkedin",
            kindHint: "linkedin_post",
            title: `${name} on LinkedIn: ${p.text.slice(0, 70)}${p.text.length > 70 ? "…" : ""}`,
            url: p.postUrl || null,
            snippet: p.text.slice(0, 400),
            date: p.postedAt || null,
            knownCompanyName: name,
            knownCompanyId: company.id,
          })),
        )
        .catch(() => [] as RawItem[]),
    );
  }

  const settled = await Promise.allSettled(tasks);
  const items: RawItem[] = [];
  for (const s of settled) if (s.status === "fulfilled") items.push(...s.value);
  return dedupeByUrl(items);
}

// ── Apollo : nouveaux décideurs ICP (signal people_move, sans crédit) ───────

const SENIORITY_SCORE: Record<string, number> = {
  c_suite: 80,
  vp: 72,
  head: 66,
  director: 58,
};

/**
 * Cherche les décideurs ICP d'un compte via Apollo (searchPeople = gratuit, pas
 * de reveal) et émet un signal "nouveau décideur" pour ceux ABSENTS du CRM.
 * Le reveal d'email (1 crédit) n'a lieu qu'au "act". Best-effort.
 */
export async function collectApolloPeopleMoves(params: {
  companyName: string;
  scopeCompanyId: string;
  domain?: string | null;
  existingEmails: Set<string>;
  existingNames: Set<string>;
}): Promise<ScoredSignal[]> {
  if (!isApolloConfigured() || !params.companyName.trim()) return [];
  const res = await apolloSearchPeople({
    domain: params.domain ?? undefined,
    organizationName: params.domain ? undefined : params.companyName,
    titles: ICP_TITLES,
    seniorities: ICP_SENIORITIES,
    perPage: 10,
  }).catch(() => null);
  if (!res) return [];

  const out: ScoredSignal[] = [];
  for (const p of res.people) {
    const name = (p.name || `${p.first_name ?? ""} ${p.last_name ?? ""}`).trim();
    if (!name) continue;
    const nameKey = name.toLowerCase();
    const emailKey = (p.email ?? "").toLowerCase();
    // Déjà en CRM (par email réel ou par nom) => pas un nouveau décideur pour nous.
    if (emailKey && !emailKey.includes("email_not_unlocked") && params.existingEmails.has(emailKey)) continue;
    if (params.existingNames.has(nameKey)) continue;

    const score = SENIORITY_SCORE[(p.seniority ?? "").toLowerCase()] ?? 55;
    out.push({
      feed: "watchlist",
      source: "apollo",
      signal_type: "job_change",
      company_name: params.companyName,
      company_domain: params.domain ?? null,
      scope_company_id: params.scopeCompanyId,
      category: "leadership",
      title: `${name}${p.title ? ` - ${p.title}` : ""} at ${params.companyName}`,
      url: p.linkedin_url,
      summary: `Decision-maker on the ICP not yet in our CRM. ${p.title ?? ""} at ${params.companyName}. Worth reaching out.`.trim(),
      why_relevant: "New ICP decision-maker (HR / People / L&D) to engage.",
      suggested_action: "Reveal contact and send a tailored opening message.",
      score,
      signal_date: null,
    });
  }
  return out;
}

// ── Utilitaire ───────────────────────────────────────────────────────────────

function dedupeByUrl(items: RawItem[]): RawItem[] {
  const seen = new Set<string>();
  const out: RawItem[] = [];
  for (const it of items) {
    const key = it.url ?? `${it.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}

/** Convertit un libellé de date brut en ISO (ou null). */
export function rawDateToIso(label: string | null): string | null {
  const ms = parseGoogleDate(label);
  if (ms) return new Date(ms).toISOString();
  if (label) {
    const direct = Date.parse(label);
    if (!Number.isNaN(direct)) return new Date(direct).toISOString();
  }
  return null;
}
