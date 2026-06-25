import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { saveSignalToWatchlist } from "@/lib/signals/act";

export const dynamic = "force-dynamic";

const SNOOZE_DAYS = 7;

export interface SignalActionResponse {
  ok: boolean;
  scopeCompanyId?: string | null;
  error?: string;
}

// dismiss / delete / snooze / save. L'action "accept" passe par /candidates puis /draft (popup).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { action?: string };
  const action = body.action;

  if (action === "dismiss") {
    const now = new Date().toISOString();
    const { error } = await db
      .from("prospect_signals")
      .update({ status: "dismissed", dismissed_at: now, updated_at: now })
      .eq("id", id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // Masquage définitif (fiche compte). On garde la ligne (et donc la dedupe_key)
  // pour que le sweep ne réinsère JAMAIS ce signal : status='deleted' est exclu
  // de toutes les lectures du feed et de la fiche.
  if (action === "delete") {
    const now = new Date().toISOString();
    const { error } = await db
      .from("prospect_signals")
      .update({ status: "deleted", updated_at: now })
      .eq("id", id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "snooze") {
    const now = Date.now();
    const { error } = await db
      .from("prospect_signals")
      .update({
        status: "snoozed",
        snooze_until: new Date(now + SNOOZE_DAYS * 86_400_000).toISOString(),
        updated_at: new Date(now).toISOString(),
      })
      .eq("id", id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "save") {
    const res = await saveSignalToWatchlist({ signalId: id, userId: user.id });
    if (!res.ok) return NextResponse.json({ ok: false, error: res.error ?? "Save failed" }, { status: 500 });
    return NextResponse.json({ ok: true, scopeCompanyId: res.scopeCompanyId });
  }

  return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
}
