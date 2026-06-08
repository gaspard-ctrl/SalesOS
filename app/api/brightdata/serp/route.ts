import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { BRIGHTDATA_API_KEY, SERP_ZONE, fetchSerp } from "@/lib/brightdata/serp";

export const dynamic = "force-dynamic";

// Moteurs Google exposés via la zone SERP.
type Engine = "web" | "news" | "trends" | "maps" | "shopping" | "images";
const ENGINES: Engine[] = ["web", "news", "trends", "maps", "shopping", "images"];

interface SerpBody {
  engine?: string;
  q?: string;
  country?: string; // gl, ex. "fr", "us"
  lang?: string; // hl, ex. "fr", "en"
  num?: number; // nb de résultats
}

// Construit l'URL Google à passer à la SERP API selon le moteur.
// `brd_json=1` => Bright Data renvoie le JSON parsé (sauf Trends, non supporté).
function buildGoogleUrl(engine: Engine, q: string, opts: { country: string; lang: string; num: number }): string {
  const enc = encodeURIComponent(q);
  const { country, lang, num } = opts;

  if (engine === "trends") {
    // Pas de brd_json fiable sur trends.google.com : best-effort, souvent renvoyé en brut.
    const geo = country ? `&geo=${country.toUpperCase()}` : "";
    return `https://trends.google.com/trends/explore?q=${enc}${geo}&hl=${lang}`;
  }

  // tbm : nws (news), lcl (local/maps), shop (shopping), isch (images). Vide => web.
  const tbm = engine === "news" ? "&tbm=nws" : engine === "maps" ? "&tbm=lcl" : engine === "shopping" ? "&tbm=shop" : engine === "images" ? "&tbm=isch" : "";

  return `https://www.google.com/search?q=${enc}${tbm}&brd_json=1&num=${num}&hl=${lang}&gl=${country}`;
}

// Extrait le sous-ensemble pertinent du JSON Google selon le moteur (rendu lisible côté front).
// Renvoie null si la donnée n'est pas un objet JSON exploitable.
function extractParsed(engine: Engine, data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const pick = (...keys: string[]) => {
    const out: Record<string, unknown> = {};
    for (const k of keys) if (d[k] !== undefined) out[k] = d[k];
    return out;
  };

  switch (engine) {
    case "web":
      return pick("organic", "knowledge", "people_also_ask", "related", "ads", "top_ads", "featured_snippet");
    case "news":
      return pick("news", "organic");
    case "maps":
      return pick("local_results", "local", "places", "organic");
    case "shopping":
      return pick("shopping", "shopping_results", "organic", "pla");
    case "images":
      return pick("images", "image", "organic");
    case "trends":
      return pick("interest_over_time", "related_queries", "related_topics");
    default:
      return null;
  }
}

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  if (!BRIGHTDATA_API_KEY) {
    return NextResponse.json({ error: "BRIGHTDATA_API_KEY missing from the environment" }, { status: 500 });
  }

  let body: SerpBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const engine = (body.engine ?? "web") as Engine;
  if (!ENGINES.includes(engine)) {
    return NextResponse.json({ error: `Unknown engine: ${body.engine}. Expected: ${ENGINES.join(", ")}` }, { status: 400 });
  }

  const q = body.q?.trim() ?? "";
  if (!q) return NextResponse.json({ error: "Query (q) required" }, { status: 400 });

  const country = (body.country?.trim() || "us").toLowerCase();
  const lang = (body.lang?.trim() || "en").toLowerCase();
  const num = Math.min(Math.max(Number(body.num) || 10, 1), 100);

  const googleUrl = buildGoogleUrl(engine, q, { country, lang, num });

  let result;
  try {
    result = await fetchSerp(googleUrl);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Bright Data call error" }, { status: 502 });
  }

  // On renvoie toujours la forme complète, même sur statut non-2xx, pour que le
  // front affiche l'erreur Bright Data sans écran blanc (cf. fetcher silencieux).
  return NextResponse.json({
    engine,
    ok: result.ok,
    status: result.status,
    ms: result.ms,
    isJson: result.isJson,
    request: { googleUrl, zone: SERP_ZONE, sentBody: result.sentBody },
    parsed: result.isJson ? extractParsed(engine, result.data) : null,
    raw: result.data,
  });
}
