import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { hubspotUpdate } from "@/lib/hubspot";
import { getHubspotFieldDef } from "@/lib/clients/types";

export const dynamic = "force-dynamic";

// PATCH /api/clients/[id]/hubspot-field
// Body: { property: string, value: string }
//
// Ecrit la valeur d'un champ du deal HubSpot. Garde-fou : la property doit
// appartenir a HUBSPOT_CHECKLIST_FIELDS, et la valeur est validee/normalisee
// selon le type du champ (enum -> option valide, number -> nombre, date ->
// YYYY-MM-DD) pour que l'ecriture HubSpot ne soit jamais rejetee. Une fois
// ecrite, le champ n'est plus vide => l'item passe en "validé" cote front.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id } = await params;

  let body: { property?: string; value?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch (e) {
    return NextResponse.json({ error: `bad JSON: ${e instanceof Error ? e.message : e}` }, { status: 400 });
  }

  const { property, value } = body;
  if (!property || typeof value !== "string" || !value.trim()) {
    return NextResponse.json({ error: "property et value requis" }, { status: 400 });
  }

  const fieldDef = getHubspotFieldDef(property);
  if (!fieldDef) return NextResponse.json({ error: `property inconnue: ${property}` }, { status: 400 });

  // Normalisation / validation par type.
  const raw = value.trim();
  let toWrite = raw;
  if (fieldDef.type === "enumeration") {
    const opt = (fieldDef.options ?? []).find(
      (o) => o.value === raw || o.value.toLowerCase() === raw.toLowerCase() || o.label.toLowerCase() === raw.toLowerCase(),
    );
    if (!opt) return NextResponse.json({ error: `Valeur invalide pour ${fieldDef.label}` }, { status: 400 });
    toWrite = opt.value;
  } else if (fieldDef.type === "number") {
    const n = Number(raw.replace(/[^\d.,-]/g, "").replace(",", "."));
    if (!Number.isFinite(n)) return NextResponse.json({ error: `${fieldDef.label} doit être un nombre` }, { status: 400 });
    toWrite = String(n);
  } else if (fieldDef.type === "date") {
    // HubSpot accepte YYYY-MM-DD pour les proprietes de type date.
    const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return NextResponse.json({ error: `${fieldDef.label} doit être une date (YYYY-MM-DD)` }, { status: 400 });
    toWrite = `${m[1]}-${m[2]}-${m[3]}`;
  }

  const { data: row, error: rowErr } = await db
    .from("clients")
    .select("hubspot_deal_id")
    .eq("id", id)
    .single();
  if (rowErr || !row?.hubspot_deal_id) {
    return NextResponse.json({ error: "Client ou deal HubSpot introuvable" }, { status: 404 });
  }

  try {
    await hubspotUpdate("deals", row.hubspot_deal_id, { [property]: toWrite });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erreur HubSpot" }, { status: 502 });
  }

  return NextResponse.json({ ok: true, property, value: toWrite });
}
