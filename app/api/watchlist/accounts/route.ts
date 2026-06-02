import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export interface WatchAccount {
  id: string;
  name: string;
  owner: string | null;
  sector: string | null;
  current_coaching_platform: string | null;
  notes: string | null;
}

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const owner = req.nextUrl.searchParams.get("owner")?.trim() ?? "";

  let q = db
    .from("scope_companies")
    .select("id, name, owner, sector, current_coaching_platform, notes")
    .order("name", { ascending: true });

  if (owner) q = q.ilike("owner", owner);

  const { data: companies, error } = await q;
  if (error) return NextResponse.json({ error: error.message, accounts: [] }, { status: 500 });
  if (!companies || companies.length === 0) return NextResponse.json({ accounts: [] });

  const accounts: WatchAccount[] = companies.map((c) => ({
    id: c.id,
    name: c.name,
    owner: c.owner,
    sector: c.sector,
    current_coaching_platform: c.current_coaching_platform,
    notes: c.notes,
  }));

  return NextResponse.json({ accounts });
}
