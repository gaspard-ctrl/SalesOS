import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const VALID_TYPES = ["salon", "linkedin_pro", "linkedin_perso", "nurturing_campaign"] as const;
type EventType = (typeof VALID_TYPES)[number];

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");

  let query = db
    .from("marketing_events")
    .select("id, event_date, event_type, label, created_by, created_at")
    .order("event_date", { ascending: false });

  if (from) query = query.gte("event_date", from);
  if (to) query = query.lte("event_date", to);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message, events: [] }, { status: 500 });

  return NextResponse.json({ events: data ?? [] });
}

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: { event_date?: string; event_type?: string; label?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { event_date, event_type, label } = body;

  if (!event_date || !/^\d{4}-\d{2}-\d{2}$/.test(event_date)) {
    return NextResponse.json({ error: "event_date must be YYYY-MM-DD" }, { status: 400 });
  }
  if (!event_type || !VALID_TYPES.includes(event_type as EventType)) {
    return NextResponse.json({ error: `event_type must be one of ${VALID_TYPES.join(", ")}` }, { status: 400 });
  }
  const trimmedLabel = label?.trim();
  if (!trimmedLabel) {
    return NextResponse.json({ error: "label is required" }, { status: 400 });
  }

  const { data, error } = await db
    .from("marketing_events")
    .insert({
      event_date,
      event_type,
      label: trimmedLabel,
      created_by: user.id,
    })
    .select("id, event_date, event_type, label, created_by, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ event: data });
}

export async function DELETE(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const { error } = await db.from("marketing_events").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
