import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { createHubspotTask, archiveHubspotTask, type DealSnapshot } from "@/lib/hubspot";
import type { SalesCoachAnalysis } from "@/lib/guides/sales-coach";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id } = await params;

  const { data: userRow } = await db
    .from("users")
    .select("is_admin, hubspot_owner_id")
    .eq("id", user.id)
    .single();
  const isAdmin = !!userRow?.is_admin;

  const { data: row } = await db
    .from("sales_coach_analyses")
    .select("user_id, hubspot_deal_id, meeting_title, analysis, deal_snapshot, hubspot_task_ids, recorder_email")
    .eq("id", id)
    .single();
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!isAdmin && row.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!row.hubspot_deal_id) {
    return NextResponse.json({ error: "Aucun deal HubSpot associé — associe un deal d'abord" }, { status: 400 });
  }
  if (!row.analysis) return NextResponse.json({ error: "Analyse non disponible" }, { status: 400 });

  if (Array.isArray(row.hubspot_task_ids) && row.hubspot_task_ids.length > 0) {
    return NextResponse.json({ error: "Tâches déjà créées pour cette analyse", taskIds: row.hubspot_task_ids }, { status: 400 });
  }

  const analysis = row.analysis as SalesCoachAnalysis;
  const priorities = (analysis.coaching_priorities ?? []).slice(0, 3);
  if (priorities.length === 0) {
    return NextResponse.json({ error: "Aucune priorité de coaching dans l'analyse" }, { status: 400 });
  }

  // Resolve owner: prefer user's hubspot_owner_id, fallback to deal_snapshot.owner_id
  const snapshot = row.deal_snapshot as DealSnapshot | null;
  const ownerId = userRow?.hubspot_owner_id ?? snapshot?.owner_id ?? null;

  // Tasks due in 7 days
  const dueAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const meetingTitle = row.meeting_title ?? "Meeting Sales Coach";

  const taskIds: string[] = [];
  const errors: string[] = [];
  for (let i = 0; i < priorities.length; i++) {
    const priority = priorities[i];
    const title = `Coaching ${i + 1}/${priorities.length} · ${priority.slice(0, 100)}`;
    const body = `Action issue de l'analyse Sales Coach du meeting "${meetingTitle}" :\n\n${priority}`;
    const taskId = await createHubspotTask({
      dealId: row.hubspot_deal_id,
      ownerId,
      title,
      body,
      dueAt,
    });
    if (taskId) taskIds.push(taskId);
    else errors.push(`Tâche ${i + 1} échouée`);
  }

  if (taskIds.length === 0) {
    return NextResponse.json({ error: `Échec : ${errors.join(", ")}` }, { status: 500 });
  }

  await db
    .from("sales_coach_analyses")
    .update({ hubspot_task_ids: taskIds, updated_at: new Date().toISOString() })
    .eq("id", id);

  return NextResponse.json({ ok: true, taskIds, errors });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id } = await params;

  const { data: userRow } = await db.from("users").select("is_admin").eq("id", user.id).single();
  const isAdmin = !!userRow?.is_admin;

  const { data: row } = await db
    .from("sales_coach_analyses")
    .select("user_id, hubspot_task_ids")
    .eq("id", id)
    .single();
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!isAdmin && row.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const taskIds = (row.hubspot_task_ids ?? []) as string[];
  if (taskIds.length === 0) {
    return NextResponse.json({ error: "Aucune tâche à supprimer" }, { status: 400 });
  }

  const results = await Promise.all(taskIds.map((tid) => archiveHubspotTask(tid)));
  const failed = taskIds.filter((_, i) => !results[i]);

  // Always clear the column even if some HubSpot deletes failed (otherwise the
  // user can't retry without manual DB intervention).
  await db
    .from("sales_coach_analyses")
    .update({ hubspot_task_ids: null, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (failed.length > 0) {
    return NextResponse.json({
      ok: true,
      deleted: taskIds.length - failed.length,
      failed,
      warning: `${failed.length} tâche(s) n'ont pas pu être archivées HubSpot mais ont été déliées de l'analyse`,
    });
  }

  return NextResponse.json({ ok: true, deleted: taskIds.length });
}
