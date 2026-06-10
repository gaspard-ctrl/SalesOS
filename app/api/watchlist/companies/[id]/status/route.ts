import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export interface UpdateStatusResponse {
  ok: boolean;
  status: string | null;
  error?: string;
}

// Override manuel du statut d'une company watchlist. status null/"" => retour a l'auto.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ ok: false, status: null, error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  let body: { status?: string | null } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, status: null, error: "Invalid JSON body" }, { status: 400 });
  }

  const status = typeof body.status === "string" && body.status.trim() ? body.status.trim() : null;

  const { data, error } = await db
    .from("scope_companies")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("status")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { ok: false, status: null, error: error?.message ?? "Account not found" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, status: data.status });
}
