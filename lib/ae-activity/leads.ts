// ────────────────────────────────────────────────────────────────────────
// Leads marketing (tables `leads` + `lead_analyses`) : source de vérité de
// l'INBOUND du dashboard AE (remplace hs_analytics_source de HubSpot).
//
// On charge les leads VALIDÉS une seule fois, indexés par owner (attribution
// rep = owner du deal matché), avec des sets globaux (contact ids / deal ids /
// emails / noms normalisés) pour rapprocher meetings et deals d'un lead.
//
// Best-effort : renvoie une structure vide en cas d'erreur (colonnes absentes,
// migrations non appliquées…), sans jamais faire planter le refresh.
// ────────────────────────────────────────────────────────────────────────

import { db } from "@/lib/db";
import { normalizePerson } from "@/lib/fuzzy-match";
import { toDayString } from "./aggregate";
import type { FunnelStage } from "./types";
import type { PipelineStage } from "./fetch-hubspot";

export type LeadRow = {
  ownerId: string | null; // deal_owner_id ?? contact_owner_id ?? hubspot_lead_owner_id
  validatedDay: string | null; // validated_at ?? posted_at → "YYYY-MM-DD"
  dealStageId: string | null; // deal_stage (id HubSpot, snapshot)
  hasDeal: boolean;
  isWon: boolean;
  contactId: string | null;
  dealId: string | null;
  email: string | null; // extracted_email (lowercase)
  normName: string | null; // normalizePerson(extracted_name)
};

export type MarketingLeads = {
  all: LeadRow[];
  byOwner: Map<string, LeadRow[]>;
  contactIds: Set<string>;
  dealIds: Set<string>;
  emails: Set<string>;
  normNames: Set<string>;
  normNamesList: string[]; // pour le matching fuzzy (jaroWinkler)
};

export function emptyMarketingLeads(): MarketingLeads {
  return {
    all: [],
    byOwner: new Map(),
    contactIds: new Set(),
    dealIds: new Set(),
    emails: new Set(),
    normNames: new Set(),
    normNamesList: [],
  };
}

type AnalysisRow = {
  hubspot_contact_id: string | null;
  hubspot_deal_id: string | null;
  deal_owner_id: string | null;
  contact_owner_id: string | null;
  hubspot_lead_owner_id: string | null;
  deal_stage: string | null;
  deal_is_closed_won: boolean | null;
  extracted_email: string | null;
  extracted_name: string | null;
};

type LeadJoin = {
  posted_at: string | null;
  validated_at: string | null;
  analysis: AnalysisRow | AnalysisRow[] | null;
};

const SELECT =
  "posted_at, validated_at, analysis:lead_analyses!leads_last_analysis_id_fkey(" +
  "hubspot_contact_id, hubspot_deal_id, deal_owner_id, contact_owner_id, hubspot_lead_owner_id, " +
  "deal_stage, deal_is_closed_won, extracted_email, extracted_name)";

export async function fetchMarketingLeads(startDay: string): Promise<MarketingLeads> {
  const result = emptyMarketingLeads();
  try {
    const { data, error } = await db
      .from("leads")
      .select(SELECT)
      .eq("validation_status", "validated")
      .gte("posted_at", `${startDay}T00:00:00Z`);

    if (error) {
      console.warn("[ae-activity] leads query failed:", error.message);
      return result;
    }

    for (const row of (data ?? []) as unknown as LeadJoin[]) {
      const a = Array.isArray(row.analysis) ? row.analysis[0] : row.analysis;
      if (!a) continue;
      const ownerId = a.deal_owner_id || a.contact_owner_id || a.hubspot_lead_owner_id || null;
      const lead: LeadRow = {
        ownerId,
        validatedDay: toDayString(row.validated_at ?? row.posted_at),
        dealStageId: a.deal_stage || null,
        hasDeal: !!a.hubspot_deal_id,
        isWon: a.deal_is_closed_won === true,
        contactId: a.hubspot_contact_id || null,
        dealId: a.hubspot_deal_id || null,
        email: a.extracted_email ? a.extracted_email.toLowerCase() : null,
        normName: a.extracted_name ? normalizePerson(a.extracted_name) : null,
      };
      result.all.push(lead);
      if (ownerId) {
        const arr = result.byOwner.get(ownerId) ?? [];
        arr.push(lead);
        result.byOwner.set(ownerId, arr);
      }
      if (lead.contactId) result.contactIds.add(lead.contactId);
      if (lead.dealId) result.dealIds.add(lead.dealId);
      if (lead.email) result.emails.add(lead.email);
      if (lead.normName) result.normNames.add(lead.normName);
    }
    result.normNamesList = [...result.normNames];
  } catch (e) {
    console.warn("[ae-activity] leads fetch failed:", e instanceof Error ? e.message : e);
  }
  return result;
}

/**
 * Funnel des leads d'un rep : Leads validés → Avec deal → [étapes du pipeline
 * atteintes, cumulatif] → Won. L'étape atteinte vient du snapshot `deal_stage`
 * (au moment de l'analyse du lead, pas du live).
 */
export function buildLeadsFunnel(leads: LeadRow[], stages: PipelineStage[]): FunnelStage[] {
  const active = stages.filter((s) => !s.isLost);
  const stageIndex = new Map(active.map((s, i) => [s.id, i]));
  const validated = leads.length;
  const withDeal = leads.filter((l) => l.hasDeal).length;

  const reached = active.map(() => 0);
  for (const l of leads) {
    if (!l.hasDeal) continue;
    let idx = l.dealStageId != null ? stageIndex.get(l.dealStageId) ?? -1 : -1;
    if (l.isWon && active.length > 0) idx = active.length - 1; // won → dernière étape
    if (idx < 0) continue;
    for (let j = 0; j <= idx; j++) reached[j]++;
  }

  return [
    { id: "validated", label: "Leads validés", count: validated },
    { id: "withDeal", label: "Avec deal", count: withDeal },
    ...active.map((s, i) => ({ id: `stage_${s.id}`, label: s.label, count: reached[i] })),
  ];
}
