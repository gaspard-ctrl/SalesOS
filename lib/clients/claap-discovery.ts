import {
  listClaapRecordingsPaginated,
  pickTranscriptUrl,
  extractTitleSearchHint,
  type ClaapRecording,
} from "../claap";
import type { DealSnapshot } from "../hubspot";
import type { ClaapMeetingForClient } from "./context";

// Quand sales_coach_analyses ne contient pas TOUS les meetings du deal — par
// exemple parce qu'ils sont trop anciens ou n'ont jamais été poussés via le
// webhook Claap — on va chercher en direct sur Claap. Match d'un recording au
// deal courant via :
//  - domaine email d'au moins un participant qui matche la company HubSpot ou
//    un contact du deal,
//  - OU titre du recording qui contient un token du nom de la company.
//
// Dédoublonnage : on exclut les recording_id déjà dans sales_coach_analyses,
// passés via `alreadyIndexed` par l'appelant.
//
// Stratégie de fetch (v3) : on paginate Claap mais on ne borne QUE la borne
// basse (createdate − WINDOW_BEFORE_DAYS). Pas de borne haute : les meetings
// post-signature (kickoff, QBR, follow-ups CS, escalades) doivent continuer
// d'apparaître dans la fiche client au fur et à mesure qu'ils sont
// enregistrés. À chaque relance d'enrichissement, on re-scanne et on prend
// les nouveaux.
//
// Concrètement :
//  - Claap renvoie les recordings du plus récent au plus ancien.
//  - On paginate vers le passé jusqu'à ce que la dernière ligne d'une page
//    soit ANTÉRIEURE à windowStart : aucun recording suivant ne pourra
//    matcher la fenêtre.
//  - MAX_RECORDINGS_SCANNED reste élevé (safety net) mais l'early stop sur
//    la date est ce qui termine en pratique.

const WINDOW_BEFORE_DAYS = 30;
const MAX_RECORDINGS_SCANNED = 5000;
const MAX_EXTRA_MATCHES = 50;
const TRANSCRIPT_FETCH_TIMEOUT_MS = 8000;

const PUBLIC_EMAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "hotmail.fr",
  "yahoo.com", "yahoo.fr", "icloud.com", "me.com", "live.com", "live.fr",
  "msn.com", "protonmail.com", "proton.me", "pm.me",
  "free.fr", "orange.fr", "sfr.fr", "wanadoo.fr", "laposte.net", "bbox.fr",
  "neuf.fr", "aol.com",
]);

function extractDomainsFromDeal(deal: DealSnapshot): Set<string> {
  const domains = new Set<string>();
  const companyDomain = deal.company?.domain?.toLowerCase().trim();
  if (companyDomain && !PUBLIC_EMAIL_DOMAINS.has(companyDomain)) domains.add(companyDomain);

  for (const c of deal.contacts ?? []) {
    const email = c.email?.toLowerCase().trim();
    if (!email || !email.includes("@")) continue;
    const dom = email.split("@")[1];
    if (dom && !PUBLIC_EMAIL_DOMAINS.has(dom)) domains.add(dom);
  }
  return domains;
}

function extractCompanyNameTokens(deal: DealSnapshot): string[] {
  // Tokens utilisés pour matcher le titre d'un recording. Sources :
  //  - nom de la company HubSpot (le plus fiable)
  //  - extraction depuis le nom du deal via le helper existant
  const tokens = new Set<string>();
  const companyName = deal.company?.name?.trim();
  if (companyName) {
    for (const w of companyName.split(/\s+/)) {
      if (w.length >= 3) tokens.add(w.toLowerCase());
    }
  }
  // Fallback : extraction depuis le dealname via la même heuristique que le
  // résolveur Claap inverse (titre → company). On utilise l'email du recorder
  // = "anything@coachello.io" comme proxy ; l'extracteur va virer "Coachello"
  // mais garder le nom du prospect.
  const hint = extractTitleSearchHint(deal.name, "anything@coachello.io");
  if (hint) {
    for (const w of hint.split(/\s+/)) {
      if (w.length >= 3) tokens.add(w.toLowerCase());
    }
  }
  return Array.from(tokens);
}

function recordingDateMs(rec: ClaapRecording): number | null {
  const iso = rec.meeting?.startingAt ?? rec.createdAt ?? null;
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : null;
}

function recordingMatchesDeal(
  rec: ClaapRecording,
  domains: Set<string>,
  nameTokens: string[],
): boolean {
  // 1. Match par domaine email participant — le signal le plus fort
  if (domains.size > 0) {
    for (const p of rec.meeting?.participants ?? []) {
      const dom = p.email?.toLowerCase().trim().split("@")[1];
      if (dom && domains.has(dom)) return true;
    }
  }
  // 2. Fallback : titre du recording contient un token significatif du nom
  // de la company. Risque de faux positifs (ex: "Acme" matche aussi "Acme
  // Corp" qui n'est pas notre client) — on l'utilise seulement quand le
  // match par email a échoué.
  if (nameTokens.length > 0 && rec.title) {
    const title = rec.title.toLowerCase();
    for (const tok of nameTokens) {
      if (title.includes(tok)) return true;
    }
  }
  return false;
}

