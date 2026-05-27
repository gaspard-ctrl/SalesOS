import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/clients/[id]
// Renvoie la fiche client complète (toutes les colonnes, y compris fields_json,
// deal_recap, health, news). Pas d'autorisation par owner pour batch 1 : tout
// utilisateur authentifié peut voir tous les clients (cf. §10 "défauts
// raisonnables"). Sera resserré quand on aura les rôles.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id } = await params;

  const { data, error } = await db.from("clients").select("*").eq("id", id).single();
  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Charge aussi les meetings Claap analysés du deal pour la timeline lecture-only.
  type MeetingRow = {
    id: string;
    claap_recording_id: string;
    meeting_title: string | null;
    meeting_started_at: string | null;
    meeting_kind: string | null;
    audience: string | null;
    meeting_recap: { summary?: string | null } | null;
    score_global: number | null;
  };
  const { data: meetings } = await db
    .from("sales_coach_analyses")
    .select(
      "id, claap_recording_id, meeting_title, meeting_started_at, meeting_kind, audience, meeting_recap, score_global",
    )
    .eq("hubspot_deal_id", data.hubspot_deal_id)
    .eq("status", "done")
    .order("meeting_started_at", { ascending: false, nullsFirst: false });

  const safeMeetings = (meetings as MeetingRow[] | null ?? []).map((m) => ({
    id: m.id,
    claap_recording_id: m.claap_recording_id,
    meeting_title: m.meeting_title,
    meeting_started_at: m.meeting_started_at,
    meeting_kind: m.meeting_kind,
    audience: m.audience,
    recap_summary: m.meeting_recap?.summary ?? null,
    score_global: m.score_global,
  }));

  return NextResponse.json({ client: data, meetings: safeMeetings });
}
