import Anthropic from "@anthropic-ai/sdk";
import { db } from "../db";
import { logUsage } from "../log-usage";
import { withAnthropicRetry } from "../anthropic-retry";
import { loadClientContext, renderClientContextForPrompt } from "./context";
import {
  CLIENT_EXTRACTION_MODEL,
  CLIENT_EXTRACTION_SYSTEM_PROMPT,
  CLIENT_FIELDS_TOOL,
} from "./prompt";
import { parseClientFieldsFromClaude } from "./parse-output";

export type RunEnrichmentResult =
  | { ok: true; alreadyDone?: boolean }
  | { ok: false; error: string };

// Orchestrateur principal pour /clients/:id enrichissement.
//
// Pipeline batch 1 (étape 2 du plan §7) :
//   1. Verrouille la row (enrichment_status = 'running').
//   2. Charge le contexte HubSpot + Claap pour le deal.
//   3. Appelle Claude (Sonnet 4.6) avec tool client_fields.
//   4. Parse + écrit fields_json + bascule en 'done'.
//
// PAS dans cette batch : deal_recap (étape 5), health/insights (étape 6),
// news (étape 7). Les colonnes existent déjà côté SQL, on les remplira plus tard.
//
// Sécurité fields manuels : on merge avec les fields existants en préservant
// ceux marqués source.kind = "manual" (cf. plan §6 "Re-enrichir ne touche pas
// aux fields édités manuellement"). En batch 1 il n'y a pas encore d'édition
// donc fields_json est vide à la première run, mais on garde la logique pour
// que le re-enrich futur soit safe.
export async function runClientEnrichment(clientId: string): Promise<RunEnrichmentResult> {
  const { data: row, error: rowErr } = await db
    .from("clients")
    .select("id, hubspot_deal_id, enrichment_status, fields_json, updated_at")
    .eq("id", clientId)
    .single();

  if (rowErr || !row) {
    return { ok: false, error: rowErr?.message ?? "Client not found" };
  }
  if (row.enrichment_status === "done") {
    // L'appelant peut forcer un re-enrich via /api/clients/[id]/re-enrich
    // (batch 4), qui repassera explicitement en 'pending'. Tant que c'est
    // 'done', on ne refait rien.
    return { ok: true, alreadyDone: true };
  }
  if (row.enrichment_status === "running") {
    const ageMin = row.updated_at
      ? (Date.now() - new Date(row.updated_at).getTime()) / 60_000
      : Infinity;
    // Si une run précédente est verrouillée mais a moins de 10 minutes, on
    // suppose qu'elle est en cours et on n'en relance pas une seconde.
    if (ageMin < 10) return { ok: true, alreadyDone: true };
  }

  await db
    .from("clients")
    .update({ enrichment_status: "running", enrichment_error: null, updated_at: new Date().toISOString() })
    .eq("id", clientId);

  try {
    const ctx = await loadClientContext(row.hubspot_deal_id);
    const contextPrompt = renderClientContextForPrompt(ctx);

    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY missing");
    }

    const client = new Anthropic({ timeout: 600_000 });
    const msg = await withAnthropicRetry(
      () =>
        client.messages.create({
          model: CLIENT_EXTRACTION_MODEL,
          max_tokens: 8000,
          system: CLIENT_EXTRACTION_SYSTEM_PROMPT,
          messages: [{ role: "user", content: contextPrompt }],
          tools: [CLIENT_FIELDS_TOOL],
          tool_choice: { type: "tool" as const, name: "client_fields" },
        }),
      { label: `clients/enrich/${clientId}` },
    );

    logUsage(null, CLIENT_EXTRACTION_MODEL, msg.usage.input_tokens, msg.usage.output_tokens, "clients_enrich_fields");

    const toolBlock = msg.content.find((b) => b.type === "tool_use");
    if (!toolBlock || !("input" in toolBlock)) {
      throw new Error("No tool_use block in Claude response");
    }

    const parsed = parseClientFieldsFromClaude(toolBlock.input);
    const merged = mergeFieldsPreservingManual(row.fields_json ?? {}, parsed);

    await db
      .from("clients")
      .update({
        fields_json: merged,
        enrichment_status: "done",
        enrichment_error: null,
        last_enriched_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", clientId);

    return { ok: true };
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    console.error(`[clients/enrich/${clientId}] error:`, errMsg);
    await db
      .from("clients")
      .update({
        enrichment_status: "error",
        enrichment_error: errMsg,
        updated_at: new Date().toISOString(),
      })
      .eq("id", clientId);
    return { ok: false, error: errMsg };
  }
}

// Merge IA + manuel : si l'utilisateur a édité un field (source.kind = "manual"),
// la valeur manuelle gagne. Sinon la nouvelle valeur IA remplace l'ancienne.
type FieldsLike = Record<string, Record<string, { source?: { kind?: string } | null } | undefined> | undefined>;

function mergeFieldsPreservingManual(existing: FieldsLike, incoming: FieldsLike): FieldsLike {
  const merged: FieldsLike = { ...existing };
  for (const sectionKey of Object.keys(incoming)) {
    const incomingSection = incoming[sectionKey] ?? {};
    const existingSection = existing[sectionKey] ?? {};
    const mergedSection: Record<string, unknown> = { ...existingSection };
    for (const fieldKey of Object.keys(incomingSection)) {
      const existingField = existingSection[fieldKey];
      const isManual = existingField?.source?.kind === "manual";
      if (!isManual) mergedSection[fieldKey] = incomingSection[fieldKey];
    }
    merged[sectionKey] = mergedSection as FieldsLike[string];
  }
  return merged;
}