async function fetchTranscriptText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TRANSCRIPT_FETCH_TIMEOUT_MS) });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

export async function discoverExtraClaapMeetings(
  deal: DealSnapshot | null,
  alreadyIndexed: Set<string>,
): Promise<ClaapMeetingForClient[]> {
  if (!deal || !process.env.CLAAP_API_TOKEN) return [];

  const domains = extractDomainsFromDeal(deal);
  const nameTokens = extractCompanyNameTokens(deal);
  if (domains.size === 0 && nameTokens.length === 0) return [];

  // Calcule la borne basse (et UNIQUEMENT la borne basse) :
  //  - createdate du deal − WINDOW_BEFORE_DAYS pour couvrir la prospection
  //    qui a précédé la création formelle du deal.
  //  - Pas de borne haute : les meetings post-signature (kickoff, QBR,
  //    follow-ups CS) doivent rester captés au fur et à mesure.
  //  - Si createdate manque (rare), fallback 24 mois avant maintenant pour
  //    pas scanner tout l'historique Claap sans raison.
  const createdateMs = deal.createdate
    ? new Date(deal.createdate).getTime()
    : Date.now() - 730 * 24 * 60 * 60 * 1000;
  const windowStart = createdateMs - WINDOW_BEFORE_DAYS * 24 * 60 * 60 * 1000;

  // Claap retourne les recordings du + récent au + ancien. On paginate
  // jusqu'à ce que la page la plus récente passe sous windowStart : aucun
  // recording suivant ne pourra plus matcher.
  let recordings: ClaapRecording[];
  try {
    recordings = await listClaapRecordingsPaginated({
      maxTotal: MAX_RECORDINGS_SCANNED,
      pageSize: 100,
      shouldContinue: (lastRec) => {
        const ms = recordingDateMs(lastRec);
        // Si on n'a pas de date, on continue par prudence
        if (ms === null) return true;
        return ms >= windowStart;
      },
    });
  } catch (e) {
    console.warn(`[clients/claap-discovery] list failed:`, e instanceof Error ? e.message : e);
    return [];
  }

  // Filtre : (date >= windowStart) ET (pas déjà indexé) ET (matche le deal).
  // Pas de borne haute — on accepte explicitement les meetings dans le futur
  // par rapport au close_date (CS post-signature, etc).
  const matchesMeta: Array<{ rec: ClaapRecording; transcriptUrl: string | null }> = [];
  for (const rec of recordings) {
    if (alreadyIndexed.has(rec.id)) continue;
    const ms = recordingDateMs(rec);
    if (ms !== null && ms < windowStart) continue;
    if (!recordingMatchesDeal(rec, domains, nameTokens)) continue;
    const transcriptUrl = pickTranscriptUrl(rec);
    matchesMeta.push({ rec, transcriptUrl });
    if (matchesMeta.length >= MAX_EXTRA_MATCHES) break;
  }
  if (matchesMeta.length === 0) {
    console.log(
      `[clients/claap-discovery] deal=${deal.id} : 0 match (scanned ${recordings.length} recordings ` +
        `since ${new Date(windowStart).toISOString().slice(0, 10)})`,
    );
    return [];
  }

  // Fetch transcripts en parallèle (max 15 = OK, pas de rate limit côté
  // Claap signed URL S3)
  const transcripts = await Promise.all(
    matchesMeta.map((m) => (m.transcriptUrl ? fetchTranscriptText(m.transcriptUrl) : Promise.resolve(null))),
  );

  const meetings: ClaapMeetingForClient[] = matchesMeta.map((m, i) => ({
    recording_id: m.rec.id,
    meeting_title: m.rec.title ?? null,
    meeting_started_at: m.rec.meeting?.startingAt ?? m.rec.createdAt ?? null,
    meeting_kind: null,
    audience: null,
    meeting_recap_summary: null,
    transcript_text: transcripts[i],
    is_discovered: true,
    claap_url: m.rec.url ?? null,
  }));

  console.log(
    `[clients/claap-discovery] deal=${deal.id} : matched ${meetings.length} Claap recording(s) non indexé(s) ` +
      `(scanned=${recordings.length}, domains=[${Array.from(domains).join(",")}], tokens=[${nameTokens.join(",")}], ` +
      `since=${new Date(windowStart).toISOString().slice(0, 10)})`,
  );

  return meetings;
}
