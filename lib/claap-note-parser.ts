export type ParsedClaapNote = {
  title: string | null;
  meetingDate: string | null;
  claapUrl: string | null;
  keyTakeaways: string;
  actionItems: string;
};

export const CLAAP_NOTE_MARKER = "View meeting in Claap:";

export function isClaapNote(rawBody: string): boolean {
  return htmlToText(rawBody).includes(CLAAP_NOTE_MARKER);
}

export function htmlToText(s: string): string {
  if (!s) return "";
  return s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<\/(?:p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<\/(?:ul|ol|table|thead|tbody)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const KEY_RE = /(?:^|\n)\s*(?:💡\s*)?Key\s+takeaways\s*(?:\n|$)/i;
const ACTION_RE = /(?:^|\n)\s*(?:✅\s*)?Action\s+items\s*(?:\n|$)/i;
const STOP_RE = /(?:^|\n)\s*(?:💬\s*Small\s+talk|📄\s*Summary|❓\s*Situation|🤔\s*Problem|⚙️\s*Implication|👍\s*Need-Payoff)\s*(?:\n|$)/i;

const TITLE_RE = /Rencontre\s+(.+?)\s+on\s+(\d{4}-\d{2}-\d{2})/;
const CLAAP_URL_RE = /https:\/\/app\.claap\.io\/[^\s)<>"']+/;

function findMarker(text: string, regex: RegExp): { start: number; end: number } | null {
  const m = regex.exec(text);
  if (!m || m.index === undefined) return null;
  return { start: m.index, end: m.index + m[0].length };
}

function normalizeBullets(s: string): string {
  return s
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      const m = trimmed.match(/^[-*•–·]\s+(.+)$/);
      return m ? `• ${m[1]}` : trimmed;
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function parseClaapNote(rawBody: string): ParsedClaapNote {
  const text = htmlToText(rawBody);

  const titleMatch = text.match(TITLE_RE);
  const title = titleMatch ? titleMatch[1].trim() : null;
  const meetingDate = titleMatch ? titleMatch[2] : null;

  // Extract Claap URL from the raw body so we don't lose URLs that live inside
  // HTML href attributes (e.g. <a href="https://app.claap.io/...">).
  const urlMatch = (rawBody || "").match(CLAAP_URL_RE) ?? text.match(CLAAP_URL_RE);
  const claapUrl = urlMatch ? urlMatch[0] : null;

  const key = findMarker(text, KEY_RE);
  const action = findMarker(text, ACTION_RE);
  const stop = findMarker(text, STOP_RE);

  let keyTakeaways = "";
  if (key) {
    const sliceEnd = action && action.start > key.end
      ? action.start
      : stop && stop.start > key.end
        ? stop.start
        : text.length;
    keyTakeaways = normalizeBullets(text.slice(key.end, sliceEnd).trim());
  }

  let actionItems = "";
  if (action) {
    const sliceEnd = stop && stop.start > action.end ? stop.start : text.length;
    const raw = text.slice(action.end, sliceEnd).trim();
    actionItems = raw.toLowerCase() === "none" ? "" : normalizeBullets(raw);
  }

  return { title, meetingDate, claapUrl, keyTakeaways, actionItems };
}
