import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { SECTION_DEFINITIONS, type ClientFieldValue } from "@/lib/clients/types";

export const dynamic = "force-dynamic";

// PATCH /api/clients/[id]/fields
// Body: { sectionKey: string, fieldKey: string, value: unknown }
//
// Édite manuellement un field. Marque la valeur en source.kind="manual" et
// confidence=1 ; le merge dans runClientEnrichment respecte cette source et
// ne l'écrasera pas lors d'un re-enrich.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id } = await params;

  let body: { sectionKey?: string; fieldKey?: string; value?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch (e) {
    return NextResponse.json({ error: `bad JSON: ${e instanceof Error ? e.message : e}` }, { status: 400 });
  }

  const { sectionKey, fieldKey, value } = body;
  if (!sectionKey || !fieldKey) {
    return NextResponse.json({ error: "sectionKey et fieldKey requis" }, { status: 400 });
  }

  // Garde-fou : ne pas accepter n'importe quoi comme section/field key.
  // On valide contre SECTION_DEFINITIONS pour empêcher d'écrire dans un
  // namespace JSON arbitraire.
  const section = SECTION_DEFINITIONS.find((s) => s.key === sectionKey);
  if (!section) return NextResponse.json({ error: `section inconnue: ${sectionKey}` }, { status: 400 });
  const fieldDef = section.fields.find((f) => f.key === fieldKey);
  if (!fieldDef) return NextResponse.json({ error: `field inconnu: ${fieldKey}` }, { status: 400 });

  const { data: row, error: rowErr } = await db
    .from("clients")
    .select("fields_json")
    .eq("id", id)
    .single();
  if (rowErr || !row) return NextResponse.json({ error: "Client introuvable" }, { status: 404 });

  // Construit la nouvelle valeur avec source = manual + traçabilité user.
  const newField: ClientFieldValue = {
    value: value === undefined ? null : (value as unknown as null),
    confidence: value === null || value === undefined ? 0 : 1,
    source: value === null || value === undefined ? null : { kind: "manual", userEmail: user.email },
    updated_at: new Date().toISOString(),
  };

  const fields = (row.fields_json ?? {}) as Record<string, Record<string, unknown>>;
  const sectionData = { ...(fields[sectionKey] ?? {}) };
  sectionData[fieldKey] = newField;
  fields[sectionKey] = sectionData;

  const { error: updateErr } = await db
    .from("clients")
    .update({ fields_json: fields, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, field: newField });
}
