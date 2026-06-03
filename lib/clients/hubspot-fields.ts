import { hubspotFetch } from "@/lib/hubspot";
import { HUBSPOT_CHECKLIST_FIELDS, type HubspotDealFields } from "./types";

// Lit les valeurs courantes des champs de qualification surveilles
// (HUBSPOT_CHECKLIST_FIELDS) sur un deal HubSpot. Best-effort : renvoie null si
// l'appel echoue (HubSpot KO, deal introuvable) pour ne jamais bloquer la fiche.
export async function fetchHubspotDealFields(dealId: string): Promise<HubspotDealFields | null> {
  if (!dealId) return null;
  const props = HUBSPOT_CHECKLIST_FIELDS.map((f) => f.property).join(",");
  try {
    const deal = await hubspotFetch<{ properties?: Record<string, string | null> }>(
      `/crm/v3/objects/deals/${dealId}?properties=${props}`,
    );
    const p = deal.properties ?? {};
    const out: HubspotDealFields = {};
    for (const f of HUBSPOT_CHECKLIST_FIELDS) {
      const v = p[f.property];
      out[f.property] = v == null || v === "" ? null : String(v);
    }
    return out;
  } catch {
    return null;
  }
}
