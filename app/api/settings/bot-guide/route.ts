import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { DEFAULT_BOT_GUIDE } from "@/lib/guides/bot";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const [userRes, globalGuide] = await Promise.all([
    db.from("users").select("user_prompt").eq("id", user.id).single(),
    db.from("guide_defaults").select("content").eq("key", "bot").maybeSingle(),
  ]);

  const response = NextResponse.json({
    adminGuide: globalGuide.data?.content ?? DEFAULT_BOT_GUIDE,
    userInstructions: userRes.data?.user_prompt ?? "",
  });
  response.headers.set("Cache-Control", "private, max-age=30, stale-while-revalidate=60");
  return response;
}

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { userInstructions } = await req.json();

  await db
    .from("users")
    .update({ user_prompt: userInstructions || null })
    .eq("id", user.id);

  return NextResponse.json({ ok: true });
}
