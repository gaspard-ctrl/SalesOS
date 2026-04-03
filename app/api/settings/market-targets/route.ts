import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { TARGET_COMPANIES, TARGET_ROLES } from "@/lib/target-companies";

export const dynamic = "force-dynamic";

const DEFAULTS: Record<string, string[]> = {
  target_companies: TARGET_COMPANIES,
  target_roles: TARGET_ROLES,
};

// GET — read target_companies or target_roles (fallback to hardcoded defaults)
export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const key = req.nextUrl.searchParams.get("key");
  if (!key || !["target_companies", "target_roles"].includes(key)) {
    return NextResponse.json({ error: "key invalide" }, { status: 400 });
  }

  const { data } = await db.from("guide_defaults").select("content").eq("key", key).single();
  try {
    const items = data?.content ? JSON.parse(data.content as string) : DEFAULTS[key] ?? [];
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: DEFAULTS[key] ?? [] });
  }
}

// POST — save target_companies or target_roles
export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const key = req.nextUrl.searchParams.get("key");
  if (!key || !["target_companies", "target_roles"].includes(key)) {
    return NextResponse.json({ error: "key invalide" }, { status: 400 });
  }

  const { items } = await req.json() as { items: string[] };

  await db.from("guide_defaults").upsert(
    { key, content: JSON.stringify(items) },
    { onConflict: "key" }
  );

  return NextResponse.json({ ok: true });
}
