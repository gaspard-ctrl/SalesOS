import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { DEFAULT_BRIEFING_GUIDE } from "@/lib/default-briefing-guide";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const [userRes, globalGuide] = await Promise.all([
    db.from("users").select("briefing_guide").eq("id", user.id).single(),
    db.from("guide_defaults").select("content").eq("key", "briefing").maybeSingle(),
  ]);

  const response = NextResponse.json({
    adminGuide: globalGuide?.data?.content ?? DEFAULT_BRIEFING_GUIDE,
    userInstructions: userRes.data?.briefing_guide ?? "",
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
    .update({ briefing_guide: userInstructions || null })
    .eq("id", user.id);

  return NextResponse.json({ ok: true });
}
