// Fuzzy name matching for HubSpot lookups: tolerates casing, accents,
// punctuation, corporate suffixes (SAS / Inc / Ltd …), and small typos via
// Jaro-Winkler similarity.

const CORPORATE_SUFFIXES = [
  "inc", "incorporated", "llc", "ltd", "limited", "corp", "corporation",
  "co", "company", "sa", "sas", "sasu", "sarl", "eurl", "snc", "scop",
  "gmbh", "ag", "ug", "kg", "ohg", "bv", "nv", "oy", "ab", "as", "sl",
  "spa", "srl", "plc", "pty", "lda",
];

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function basicNormalize(s: string): string {
  return stripAccents(s.toLowerCase())
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeCompany(name: string | null | undefined): string {
  if (!name) return "";
  const base = basicNormalize(name);
  if (!base) return "";
  const tokens = base.split(" ").filter(t => t && !CORPORATE_SUFFIXES.includes(t));
  return tokens.join(" ");
}

export function normalizePerson(name: string | null | undefined): string {
  if (!name) return "";
  const base = basicNormalize(name);
  return base.split(" ").filter(Boolean).sort().join(" "); // order-independent
}

// First "significant" token (>= 3 chars, after normalization). Used as the
// HubSpot CONTAINS_TOKEN seed before fuzzy-scoring candidates client-side.
export function firstSignificantToken(normalized: string, minLen = 3): string | null {
  for (const t of normalized.split(" ")) {
    if (t.length >= minLen) return t;
  }
  return null;
}

// Jaro-Winkler similarity ∈ [0, 1]. Returns 1 for identical strings.
export function jaroWinkler(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;

  const aLen = a.length;
  const bLen = b.length;
  const matchDist = Math.max(0, Math.floor(Math.max(aLen, bLen) / 2) - 1);
  const aMatches = new Array<boolean>(aLen).fill(false);
  const bMatches = new Array<boolean>(bLen).fill(false);

  let matches = 0;
  for (let i = 0; i < aLen; i++) {
    const start = Math.max(0, i - matchDist);
    const end = Math.min(i + matchDist + 1, bLen);
    for (let j = start; j < end; j++) {
      if (bMatches[j]) continue;
      if (a[i] !== b[j]) continue;
      aMatches[i] = true;
      bMatches[j] = true;
      matches++;
      break;
    }
  }
  if (matches === 0) return 0;

  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < aLen; i++) {
    if (!aMatches[i]) continue;
    while (!bMatches[k]) k++;
    if (a[i] !== b[k]) transpositions++;
    k++;
  }

  const m = matches;
  const jaro = (m / aLen + m / bLen + (m - transpositions / 2) / m) / 3;

  // Winkler boost: up to 4 leading chars in common
  let prefix = 0;
  const maxPrefix = Math.min(4, aLen, bLen);
  for (let i = 0; i < maxPrefix; i++) {
    if (a[i] === b[i]) prefix++;
    else break;
  }
  return jaro + prefix * 0.1 * (1 - jaro);
}

export interface FuzzyCandidate<T> {
  item: T;
  score: number;
}

export function pickBestFuzzy<T>(
  candidates: T[],
  needle: string,
  getHaystack: (c: T) => string,
  threshold: number,
): FuzzyCandidate<T> | null {
  if (!needle) return null;
  let best: FuzzyCandidate<T> | null = null;
  for (const item of candidates) {
    const hay = getHaystack(item);
    if (!hay) continue;
    const score = jaroWinkler(needle, hay);
    if (score >= threshold && (!best || score > best.score)) {
      best = { item, score };
    }
  }
  return best;
}
