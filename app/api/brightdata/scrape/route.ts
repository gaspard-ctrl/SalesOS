import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { BRIGHTDATA_API_KEY as API_KEY, SERP_ZONE, authHeaders } from "@/lib/brightdata/serp";

export const dynamic = "force-dynamic";

const DATASET_ID = process.env.BRIGHTDATA_LINKEDIN_DATASET_ID || "gd_l1viktl72bvl7bjuj0";
const BASE = "https://api.brightdata.com/datasets/v3";
const MAX_PROFILES = 10; // plafond de profils scrapés par recherche

// Normalise pour comparaison : minuscules, accents retirés, ponctuation -> espaces.
function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Clé de dédup d'un profil : le slug après /in/, sans variante pays (fr./www.).
function profileSlug(url: string): string {
  const m = url.match(/\/in\/([^/?#]+)/i);
  return m ? decodeURIComponent(m[1]).toLowerCase() : url.toLowerCase();
}

type Candidate = { url: string; title: string };

// ── Recherche LinkedIn via la SERP API Bright Data (Google) ─────────────────
// On interroge Google restreint à linkedin.com/in et on récupère les résultats
// organiques déjà parsés (brd_json=1). Remplace Tavily, 100% Bright Data.
async function searchLinkedInProfiles(firstName: string, lastName: string, company: string): Promise<Candidate[]> {
  const terms = [firstName, lastName, company].filter(Boolean).join(" ");
  const q = encodeURIComponent(`${terms} site:linkedin.com/in`);
  const googleUrl = `https://www.google.com/search?q=${q}&brd_json=1&num=20`;

  const res = await fetch("https://api.brightdata.com/request", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ zone: SERP_ZONE, url: googleUrl, format: "raw" }),
  });
  if (!res.ok) {
    throw new Error(`SERP API ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }

  let parsed: { organic?: { link?: string; url?: string; title?: string }[] };
  try {
    parsed = JSON.parse(await res.text());
  } catch {
    throw new Error("Réponse SERP illisible (JSON attendu)");
  }

  const organic = parsed.organic ?? [];
  const fn = normalize(firstName);
  const ln = normalize(lastName);

  const seen = new Set<string>();
  const candidates: Candidate[] = [];
  for (const o of organic) {
    const url = o.link || o.url || "";
    if (!/linkedin\.com\/in\//i.test(url)) continue;
    const slug = profileSlug(url);
    if (seen.has(slug)) continue; // dédup fr./www. du même profil
    const hay = `${normalize(slug)} ${normalize(o.title ?? "")}`;
    // On exige au moins le nom de famille pour écarter le bruit (profils sans rapport).
    if (ln && !hay.includes(ln)) continue;
    seen.add(slug);
    candidates.push({ url, title: o.title ?? "" });
  }

  // On remonte en tête ceux dont le prénom correspond aussi (match le plus probable).
  candidates.sort((a, b) => {
    const aF = fn && normalize(`${profileSlug(a.url)} ${a.title}`).includes(fn) ? 0 : 1;
    const bF = fn && normalize(`${profileSlug(b.url)} ${b.title}`).includes(fn) ? 0 : 1;
    return aF - bF;
  });

  return candidates.slice(0, MAX_PROFILES);
}

// ── POST : recherche + déclenche le scrape de tous les profils trouvés ──────
// Body: { linkedinUrl } OU { firstName, lastName, company? }.
// Le scraping Bright Data est asynchrone : on déclenche, puis le front poll le
// GET ci-dessous (évite le timeout Netlify ~26s sur les fonctions synchrones).
export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  if (!API_KEY) {
    return NextResponse.json({ error: "BRIGHTDATA_API_KEY manquante dans l'environnement" }, { status: 500 });
  }

  let body: { firstName?: string; lastName?: string; company?: string; linkedinUrl?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 });
  }

  const firstName = body.firstName?.trim() ?? "";
  const lastName = body.lastName?.trim() ?? "";
  const company = body.company?.trim() ?? "";
  const directUrl = body.linkedinUrl?.trim() ?? "";

  // 1) Constituer la liste des URLs à scraper
  let urls: string[];
  if (directUrl) {
    if (!/linkedin\.com\/in\//i.test(directUrl)) {
      return NextResponse.json({ error: "L'URL doit être un profil LinkedIn (linkedin.com/in/...)" }, { status: 400 });
    }
    urls = [directUrl];
  } else {
    if (!firstName || !lastName) {
      return NextResponse.json({ error: "Fournis une URL LinkedIn, ou un prénom + nom" }, { status: 400 });
    }
    let candidates: Candidate[];
    try {
      candidates = await searchLinkedInProfiles(firstName, lastName, company);
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Erreur recherche SERP" }, { status: 502 });
    }
    if (candidates.length === 0) {
      return NextResponse.json(
        { error: "Aucun profil LinkedIn trouvé pour ce nom (essaie d'ajouter la société, ou colle l'URL directement)" },
        { status: 404 },
      );
    }
    urls = candidates.map((c) => c.url);
  }

  // 2) Déclencher la collecte Bright Data (toutes les URLs en un seul snapshot)
  const triggerUrl = `${BASE}/trigger?dataset_id=${DATASET_ID}&include_errors=true`;
  const res = await fetch(triggerUrl, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(urls.map((url) => ({ url }))),
  });

  const text = await res.text();
  if (!res.ok) {
    return NextResponse.json({ error: `Bright Data ${res.status}: ${text.slice(0, 300)}` }, { status: res.status });
  }

  let json: { snapshot_id?: string };
  try {
    json = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: `Réponse Bright Data inattendue: ${text.slice(0, 200)}` }, { status: 502 });
  }

  if (!json.snapshot_id) {
    return NextResponse.json({ error: "snapshot_id absent de la réponse Bright Data" }, { status: 502 });
  }

  return NextResponse.json({ snapshotId: json.snapshot_id, urls, count: urls.length });
}

// ── GET ?snapshot_id=... : poll l'état du snapshot ──────────────────────────
// status "running" => pas encore prêt ; "ready" => renvoie les profils.
export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  if (!API_KEY) {
    return NextResponse.json({ error: "BRIGHTDATA_API_KEY manquante dans l'environnement" }, { status: 500 });
  }

  const snapshotId = req.nextUrl.searchParams.get("snapshot_id")?.trim();
  if (!snapshotId) {
    return NextResponse.json({ error: "snapshot_id requis" }, { status: 400 });
  }

  // 1) état du snapshot
  const progressRes = await fetch(`${BASE}/progress/${snapshotId}`, { headers: authHeaders() });
  const progressText = await progressRes.text();
  if (!progressRes.ok) {
    return NextResponse.json(
      { error: `Bright Data ${progressRes.status}: ${progressText.slice(0, 300)}`, status: "error" },
      { status: progressRes.status },
    );
  }

  let progress: { status?: string };
  try {
    progress = JSON.parse(progressText);
  } catch {
    progress = {};
  }

  const status = progress.status ?? "unknown";
  if (status !== "ready") {
    // running / building / collecting ... pas encore de données
    return NextResponse.json({ status, ready: false });
  }

  // 2) snapshot prêt => on récupère les données
  const dataRes = await fetch(`${BASE}/snapshot/${snapshotId}?format=json`, { headers: authHeaders() });
  const dataText = await dataRes.text();
  if (!dataRes.ok) {
    return NextResponse.json(
      { error: `Bright Data ${dataRes.status}: ${dataText.slice(0, 300)}`, status: "error" },
      { status: dataRes.status },
    );
  }

  let data: unknown;
  try {
    data = JSON.parse(dataText);
  } catch {
    return NextResponse.json({ error: "Données Bright Data illisibles", status: "error" }, { status: 502 });
  }

  const profiles = Array.isArray(data) ? data : [data];
  return NextResponse.json({ status: "ready", ready: true, profiles });
}
