import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Le bot guide (lib/guides/bot.ts) et le briefing guide (lib/guides/briefing.ts) sont
// figés en dur : non surchargeables en base ni éditables ici. Seule la prospection reste
// modifiable.
const VALID_KEYS = ["prospection"] as const;
type GuideKey = typeof VALID_KEYS[number];

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user || !isAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data } = await db.from("guide_defaults").select("key, content");
  const dbMap = Object.fromEntries((data ?? []).map((r) => [r.key, r.content]));

  return NextResponse.json(
    VALID_KEYS.reduce((acc, key) => {
      acc[key] = dbMap[key] ?? null;
      return acc;
    }, {} as Record<GuideKey, string | null>)
  );
}

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user || !isAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const key = url.searchParams.get("key") as GuideKey | null;
  if (!key || !VALID_KEYS.includes(key)) {
    return NextResponse.json({ error: "Invalid key" }, { status: 400 });
  }

  const { guide } = await req.json();

  if (guide === null || guide === undefined) {
    await db.from("guide_defaults").delete().eq("key", key);
  } else {
    await db.from("guide_defaults").upsert({ key, content: guide, updated_at: new Date().toISOString() }, { onConflict: "key" });
  }

  return NextResponse.json({ ok: true });
}
