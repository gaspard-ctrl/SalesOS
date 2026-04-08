import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { getCompanyDetails } from "@/lib/netrows";

export const dynamic = "force-dynamic";

// GET /api/linkedin/company?username=totalenergies  (1 crédit)
export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const username = req.nextUrl.searchParams.get("username");
  if (!username) return NextResponse.json({ error: "username requis" }, { status: 400 });

  try {
    const details = await getCompanyDetails(username);
    return NextResponse.json(details);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
