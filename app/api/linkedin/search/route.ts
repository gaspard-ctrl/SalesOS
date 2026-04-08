import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { searchPeople } from "@/lib/netrows";

export const dynamic = "force-dynamic";

// GET /api/linkedin/search?company=TotalEnergies&title=Head+of+L%26D
export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const company = req.nextUrl.searchParams.get("company");
  const title = req.nextUrl.searchParams.get("title");
  const keywords = req.nextUrl.searchParams.get("keywords");
  const firstName = req.nextUrl.searchParams.get("firstName");
  const lastName = req.nextUrl.searchParams.get("lastName");

  if (!company && !title && !keywords && !firstName && !lastName) {
    return NextResponse.json({ error: "company, title, keywords, firstName ou lastName requis" }, { status: 400 });
  }

  try {
    const result = await searchPeople({
      company: company ?? undefined,
      keywordTitle: title ?? undefined,
      keywords: keywords ?? undefined,
      firstName: firstName ?? undefined,
      lastName: lastName ?? undefined,
    });

    return NextResponse.json({
      total: result.data?.total ?? 0,
      people: result.data?.items ?? [],
      credits_used: 1,
    });
  } catch (e) {
    const msg = String(e);
    // "Not found" = no results, not a real error
    if (msg.includes("NOT_FOUND") || msg.includes("No profiles found")) {
      return NextResponse.json({ total: 0, people: [], credits_used: 1, note: "Aucun résultat — essaie un titre plus large (ex: 'RH', 'People', 'Learning')" });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
