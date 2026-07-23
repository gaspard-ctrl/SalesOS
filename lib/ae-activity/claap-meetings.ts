// ────────────────────────────────────────────────────────────────────────
// Meetings tenus (enregistrés avec un prospect) par rep, depuis Claap.
//
// On scanne l'historique Claap une seule fois (newest-first, early-stop sous la
// date de départ) et on regroupe par email du recorder = email du rep. "Tenu
// avec prospect" = au moins un participant externe (domaine ≠ recorder).
// ────────────────────────────────────────────────────────────────────────

import {
  listClaapRecordingsPaginated,
  extractExternalParticipants,
  type ClaapRecording,
} from "@/lib/claap";
import { toDayString } from "./aggregate";

function recStartIso(rec: ClaapRecording): string | null {
  return rec.meeting?.startingAt ?? rec.createdAt ?? null;
}

/**
 * Retourne une map email-recorder (lowercase) → jours "YYYY-MM-DD" des meetings
 * tenus avec un prospect depuis `startDay`. Best-effort : map vide si Claap
 * n'est pas configuré ou en cas d'erreur.
 */
export async function fetchClaapMeetingsHeld(startDay: string): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (!process.env.CLAAP_API_TOKEN) return out;

  const startMs = Date.parse(`${startDay}T00:00:00Z`);
  let recordings: ClaapRecording[] = [];
  try {
    recordings = await listClaapRecordingsPaginated({
      maxTotal: 5000,
      pageSize: 100,
      maxPages: 50,
      shouldContinue: (last) => {
        const iso = recStartIso(last);
        const ms = iso ? Date.parse(iso) : NaN;
        return !Number.isFinite(ms) || ms >= startMs;
      },
    });
  } catch (e) {
    console.warn("[ae-activity] claap scan failed:", e instanceof Error ? e.message : e);
    return out;
  }

  for (const rec of recordings) {
    const day = toDayString(recStartIso(rec));
    if (!day) continue;
    const ms = Date.parse(`${day}T00:00:00Z`);
    if (Number.isFinite(ms) && ms < startMs) continue;

    const recorderEmail = rec.recorder?.email?.toLowerCase().trim();
    if (!recorderEmail) continue;

    const external = extractExternalParticipants(rec.meeting?.participants, recorderEmail);
    if (external.length === 0) continue; // meeting interne → pas "tenu avec prospect"

    const arr = out.get(recorderEmail) ?? [];
    arr.push(day);
    out.set(recorderEmail, arr);
  }
  return out;
}
