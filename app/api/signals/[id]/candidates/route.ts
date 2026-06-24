import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { getSignalCandidates } from "@/lib/signals/act";
import type { SignalCandidate } from "@/lib/signals/types";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export interface SignalCandidatesResponse {
  candidates: SignalCandidate[];
  apolloConfigured: boolean;
  scopeCompanyId: string | null;
  error?: string;
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ candidates: [], apolloConfigured: false, scopeCompanyId: null, error: "Not authenticated" }, { status: 401 });
  }
  const { id } = await params;
  try {
    const res = await getSignalCandidates(id);
    return NextResponse.json({
      candidates: res.candidates,
      apolloConfigured: res.apolloConfigured,
      scopeCompanyId: res.scopeCompanyId,
    });
  } catch (e) {
    return NextResponse.json(
      { candidates: [], apolloConfigured: false, scopeCompanyId: null, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
