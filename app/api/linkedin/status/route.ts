import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { listRadarCompanies, listRadarProfiles } from "@/lib/netrows";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const hasApiKey = !!process.env.NETROWS_API_KEY;
  let hasSubscription = false;
  let radarCompanies = 0;
  let radarProfiles = 0;

  if (hasApiKey) {
    try {
      const companies = await listRadarCompanies();
      radarCompanies = companies.data?.length ?? 0;
      hasSubscription = true; // If radar call succeeds, subscription is active
    } catch (e) {
      const msg = String(e);
      if (msg.includes("SUBSCRIPTION_REQUIRED")) hasSubscription = false;
    }

    if (hasSubscription) {
      try {
        const profiles = await listRadarProfiles();
        radarProfiles = profiles.data?.length ?? 0;
      } catch { /* ignore */ }
    }
  }

  return NextResponse.json({ hasApiKey, hasSubscription, radarCompanies, radarProfiles });
}
