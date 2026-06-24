import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { draftForSignal } from "@/lib/signals/act";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export interface SignalDraftResponse {
  ok: boolean;
  recipient?: { name: string | null; email: string } | null;
  draft?: { subject: string; body: string } | null;
  scopeCompanyId?: string | null;
  apolloUsed?: boolean;
  error?: string;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    choice?: {
      email?: string | null;
      name?: string | null;
      apolloId?: string | null;
      firstName?: string | null;
      lastName?: string | null;
      fallbackEmail?: string | null;
    };
  };

  const res = await draftForSignal({
    signalId: id,
    userId: user.id,
    userEmail: user.email,
    choice: body.choice ?? {},
  });

  if (!res.ok) return NextResponse.json({ ok: false, error: res.error ?? "Draft failed" }, { status: 500 });
  return NextResponse.json({
    ok: true,
    recipient: res.recipient,
    draft: res.draft,
    scopeCompanyId: res.scopeCompanyId,
    apolloUsed: res.apolloUsed,
    error: res.error, // erreur de rédaction non bloquante
  });
}
