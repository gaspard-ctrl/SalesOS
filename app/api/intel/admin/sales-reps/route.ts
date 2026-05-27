import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const [repsRes, usersRes] = await Promise.all([
    db.from("sales_reps").select("id, name, email, created_at"),
    db.from("users").select("id, name, email, created_at"),
  ]);

  if (repsRes.error) {
    return NextResponse.json({ error: repsRes.error.message, reps: [] }, { status: 500 });
  }

  type Rep = { id: string; name: string; email: string | null; created_at: string };
  const byKey = new Map<string, Rep>();

  for (const u of usersRes.data ?? []) {
    const name = (u.name ?? "").trim() || (u.email ?? "").split("@")[0];
    if (!name) continue;
    byKey.set(name.toLowerCase(), {
      id: u.id,
      name,
      email: u.email ?? null,
      created_at: u.created_at,
    });
  }

  for (const r of repsRes.data ?? []) {
    const name = (r.name ?? "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (!byKey.has(key)) {
      byKey.set(key, { id: r.id, name, email: r.email ?? null, created_at: r.created_at });
    }
  }

  const reps = Array.from(byKey.values()).sort((a, b) => a.name.localeCompare(b.name));
  return NextResponse.json({ reps });
}
