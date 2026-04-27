import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id } = await params;

  const { data: userRow } = await db.from("users").select("is_admin").eq("id", user.id).single();
  const isAdmin = !!userRow?.is_admin;

  const { data, error } = await db
    .from("sales_coach_analyses")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!isAdmin && data.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ analysis: data });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { hubspotDealId?: string | null };

  const { data: userRow } = await db.from("users").select("is_admin").eq("id", user.id).single();
  const isAdmin = !!userRow?.is_admin;

  const { data: row } = await db.from("sales_coach_analyses").select("user_id").eq("id", id).single();
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!isAdmin && row.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ("hubspotDealId" in body) {
    update.hubspot_deal_id = body.hubspotDealId?.trim() || null;
  }

  const { error } = await db.from("sales_coach_analyses").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id } = await params;

  const { data: userRow } = await db.from("users").select("is_admin").eq("id", user.id).single();
  const isAdmin = !!userRow?.is_admin;

  const { data: row } = await db
    .from("sales_coach_analyses")
    .select("user_id")
    .eq("id", id)
    .single();

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!isAdmin && row.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await db.from("sales_coach_analyses").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
