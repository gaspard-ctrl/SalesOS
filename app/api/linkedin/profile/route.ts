import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { getProfile, getProfileByUrl, reverseLookup } from "@/lib/netrows";

export const dynamic = "force-dynamic";

// GET /api/linkedin/profile?username=xxx  (1 crédit)
// GET /api/linkedin/profile?url=https://linkedin.com/in/xxx  (1 crédit)
// GET /api/linkedin/profile?email=xxx@company.com  (1 crédit)
export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const username = req.nextUrl.searchParams.get("username");
  const url = req.nextUrl.searchParams.get("url");
  const email = req.nextUrl.searchParams.get("email");

  try {
    if (username) {
      const profile = await getProfile(username);
      return NextResponse.json(profile);
    }

    if (url) {
      const profile = await getProfileByUrl(url);
      return NextResponse.json(profile);
    }

    if (email) {
      const result = await reverseLookup(email);
      if (!result.found) return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
      // Enrich with full profile
      const profile = await getProfile(result.profile.username);
      return NextResponse.json(profile);
    }

    return NextResponse.json({ error: "username, url ou email requis" }, { status: 400 });
  } catch (e) {
    console.error("[linkedin/profile] error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
