import { createHash } from "crypto";
import type { ScoredSignal } from "./types";

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function hostOf(url: string | null): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * Clé de dédup déterministe d'un signal. Inclut l'identité société + le contenu,
 * pour que `ON CONFLICT (dedupe_key) DO NOTHING` ne ré-insère jamais un signal
 * déjà vu (même article/post/nomination), quel que soit le run.
 *
 * - article/post : société + host + titre normalisé (tronqué)
 * - sans URL (people_move Apollo) : société + type + titre normalisé
 */
export function dedupeKey(s: ScoredSignal): string {
  const company = norm(s.company_name) || norm(s.company_domain ?? "") || "unknown";
  const title = norm(s.title).slice(0, 90);
  const basis = s.url
    ? `${company}|${hostOf(s.url)}|${title}`
    : `${company}|${s.signal_type}|${title}`;
  return createHash("sha256").update(basis).digest("hex").slice(0, 32);
}
