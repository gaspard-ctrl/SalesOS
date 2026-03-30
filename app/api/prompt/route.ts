import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { DEFAULT_BOT_GUIDE } from "@/lib/guides/bot";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const [userRes, globalGuide] = await Promise.all([
    db.from("users").select("user_prompt, name").eq("id", user.id).maybeSingle(),
    db.from("guide_defaults").select("content").eq("key", "bot").maybeSingle(),
  ]);

  const globalDefault = globalGuide.data?.content ?? DEFAULT_BOT_GUIDE;
  const prompt = userRes.data?.user_prompt ?? globalDefault;
  const firstName = (userRes.data?.name ?? user.name ?? "").split(" ")[0] || "moi";
  const isPersonal = !!userRes.data?.user_prompt;

  return NextResponse.json({ prompt, firstName, isPersonal, globalDefault });
}

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { prompt } = await req.json();
  if (prompt !== null && typeof prompt !== "string") {
    return NextResponse.json({ error: "Prompt invalide" }, { status: 400 });
  }

  const { error } = await db
    .from("users")
    .update({ user_prompt: prompt })
    .eq("id", user.id);

  if (error) {
    console.error("[POST /api/prompt] Supabase error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
