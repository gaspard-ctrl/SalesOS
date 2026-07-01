// Enrichit une liste de prospects avec leur contexte LinkedIn (profil + posts
// perso récents) via Bright Data. Best-effort : chaque prospect qu'on n'arrive
// pas à résoudre/scraper à temps est simplement ignoré (on ne bloque jamais
// l'analyse AE). Utilisé par run-ae-analysis en mode "Analysis + messages".
import {
  resolveUsername,
  getProfile,
  getPeoplePosts,
  type LinkedInProfile,
} from "@/lib/brightdata/linkedin";
import { BRIGHTDATA_API_KEY } from "@/lib/brightdata/serp";
import type { AeLinkedInProfile } from "./briefs";

export interface ProspectLinkedInInput {
  name: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  hubspotId?: string | null;
}

// L'analyse AE tourne en background Netlify (large marge) : on peut se permettre
// des timeouts généreux, le scrape dataset Bright Data étant lent (10-60s).
const PROFILE_TIMEOUT_MS = 30_000;
const POSTS_TIMEOUT_MS = 35_000;
const CONCURRENCY = 4;
const MAX_POSTS = 4;

function splitName(full: string): { first: string; last: string } {
  const t = (full ?? "").trim().split(/\s+/).filter(Boolean);
  if (t.length === 0) return { first: "", last: "" };
  if (t.length === 1) return { first: t[0], last: "" };
  return { first: t[0], last: t.slice(1).join(" ") };
}

function formatCurrentPosition(profile: LinkedInProfile): string | null {
  const p = profile.position?.[0];
  if (!p) return null;
  const bits = [p.title, p.companyName].filter(Boolean);
  return bits.length ? bits.join(" @ ") : null;
}

// Pool de concurrence (même pattern que verify-contact-roles) pour ne pas
// lancer N scrapes datasets simultanés.
async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

async function enrichOne(
  prospect: ProspectLinkedInInput,
  company: string,
): Promise<AeLinkedInProfile | null> {
  const first = (prospect.firstName ?? "").trim() || splitName(prospect.name).first;
  const last = (prospect.lastName ?? "").trim() || splitName(prospect.name).last;
  if (!first && !last) return null;

  try {
    const username = await resolveUsername({
      firstName: first,
      lastName: last,
      company,
      email: prospect.email ?? undefined,
    });
    if (!username) return null;

    // Profil + posts perso en parallèle, chacun best-effort.
    const [profileRes, postsRes] = await Promise.allSettled([
      getProfile(username, { timeoutMs: PROFILE_TIMEOUT_MS }),
      getPeoplePosts(username, { timeoutMs: POSTS_TIMEOUT_MS }),
    ]);

    const profile = profileRes.status === "fulfilled" ? profileRes.value : null;
    const rawPosts = postsRes.status === "fulfilled" ? postsRes.value.data : [];

    const posts = rawPosts
      .filter((p) => p.text.trim().length > 0)
      .slice(0, MAX_POSTS)
      .map((p) => ({
        text: p.text.trim(),
        postedAt: p.postedAt || null,
        url: p.postUrl || null,
      }));

    // Rien d'exploitable (ni profil, ni posts) : on n'ajoute pas de carte vide.
    if (!profile && posts.length === 0) return null;

    return {
      name: prospect.name,
      hubspot_id: prospect.hubspotId ?? null,
      profileUrl: `https://www.linkedin.com/in/${username}/`,
      headline: profile?.headline?.trim() || null,
      currentPosition: profile ? formatCurrentPosition(profile) : null,
      location: profile?.geo?.city?.trim() || null,
      summary: profile?.summary ? profile.summary.trim().slice(0, 400) : null,
      posts,
    };
  } catch {
    return null;
  }
}

/**
 * Résout + scrape le LinkedIn de chaque prospect (concurrence limitée). Renvoie
 * seulement les prospects réellement enrichis. Liste vide si Bright Data n'est
 * pas configuré.
 */
export async function fetchProspectsLinkedIn(
  prospects: ProspectLinkedInInput[],
  company: string,
): Promise<AeLinkedInProfile[]> {
  if (!BRIGHTDATA_API_KEY || prospects.length === 0) return [];
  const results = await mapPool(prospects, CONCURRENCY, (p) => enrichOne(p, company));
  return results.filter((r): r is AeLinkedInProfile => r !== null);
}
