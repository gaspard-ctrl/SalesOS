// Helpers d'affichage du dashboard AE : formatage, sommes, deltas période sur
// période, statut RAG et KPIs dérivés.

import type {
  ActivityBucket,
  FunnelStage,
  Granularity,
  LostReason,
  RepSnapshot,
  RevenuePerf,
  RevenueQuarter,
} from "@/lib/ae-activity/types";
import { GRANULARITIES } from "@/lib/ae-activity/types";

export const DISPOSITION_ORDER = [
  "Connected",
  "No answer",
  "Left voicemail",
  "Left live message",
  "Busy",
  "Gatekeeper",
  "Wrong number",
];

export const DISPOSITION_COLORS: Record<string, string> = {
  Connected: "#16a34a",
  "No answer": "#94a3b8",
  "Left voicemail": "#f59e0b",
  "Left live message": "#d97706",
  Busy: "#dc2626",
  Gatekeeper: "#8b5cf6",
  "Wrong number": "#b91c1c",
};

export function fmtInt(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

export function fmtEUR(n: number | null | undefined): string {
  if (n == null) return "-";
  return `${Math.round(n).toLocaleString("en-US")} €`;
}

export function fmtEURCompact(n: number | null | undefined): string {
  if (n == null) return "-";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M €`;
  if (abs >= 1_000) return `${Math.round(n / 1_000)}k €`;
  return `${Math.round(n)} €`;
}

export function pct(a: number, b: number): number {
  return b > 0 ? Math.round((a / b) * 100) : 0;
}

export function ratio(a: number, b: number): string {
  return b > 0 ? (a / b).toFixed(1) : "-";
}

export function sumField(buckets: ActivityBucket[], get: (b: ActivityBucket) => number): number {
  return buckets.reduce((acc, b) => acc + (get(b) || 0), 0);
}

export function sumDisposition(buckets: ActivityBucket[], label: string): number {
  return buckets.reduce((acc, b) => acc + (b.dispositions?.[label] || 0), 0);
}

export type Delta = { pct: number | null; dir: "up" | "down" | "flat" } | null;

/**
 * Delta de la dernière période complète vs la précédente, pour un champ donné.
 * null si moins de 2 périodes. pct=null quand la période précédente était à 0
 * (pas de base de comparaison) mais qu'il y a du nouveau (dir=up).
 */
export function deltaFor(buckets: ActivityBucket[], get: (b: ActivityBucket) => number): Delta {
  if (buckets.length < 2) return null;
  const cur = get(buckets[buckets.length - 1]) || 0;
  const prev = get(buckets[buckets.length - 2]) || 0;
  if (prev === 0) return cur > 0 ? { pct: null, dir: "up" } : null;
  const change = ((cur - prev) / prev) * 100;
  return { pct: Math.round(change), dir: change > 0 ? "up" : change < 0 ? "down" : "flat" };
}

// Statut RAG d'un % d'atteinte d'objectif (vert ≥ 90, orange ≥ 60, rouge < 60).
export function ragColor(attainmentPct: number | null): { fg: string; bg: string } {
  if (attainmentPct == null) return { fg: "#888", bg: "#f5f5f5" };
  if (attainmentPct >= 90) return { fg: "#166534", bg: "#f0fdf4" };
  if (attainmentPct >= 60) return { fg: "#b45309", bg: "#fef3c7" };
  return { fg: "#991b1b", bg: "#fee2e2" };
}

export type Kpi = {
  label: string;
  value: string;
  sub?: string;
  delta?: Delta;
  accentValue?: boolean; // valeur en couleur d'accent (KPI clé)
};

// Mot de période (période en cours) selon la granularité, pour le libellé UI.
export const PERIOD_WORD: Record<Granularity, string> = {
  week: "cette semaine",
  month: "ce mois",
  quarter: "ce trimestre",
  semester: "ce semestre",
};

/**
 * KPI cards : le chiffre principal est la PÉRIODE EN COURS (dernier bucket de la
 * granularité sélectionnée), le delta compare à la période précédente, et le
 * sous-texte donne le cumul depuis le 1er janvier. Changer la granularité change
 * donc bien les chiffres du haut.
 */
export function buildKpis(buckets: ActivityBucket[]): Kpi[] {
  const last = buckets.length ? buckets[buckets.length - 1] : null;
  const cur = (get: (b: ActivityBucket) => number): number => (last ? get(last) || 0 : 0);
  const cum = (get: (b: ActivityBucket) => number): number => sumField(buckets, get);

  const cumOutbound = cum((b) => b.outboundCalls);
  const cumConnected = sumDisposition(buckets, "Connected");
  const cumMeetings = cum((b) => b.meetingsScheduled);
  const cumWon = cum((b) => b.closedWon);
  const cumLost = cum((b) => b.closedLost);
  const cumSlack = cum((b) => b.selfBookedSlack);

  return [
    {
      label: "Appels sortants",
      value: fmtInt(cur((b) => b.outboundCalls)),
      sub: `${fmtInt(cumOutbound)} cumulés · ${pct(cumConnected, cumOutbound)}% connect.`,
      delta: deltaFor(buckets, (b) => b.outboundCalls),
    },
    {
      label: "Emails prospection",
      value: fmtInt(cur((b) => b.emailsOut)),
      sub: `${fmtInt(cum((b) => b.emailsOut))} cumulés · vers nouveaux contacts`,
      delta: deltaFor(buckets, (b) => b.emailsOut),
    },
    {
      label: "Meetings bookés",
      value: fmtInt(cur((b) => b.meetingsScheduled)),
      sub: `${fmtInt(cumMeetings)} cumulés · ${ratio(cumOutbound, cumMeetings)} appels/mtg`,
      delta: deltaFor(buckets, (b) => b.meetingsScheduled),
    },
    {
      label: "dont inbound / self",
      value: `${fmtInt(cur((b) => b.meetingsInboundSourced))} / ${fmtInt(cur((b) => b.meetingsSelfSourced))}`,
      sub: `cumul ${fmtInt(cum((b) => b.meetingsInboundSourced))} / ${fmtInt(cum((b) => b.meetingsSelfSourced))}`,
    },
    {
      label: "Meetings tenus",
      value: fmtInt(cur((b) => b.meetingsHeld)),
      sub: `${fmtInt(cum((b) => b.meetingsHeld))} cumulés (Claap)`,
      delta: deltaFor(buckets, (b) => b.meetingsHeld),
    },
    {
      label: "Loggés Slack",
      value: cumSlack > 0 ? fmtInt(cur((b) => b.selfBookedSlack)) : "-",
      sub: cumSlack > 0 ? `${fmtInt(cumSlack)} cumulés` : "auto-déclarés",
    },
    {
      label: "Leads inbound",
      value: fmtInt(cur((b) => b.leadsInbound)),
      sub: `${fmtInt(cum((b) => b.leadsInbound))} cumulés (leads marketing)`,
      delta: deltaFor(buckets, (b) => b.leadsInbound),
    },
    {
      label: "Deals ouverts",
      value: fmtInt(cur((b) => b.dealsOpened)),
      sub: `${fmtInt(cum((b) => b.dealsOpened))} cumulés · ${fmtInt(cum((b) => b.dealsOpenedInbound))} inbound`,
      delta: deltaFor(buckets, (b) => b.dealsOpened),
    },
    {
      label: "Deals gagnés",
      value: fmtInt(cur((b) => b.closedWon)),
      sub: `${cumWon}G / ${cumLost}P cumulés · win ${pct(cumWon, cumWon + cumLost)}%`,
      delta: deltaFor(buckets, (b) => b.closedWon),
      accentValue: true,
    },
  ];
}

// Dispositions présentes dans les buckets, ordonnées (ordre canonique puis reste).
export function dispositionLabels(buckets: ActivityBucket[]): string[] {
  const present = new Set<string>();
  for (const b of buckets) for (const k of Object.keys(b.dispositions || {})) present.add(k);
  const ordered = DISPOSITION_ORDER.filter((l) => present.has(l));
  const rest = [...present].filter((l) => !DISPOSITION_ORDER.includes(l));
  return [...ordered, ...rest];
}

export function lastRefreshLabel(iso: string | null): string {
  if (!iso) return "jamais";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const h = diff / 3_600_000;
  const rel = h < 1 ? "il y a < 1h" : h < 24 ? `il y a ${Math.round(h)}h` : `il y a ${Math.floor(h / 24)}j`;
  return `${d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })} (${rel})`;
}

// Totaux revenu pour affichage compact.
export function revenueAttainment(billed: number | null, target: number | null): number | null {
  if (billed == null || target == null || target === 0) return null;
  return Math.round((billed / target) * 100);
}

// ── Agrégation équipe (vue "Tous") ────────────────────────────────────────

const NUM_FIELDS = [
  "outboundCalls",
  "inboundCalls",
  "emailsOut",
  "meetingsScheduled",
  "meetingsInboundSourced",
  "meetingsSelfSourced",
  "meetingsHeld",
  "selfBookedSlack",
  "dealsOpened",
  "dealsOpenedInbound",
  "leadsInbound",
  "closedWon",
  "closedLost",
] as const;

function emptyBucket(key: string, label: string): ActivityBucket {
  const b: ActivityBucket = {
    key,
    label,
    outboundCalls: 0,
    inboundCalls: 0,
    emailsOut: 0,
    meetingsScheduled: 0,
    meetingsInboundSourced: 0,
    meetingsSelfSourced: 0,
    meetingsHeld: 0,
    selfBookedSlack: 0,
    dealsOpened: 0,
    dealsOpenedInbound: 0,
    leadsInbound: 0,
    closedWon: 0,
    closedLost: 0,
    dispositions: {},
  };
  return b;
}

function mergeBuckets(lists: ActivityBucket[][]): ActivityBucket[] {
  const map = new Map<string, ActivityBucket>();
  for (const list of lists) {
    for (const b of list) {
      let m = map.get(b.key);
      if (!m) {
        m = emptyBucket(b.key, b.label);
        map.set(b.key, m);
      }
      for (const f of NUM_FIELDS) m[f] = (m[f] as number) + ((b[f] as number) || 0);
      for (const [k, v] of Object.entries(b.dispositions || {})) {
        m.dispositions[k] = (m.dispositions[k] || 0) + v;
      }
    }
  }
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
}

function mergeFunnelStages(lists: FunnelStage[][]): FunnelStage[] {
  const map = new Map<string, FunnelStage>();
  for (const list of lists) {
    for (const s of list ?? []) {
      const cur = map.get(s.id);
      if (cur) cur.count += s.count;
      else map.set(s.id, { id: s.id, label: s.label, count: s.count });
    }
  }
  return [...map.values()];
}

function mergeLost(reps: RepSnapshot[]): LostReason[] {
  const map = new Map<string, number>();
  for (const r of reps) {
    for (const l of r.lostReasons) map.set(l.reason, (map.get(l.reason) || 0) + l.count);
  }
  return [...map.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);
}

function sumOrNull(reps: RepSnapshot[], get: (r: RevenuePerf) => number | null): number | null {
  let any = false;
  let s = 0;
  for (const r of reps) {
    const v = get(r.revenue);
    if (v != null) {
      any = true;
      s += v;
    }
  }
  return any ? s : null;
}

function mergeRevenue(reps: RepSnapshot[]): RevenuePerf {
  const order: RevenueQuarter["quarter"][] = ["Q1", "Q2", "Q3", "Q4"];
  const qMap = new Map<string, { newTarget: number | null; newBilled: number | null }>();
  for (const r of reps) {
    for (const q of r.revenue.quarters) {
      const cur = qMap.get(q.quarter) ?? { newTarget: null, newBilled: null };
      if (q.newTarget != null) cur.newTarget = (cur.newTarget ?? 0) + q.newTarget;
      if (q.newBilled != null) cur.newBilled = (cur.newBilled ?? 0) + q.newBilled;
      qMap.set(q.quarter, cur);
    }
  }
  const quarters: RevenueQuarter[] = order
    .filter((q) => qMap.has(q))
    .map((q) => ({ quarter: q, ...qMap.get(q)! }));

  return {
    matched: reps.some((r) => r.revenue.matched),
    sheetName: null,
    newTarget: sumOrNull(reps, (rv) => rv.newTarget),
    newBilled: sumOrNull(reps, (rv) => rv.newBilled),
    renewTarget: sumOrNull(reps, (rv) => rv.renewTarget),
    renewBilled: sumOrNull(reps, (rv) => rv.renewBilled),
    quarters,
  };
}

/**
 * Fusionne tous les reps en un snapshot équipe unique (vue "Tous") : buckets
 * sommés par période, funnel et raisons de perte cumulés, revenu/objectifs
 * additionnés. Le coaching (par rep) n'est pas agrégé.
 */
export function aggregateReps(reps: RepSnapshot[]): RepSnapshot {
  const byGranularity = Object.fromEntries(
    GRANULARITIES.map((g) => [g, mergeBuckets(reps.map((r) => r.byGranularity[g] ?? []))]),
  ) as RepSnapshot["byGranularity"];

  return {
    repOwnerId: "__all__",
    repName: `Tous les sales · ${reps.length} AE`,
    repEmail: null,
    accent: "#f01563",
    byGranularity,
    funnel: mergeFunnelStages(reps.map((r) => r.funnel)),
    leadsFunnel: mergeFunnelStages(reps.map((r) => r.leadsFunnel)),
    lostReasons: mergeLost(reps),
    revenue: mergeRevenue(reps),
    coaching: {
      insights: [],
      meetingsAnalyzed: reps.reduce((s, r) => s + r.coaching.meetingsAnalyzed, 0),
      generatedAt: null,
    },
    dataWarnings: [],
  };
}
