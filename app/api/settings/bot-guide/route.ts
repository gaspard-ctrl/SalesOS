import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { DEFAULT_BOT_GUIDE } from "@/lib/guides/bot";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: userData } = await db
    .from("users")
    .select("user_prompt")
    .eq("id", user.id)
    .single();

  const response = NextResponse.json({
    // Bot guide en dur (non surchargeable en base), affiché en lecture seule.
    adminGuide: DEFAULT_BOT_GUIDE,
    userInstructions: userData?.user_prompt ?? "",
  });
  response.headers.set("Cache-Control", "private, max-age=30, stale-while-revalidate=60");
  return response;
}

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { userInstructions } = await req.json();

  await db
    .from("users")
    .update({ user_prompt: userInstructions || null })
    .eq("id", user.id);

  return NextResponse.json({ ok: true });
}
