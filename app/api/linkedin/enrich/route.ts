import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { BRIGHTDATA_API_KEY } from "@/lib/brightdata/serp";
import { searchPeople, mapProfile, type LinkedInProfile } from "@/lib/brightdata/linkedin";
import { DATASETS, triggerDataset, snapshotStatus, fetchSnapshot } from "@/lib/brightdata/dataset";

export const dynamic = "force-dynamic";

// Enrichissement LinkedIn à la demande (déclenché par un bouton, pas en auto)
// pour ne pas brûler de crédits Bright Data inutilement.
//
// Flux en 3 temps, piloté par le client :
//  1) POST { mode: "search", firstName, lastName, company } → candidats (SERP,
//     léger, pas de scrape). Si plusieurs, l'utilisateur choisit lequel scraper.
//  2) POST { mode: "trigger", linkedinUrl } → snapshotId (scrape du SEUL profil choisi).
//  3) GET ?snapshot_id=... → poll jusqu'à la fiche prête.

function serialize(profile: LinkedInProfile) {
  return {
    username: profile.username,
    name: `${profile.firstName} ${profile.lastName}`.trim(),
    headline: profile.headline,
    summary: (profile.summary ?? "").slice(0, 600),
    location: profile.geo?.city
      ? `${profile.geo.city}${profile.geo.country ? `, ${profile.geo.country}` : ""}`
      : profile.geo?.country ?? "",
    positions: (profile.position ?? []).slice(0, 5).map((p) => ({
      company: p.companyName,
      title: p.title,
      start: p.start?.year ? String(p.start.year) : null,
      end: p.end?.year ? String(p.end.year) : "actuel",
    })),
    skills: (profile.skills ?? []).slice(0, 12).map((s) => s.name),
    education: (profile.educations ?? []).slice(0, 3).map((e) =>
      `${e.schoolName}${e.degree ? ` — ${e.degree}` : ""}${e.fieldOfStudy ? ` ${e.fieldOfStudy}` : ""}`.trim(),
    ),
    profileUrl: profile.username.startsWith("http")
      ? profile.username
      : `https://www.linkedin.com/in/${profile.username}/`,
  };
}

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!BRIGHTDATA_API_KEY) return NextResponse.json({ error: "Bright Data not configured" }, { status: 500 });

  const body = await req.json().catch(() => ({}));
  const mode = body.mode as string | undefined;

  if (mode === "search") {
    const firstName = (body.firstName as string | undefined)?.trim() ?? "";
    const lastName = (body.lastName as string | undefined)?.trim() ?? "";
    const company = (body.company as string | undefined)?.trim() ?? "";
    if (!firstName && !lastName) {
      return NextResponse.json({ error: "Name required" }, { status: 400 });
    }
    try {
      const r = await searchPeople({ firstName, lastName, company });
      const candidates = r.data.items.slice(0, 6).map((c) => ({
        name: c.fullName,
        headline: c.headline,
        username: c.username,
        profileURL: c.profileURL,
      }));
      // Si aucune société fournie, on prévient le client que les résultats
      // peuvent être bruités (homonymes) → afficher le picker.
      return NextResponse.json({ candidates, companyProvided: !!company });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Search error" }, { status: 502 });
    }
  }

  if (mode === "trigger") {
    const linkedinUrl = (body.linkedinUrl as string | undefined)?.trim() ?? "";
    if (!/linkedin\.com\/in\//i.test(linkedinUrl)) {
      return NextResponse.json({ error: "Invalid LinkedIn profile URL" }, { status: 400 });
    }
    try {
      const snapshotId = await triggerDataset(DATASETS.peopleProfile, [{ url: linkedinUrl }]);
      return NextResponse.json({ snapshotId });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Scrape error" }, { status: 502 });
    }
  }

  return NextResponse.json({ error: "invalid mode (search | trigger)" }, { status: 400 });
}

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const snapshotId = req.nextUrl.searchParams.get("snapshot_id")?.trim();
  if (!snapshotId) return NextResponse.json({ error: "snapshot_id required" }, { status: 400 });

  const status = await snapshotStatus(snapshotId);
  if (status === "failed") return NextResponse.json({ ready: false, status: "failed", error: "Scrape failed" }, { status: 502 });
  if (status !== "ready") return NextResponse.json({ ready: false, status });

  try {
    const rows = await fetchSnapshot<Record<string, unknown>>(snapshotId);
    if (!rows.length) return NextResponse.json({ ready: true, profile: null });
    return NextResponse.json({ ready: true, profile: serialize(mapProfile(rows[0])) });
  } catch (e) {
    return NextResponse.json({ ready: false, status: "error", error: e instanceof Error ? e.message : "Error" }, { status: 502 });
  }
}
