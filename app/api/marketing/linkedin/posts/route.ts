import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { getCompanyDetails, getCompanyPosts } from "@/lib/brightdata/linkedin";
import { BRIGHTDATA_API_KEY } from "@/lib/brightdata/serp";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  if (!BRIGHTDATA_API_KEY) {
    return NextResponse.json({ error: "Bright Data non configuré" }, { status: 500 });
  }

  const username = req.nextUrl.searchParams.get("username");
  if (!username) return NextResponse.json({ error: "username requis" }, { status: 400 });

  try {
    const [details, postsRes] = await Promise.allSettled([
      getCompanyDetails(username, { timeoutMs: 18_000 }),
      getCompanyPosts(username, { timeoutMs: 18_000 }),
    ]);

    return NextResponse.json({
      details: details.status === "fulfilled" ? details.value : null,
      posts: postsRes.status === "fulfilled" ? (postsRes.value.data ?? []).slice(0, 10) : [],
      error:
        details.status === "rejected"
          ? String(details.reason).slice(0, 200)
          : postsRes.status === "rejected"
            ? String(postsRes.reason).slice(0, 200)
            : null,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erreur" }, { status: 500 });
  }
}
