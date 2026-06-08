import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildChecklistContext } from "@/lib/clients/checklist-context";
import { generateHubspotSuggestions } from "@/lib/clients/hubspot-suggestions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/clients/[id]/hubspot-suggestions
// Genere les propositions IA de remplissage pour les champs HubSpot de
// qualification actuellement vides. Best-effort, persiste le resultat. Meme
// logique que la generation d'office en fin d'enrichissement (cf.
// lib/clients/hubspot-suggestions.ts), ici declenchee a la demande (bouton).
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY missing" }, { status: 500 });
  }

  const { id } = await params;

  const ctx = await buildChecklistContext(id);
  if (!ctx) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  let result;
  try {
    result = await generateHubspotSuggestions(ctx.client.hubspot_deal_id, ctx.contextText, user.id);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "AI error" }, { status: 502 });
  }

  const { error: updateErr } = await db
    .from("clients")
    .update({ hubspot_field_suggestions: result.suggestions })
    .eq("id", id);
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  return NextResponse.json({
    hubspot_field_suggestions: result.suggestions,
    hubspot_deal_fields: result.dealFields,
  });
}
