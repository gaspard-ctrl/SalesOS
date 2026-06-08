import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { mergeOnboardingItems, type OnboardingChecklist } from "@/lib/clients/types";

export const dynamic = "force-dynamic";

// PATCH /api/clients/[id]/onboarding
// Body:
//   { key: string, done: boolean }   -> coche/decoche un item
//   { dismissed: boolean }           -> masque / reaffiche la card onboarding
//
// Init depuis le template + items deja persistes si la colonne est vide.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;

  let body: { key?: string; done?: boolean; dismissed?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch (e) {
    return NextResponse.json({ error: `bad JSON: ${e instanceof Error ? e.message : e}` }, { status: 400 });
  }

  const { key, done, dismissed } = body;
  const isToggle = typeof key === "string" && typeof done === "boolean";
  const isDismiss = typeof dismissed === "boolean";
  if (!isToggle && !isDismiss) {
    return NextResponse.json({ error: "key+done or dismissed required" }, { status: 400 });
  }

  const { data: row, error: rowErr } = await db
    .from("clients")
    .select("onboarding_checklist")
    .eq("id", id)
    .single();
  if (rowErr || !row) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const current = (row.onboarding_checklist ?? null) as OnboardingChecklist | null;

  // On repart toujours du template fusionne (nettoie les items orphelins) et on
  // preserve le flag dismissed sauf si on le change explicitement.
  const items = mergeOnboardingItems(current).map((item) =>
    isToggle && item.key === key ? { ...item, done: done as boolean, done_at: done ? new Date().toISOString() : null } : item,
  );

  const updated: OnboardingChecklist = {
    items,
    dismissed: isDismiss ? (dismissed as boolean) : current?.dismissed,
  };

  const { error: updateErr } = await db
    .from("clients")
    .update({ onboarding_checklist: updated })
    .eq("id", id);
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  return NextResponse.json({ onboarding_checklist: updated });
}
