import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { notifyHandoverAmCs } from "@/lib/clients/notify-handover";

export const dynamic = "force-dynamic";

// POST /api/clients/[id]/notify-handover
// Body: { amEmail, amName?, csEmail, csName? }
//
// Assigne l'AM/CS au client et leur envoie un DM Slack ("contexte closed-won
// prêt"). Pas de garde-fou bloquant sur les champs : l'AE peut notifier même
// avec des champs vides (les lignes vides sont juste surlignées sur la fiche).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id } = await params;

  let body: { amEmail?: string; amName?: string; csEmail?: string; csName?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch (e) {
    return NextResponse.json({ error: `bad JSON: ${e instanceof Error ? e.message : e}` }, { status: 400 });
  }

  const amEmail = body.amEmail?.trim();
  const csEmail = body.csEmail?.trim();
  if (!amEmail || !csEmail) {
    return NextResponse.json({ error: "amEmail and csEmail are required" }, { status: 400 });
  }

  const result = await notifyHandoverAmCs(id, {
    amEmail,
    amName: body.amName?.trim() || null,
    csEmail,
    csName: body.csName?.trim() || null,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.reason ?? "notify_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, sent: result.sent ?? false, mode: result.mode });
}
