import type { TranscriptSegment, TranscriptSpeaker } from "@/lib/claap";

export type TalkRatioBySpeaker = {
  speakerId: string;
  name: string | null;
  email: string | null;
  seconds: number;
  pct: number;
  isInternal: boolean;
};

export type TalkRatio = {
  total_seconds: number;
  internal_pct: number;
  external_pct: number;
  by_speaker: TalkRatioBySpeaker[];
};

/**
 * Compute talk ratio from Claap structured transcript.
 *
 * "Internal" = speakers whose email domain matches the recorder's domain
 * (Coachello side). External = the prospect side.
 *
 * Returns null if segments / speakers are missing or unusable.
 */
export function computeTalkRatio(args: {
  segments: TranscriptSegment[];
  speakers: TranscriptSpeaker[];
  recorderEmail: string | null;
}): TalkRatio | null {
  const { segments, speakers, recorderEmail } = args;
  if (!segments || segments.length === 0) return null;

  const recorderDomain = recorderEmail?.split("@")[1]?.toLowerCase() ?? null;

  // Sum durations per speakerId
  const totals = new Map<string, number>();
  let total = 0;
  for (const s of segments) {
    const dur = Math.max(0, s.end - s.start);
    totals.set(s.speakerId, (totals.get(s.speakerId) ?? 0) + dur);
    total += dur;
  }
  if (total === 0) return null;

  const speakerById = new Map(speakers.map((sp) => [sp.speakerId, sp]));

  const by_speaker: TalkRatioBySpeaker[] = Array.from(totals.entries())
    .map(([speakerId, seconds]) => {
      const sp = speakerById.get(speakerId);
      const email = sp?.email ?? null;
      const domain = email?.split("@")[1]?.toLowerCase() ?? null;
      const isInternal = sp?.isRecorder === true || (recorderDomain != null && domain === recorderDomain);
      return {
        speakerId,
        name: sp?.name ?? null,
        email,
        seconds: Math.round(seconds),
        pct: Math.round((seconds / total) * 100),
        isInternal,
      };
    })
    .sort((a, b) => b.seconds - a.seconds);

  const internalSeconds = by_speaker.filter((s) => s.isInternal).reduce((a, s) => a + s.seconds, 0);
  const externalSeconds = total - internalSeconds;

  return {
    total_seconds: Math.round(total),
    internal_pct: Math.round((internalSeconds / total) * 100),
    external_pct: Math.round((externalSeconds / total) * 100),
    by_speaker,
  };
}
