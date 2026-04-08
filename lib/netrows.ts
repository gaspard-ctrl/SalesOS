// ── Netrows API client ──────────────────────────────────────────────────────
// Docs: https://netrows.com/docs
// Base URL: https://api.netrows.com/v1

const BASE = "https://api.netrows.com/v1";

function getApiKey(): string {
  const key = process.env.NETROWS_API_KEY;
  if (!key) throw new Error("NETROWS_API_KEY not set");
  return key;
}

async function netrows<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${getApiKey()}` },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Netrows ${res.status} ${path}: ${text.slice(0, 200)}`);
  }

  return res.json();
}

async function netrowsPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Netrows POST ${res.status} ${path}: ${text.slice(0, 200)}`);
  }

  return res.json();
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface LinkedInProfile {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  headline: string;
  summary: string;
  profilePicture: string;
  geo: { country: string; city: string; countryCode: string };
  position: {
    companyName: string;
    companyUsername: string;
    title: string;
    location: string;
    description: string;
    start: { year: number; month: number };
    end: { year: number; month: number };
  }[];
  educations: { schoolName: string; degree: string; fieldOfStudy: string }[];
  skills: { name: string }[];
}

export interface LinkedInPost {
  postUrl: string;
  text: string;
  author: { name: string; headline: string; username: string; profileUrl: string };
  postedAt: string;
  likes: number;
  comments: number;
  shares: number;
}

export interface CompanyPost {
  postUrl: string;
  text: string;
  postedAt: string;
  likes: number;
  comments: number;
}

export interface RadarWebhookPayload {
  event: "profile.changed" | "company.changed";
  timestamp: string;
  profile?: { username: string; url: string };
  company?: { username: string; url: string };
  changes: { field: string; oldValue: unknown; newValue: unknown }[];
  summary: string;
  newSnapshot: Record<string, unknown>;
}

// ── People ───────────────────────────────────────────────────────────────────

/** Get full LinkedIn profile by username (1 credit) */
export async function getProfile(username: string): Promise<LinkedInProfile> {
  return netrows<LinkedInProfile>("/people/profile", { username });
}

/** Get full LinkedIn profile by URL (1 credit) */
export async function getProfileByUrl(url: string): Promise<LinkedInProfile> {
  return netrows<LinkedInProfile>("/people/profile-by-url", { url });
}

/** Search people by company + title (1 credit per page) */
export async function searchPeople(params: {
  company?: string;
  keywordTitle?: string;
  keywords?: string;
  firstName?: string;
  lastName?: string;
  start?: number;
}): Promise<{ data: { total: number; items: { fullName: string; headline: string; username: string; location: string; profileURL: string }[] } }> {
  const query: Record<string, string> = {};
  if (params.company) query.company = params.company;
  if (params.keywordTitle) query.keywordTitle = params.keywordTitle;
  if (params.keywords) query.keywords = params.keywords;
  if (params.firstName) query.firstName = params.firstName;
  if (params.lastName) query.lastName = params.lastName;
  if (params.start !== undefined) query.start = String(params.start);
  return netrows("/people/search", query);
}

/** Reverse email lookup — find LinkedIn profile from work email (1 credit) */
export async function reverseLookup(email: string): Promise<{
  found: boolean;
  linkedinUrl: string;
  profile: { fullName: string; headline: string; username: string; profileURL: string };
}> {
  return netrows("/people/reverse-lookup", { email });
}

// ── Companies ────────────────────────────────────────────────────────────────

/** Get company details (1 credit) */
export async function getCompanyDetails(username: string): Promise<{
  name: string; description: string; website: string; industry: string;
  companySize: string; headquarters: string; employeeCount: number;
  followerCount: number; founded: number;
}> {
  return netrows("/companies/details", { username });
}

/** Get company posts (1 credit) */
export async function getCompanyPosts(username: string, start = 0): Promise<{
  success: boolean;
  data: CompanyPost[];
}> {
  return netrows("/companies/posts", { url: username, start: String(start) });
}

/** Get company job listings (1 credit) */
export async function getCompanyJobs(companyId: string, page = 1): Promise<{
  success: boolean;
  data: { title: string; location: string; postedAt: string; url: string }[];
}> {
  return netrows("/companies/jobs", { companyIds: companyId, page: String(page) });
}

// ── Posts search ─────────────────────────────────────────────────────────────

/** Search LinkedIn posts by keyword (1 credit) */
export async function searchPosts(keyword: string, sortBy = "date_posted", datePosted = ""): Promise<{
  success: boolean;
  data: LinkedInPost[];
}> {
  const params: Record<string, string> = { keyword, sortBy };
  if (datePosted) params.datePosted = datePosted;
  return netrows("/posts/search", params);
}

// ── Radar ────────────────────────────────────────────────────────────────────

/** List monitored companies (free) */
export async function listRadarCompanies(): Promise<{ data: { id: string; username: string; is_active: boolean }[] }> {
  return netrows("/radar/companies");
}

/** Add company to Radar (1 credit one-time, monitoring free forever) */
export async function addCompanyToRadar(username: string): Promise<{ success: boolean }> {
  return netrowsPost("/radar/companies", { username });
}

/** List monitored profiles (free) */
export async function listRadarProfiles(): Promise<{ data: { id: string; username: string; is_active: boolean }[] }> {
  return netrows("/radar/profiles");
}

/** Add profile to Radar (1 credit one-time) */
export async function addProfileToRadar(username: string): Promise<{ success: boolean }> {
  return netrowsPost("/radar/profiles", { username });
}

// ── Config — mots-clés pour le scan ─────────────────────────────────────────

/** Mots-clés pour détecter les changements de poste dans les posts LinkedIn */
export const JOB_CHANGE_KEYWORDS = [
  "ravi de rejoindre",
  "nouvelle aventure",
  "nouveau challenge",
  "nouveau poste",
  "je suis heureux d'annoncer",
  "thrilled to join",
  "excited to announce",
  "new role",
  "nouveau chapitre",
  "nommé DRH",
  "nommé Head of",
  "nommée Directrice",
];

/** Mots-clés pour détecter les posts coaching/L&D */
export const COACHING_KEYWORDS = [
  "coaching managers",
  "coaching leadership",
  "développement managérial",
  "formation managers",
  "talent development",
  "learning development",
  "coaching professionnel",
  "leadership development",
  "coaching équipe",
  "développement leadership",
  "onboarding managers",
  "executive coaching",
  "rétention talents",
  "engagement collaborateurs",
  "qualité vie travail",
];
