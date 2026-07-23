// ────────────────────────────────────────────────────────────────────────
// Types partagés du dashboard "AE Sales Activity".
//
// Contrat entre la couche serveur (fetch HubSpot + Sheet + Claap + Slack +
// Sales Coach → build-snapshot) et l'UI. Le payload JSONB d'une row
// `ae_activity_snapshots` EST un RepSnapshot.
// ────────────────────────────────────────────────────────────────────────

// Granularités du sélecteur UI.
export type Granularity = "week" | "month" | "quarter" | "semester";

export const GRANULARITIES: Granularity[] = ["week", "month", "quarter", "semester"];

export const GRANULARITY_LABEL: Record<Granularity, string> = {
  week: "Weekly",
  month: "Monthly",
  quarter: "Quarterly",
  semester: "Semester",
};

// Un bucket temporel d'activité (tous les compteurs sont sommés sur la période).
export type ActivityBucket = {
  key: string; // début de période ISO (YYYY-MM-DD) ou "2026-H1" pour le semestre
  label: string; // libellé d'affichage ("Jan 26", "Q1 2026", "H1 2026"…)
  outboundCalls: number;
  inboundCalls: number;
  emailsOut: number; // emails de prospection (sortants vers contact sans email entrant)
  meetingsScheduled: number;
  meetingsInboundSourced: number; // meeting rattaché à un lead marketing
  meetingsSelfSourced: number;
  meetingsHeld: number; // Claap (meetings enregistrés avec prospect)
  selfBookedSlack: number; // Slack #new-meetings (auto-déclarés)
  dealsOpened: number;
  dealsOpenedInbound: number; // deal rattaché à un lead marketing
  leadsInbound: number; // leads marketing validés attribués au rep (par validated_at)
  closedWon: number;
  closedLost: number;
  dispositions: Record<string, number>; // issues d'appels sortants (label → count)
};

export type FunnelStage = { id: string; label: string; count: number };

export type LostReason = { reason: string; count: number };

// Revenu + objectifs tirés du Sheet Drive, par rep. Montants en EUR.
export type RevenueQuarter = {
  quarter: "Q1" | "Q2" | "Q3" | "Q4";
  newTarget: number | null;
  newBilled: number | null;
};

export type RevenuePerf = {
  matched: boolean; // le rep a-t-il été retrouvé dans le Sheet ?
  sheetName: string | null; // le prénom/label matché dans le Sheet
  newTarget: number | null;
  newBilled: number | null;
  renewTarget: number | null;
  renewBilled: number | null;
  quarters: RevenueQuarter[]; // NEW par trimestre (métrique AE)
};

export type Coaching = {
  insights: string[]; // 3-5 puces synthétisées depuis Sales Coach
  meetingsAnalyzed: number; // nb de meetings Claap analysés pris en compte
  generatedAt: string | null; // ISO
};

// Snapshot complet d'un rep = payload JSONB d'une row ae_activity_snapshots.
export type RepSnapshot = {
  repOwnerId: string;
  repName: string;
  repEmail: string | null;
  accent: string; // couleur d'accent (repAccent)
  byGranularity: Record<Granularity, ActivityBucket[]>;
  funnel: FunnelStage[]; // funnel des deals (deals créés par étape actuelle)
  leadsFunnel: FunnelStage[]; // funnel des leads marketing (validés → deal → étapes → won)
  lostReasons: LostReason[];
  revenue: RevenuePerf;
  coaching: Coaching;
  dataWarnings: string[]; // métriques HubSpot revenues vides, etc.
};

// Réponse de l'API GET /api/admin/ae-activity.
export type AeActivityMeta = {
  status: "idle" | "running" | "done" | "error";
  startedAt: string | null;
  finishedAt: string | null;
  errorMessage: string | null;
  repCount: number | null;
};

export type AeActivityResponse = {
  reps: RepSnapshot[];
  refreshedAt: string | null; // MAX(refreshed_at) des rows rep
  meta: AeActivityMeta;
};
