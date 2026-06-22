import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { mergeEntities } from "@/lib/orgchart/db";

export const dynamic = "force-dynamic";

interface Body {
  from?: string[]; // entités à fusionner (ex: ["Allianz Trade"])
  into?: string; // entité cible conservée (ex: "Allianz")
}

// POST /api/orgchart/accounts/[id]/merge-entities
// Fusion PERMANENTE de "companies" de l'organigramme : sur le whiteboard, les
// cartes sont regroupées par `entity`. Deux entités HubSpot distinctes mais
// identiques en pratique (Allianz / Allianz Trade) sont fusionnées en réassignant
// l'entity des personnes + en mémorisant un alias sur le compte (réappliqué à
// l'import et au Refresh -> la fusion ne casse jamais). Les company HubSpot
// restent liées (Refresh continue de tirer leurs contacts).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { id } = await params;

  const body = (await req.json().catch(() => ({}))) as Body;
  const into = (body.into ?? "").trim();
  const from = Array.isArray(body.from) ? body.from : [];
  if (!into || from.length === 0) {
    return NextResponse.json({ error: "Pick at least one entity to merge into the target" }, { status: 400 });
  }

  try {
    const { moved, into: canonicalInto } = await mergeEntities(id, from, into);
    return NextResponse.json({ ok: true, moved, into: canonicalInto });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Merge failed" }, { status: 500 });
  }
}
