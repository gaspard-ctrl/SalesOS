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

  const adminGuide = globalGuide.data?.content ?? DEFAULT_BOT_GUIDE;
  const userInstructions = userRes.data?.user_prompt ?? "";
  const firstName = (userRes.data?.name ?? user.name ?? "").split(" ")[0] || "moi";

  return NextResponse.json({ adminGuide, userInstructions, firstName });
}

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { userInstructions } = await req.json();

  const { error } = await db
    .from("users")
    .update({ user_prompt: userInstructions || null })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: "Erreur lors de la sauvegarde" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
