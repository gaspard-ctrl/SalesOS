import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const res = await fetch("https://api.hubapi.com/crm/v3/owners?limit=100", {
      headers: { Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}` },
    });
    if (!res.ok) throw new Error(`HubSpot ${res.status}`);
    const data = await res.json();

    const owner = (data.results ?? []).find(
      (o: { email?: string; id: string }) =>
        o.email?.toLowerCase() === user.email?.toLowerCase()
    );
    const hubspotOwnerId = owner?.id ?? null;

    if (hubspotOwnerId) {
      await db.from("users").update({ hubspot_owner_id: hubspotOwnerId }).eq("id", user.id);
    }

    return NextResponse.json({ hubspotOwnerId });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erreur" }, { status: 500 });
  }
}
