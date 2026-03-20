import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { data } = await db
    .from("users")
    .select("prospection_guide")
    .eq("id", user.id)
    .maybeSingle();

  return NextResponse.json({ content: data?.prospection_guide ?? "" });
}

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { content } = await req.json();
  if (typeof content !== "string") {
    return NextResponse.json({ error: "Contenu invalide" }, { status: 400 });
  }

  const { error } = await db
    .from("users")
    .update({ prospection_guide: content })
    .eq("id", user.id);

  if (error) {
    console.error("[POST /api/prospection-guide]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
