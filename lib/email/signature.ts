// Signature email par utilisateur. Structure stockée dans users.email_signature (JSONB).
// Rendu partagé client (preview dans Settings) + serveur (injection à l'envoi via buildRawEmail).
// Aucune dépendance serveur ici : ce fichier doit rester importable côté client.

export type ImagePosition = "above" | "below";

export interface EmailSignature {
  enabled: boolean;
  fullName: string;
  title: string;
  phone: string;
  bookingUrl: string;
  bookingLabel: string; // ex. "Book a call with me"
  languages: string;    // ex. "FR/EN/IT"
  showLogo: boolean;    // wordmark COACHELLO
  image: string;        // photo perso, data URL (data:image/...;base64,...) ou ""
  imagePosition: ImagePosition; // au-dessus ou en dessous du texte
}

export const EMPTY_SIGNATURE: EmailSignature = {
  enabled: false,
  fullName: "",
  title: "",
  phone: "",
  bookingUrl: "",
  bookingLabel: "Book a call with me",
  languages: "",
  showLogo: true,
  image: "",
  imagePosition: "above",
};

// Garde-fou : n'accepte qu'une data URL image raisonnable (limite ~1 Mo binaire).
const MAX_IMAGE_DATAURL_LEN = 1_400_000;
export function sanitizeImageDataUrl(v: unknown): string {
  const s = (v ?? "").toString();
  if (!/^data:image\/(png|jpe?g|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(s)) return "";
  if (s.length > MAX_IMAGE_DATAURL_LEN) return "";
  return s;
}

export function normalizeSignature(raw: unknown): EmailSignature {
  const s = (raw ?? {}) as Partial<EmailSignature>;
  return {
    enabled: Boolean(s.enabled),
    fullName: (s.fullName ?? "").toString(),
    title: (s.title ?? "").toString(),
    phone: (s.phone ?? "").toString(),
    bookingUrl: (s.bookingUrl ?? "").toString(),
    bookingLabel: (s.bookingLabel ?? "").toString() || "Book a call with me",
    languages: (s.languages ?? "").toString(),
    showLogo: s.showLogo === undefined ? true : Boolean(s.showLogo),
    image: sanitizeImageDataUrl(s.image),
    imagePosition: s.imagePosition === "below" ? "below" : "above",
  };
}

/** Vrai s'il y a au moins un contenu à afficher (hors flag enabled). */
export function signatureHasContent(s: EmailSignature): boolean {
  return Boolean(s.fullName || s.title || s.phone || s.bookingUrl || s.languages || s.showLogo || s.image);
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// N'autorise que des URLs sûres pour un lien email (http/https/mailto/tel).
function safeUrl(url: string): string | null {
  const u = url.trim();
  if (!u) return null;
  if (/^(https?:|mailto:|tel:)/i.test(u)) return u;
  if (/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(u)) return `https://${u}`; // "calendly.com/..." → https
  return null;
}

/**
 * Rendu HTML de la signature (inline styles, compatible clients mail). "" si vide.
 * `opts.imageSrc` surcharge la source de l'image : data URL pour la preview navigateur,
 * `cid:...` à l'envoi (image embarquée en pièce jointe inline). Si absent, on utilise
 * la data URL stockée (utile pour la preview).
 */
export function renderSignatureHtml(
  sig: EmailSignature | null | undefined,
  opts?: { imageSrc?: string },
): string {
  if (!sig) return "";
  const s = normalizeSignature(sig);
  if (!signatureHasContent(s)) return "";

  // Bloc image (photo perso), placé au-dessus ou en dessous du texte.
  const rawImg = opts?.imageSrc ?? s.image;
  const imgSrc = rawImg && /^(data:image\/|cid:)/i.test(rawImg) ? rawImg : "";
  const imageBlock = imgSrc
    ? `<div style="margin:2px 0 8px;"><img src="${escapeHtml(imgSrc)}" alt="" style="display:block;max-width:200px;height:auto;border:0;" /></div>`
    : "";

  const lines: string[] = [];

  // Séparateur "--" (convention signature)
  lines.push('<div style="color:#9aa0a6;font-size:13px;line-height:1.4;">--</div>');

  if (s.showLogo) {
    lines.push(
      '<div style="font-weight:800;font-size:20px;letter-spacing:0.5px;margin:6px 0 4px;">' +
        '<span style="color:#1a1a1a;">COACHE</span><span style="color:#c9a26b;">LLO</span>' +
        "</div>",
    );
  }

  const nameLine = [s.fullName, s.title].filter(Boolean).map(escapeHtml).join(" | ");
  if (nameLine) {
    lines.push(`<div style="font-weight:700;color:#1a1a1a;margin-bottom:1px;">${nameLine}</div>`);
  }

  // Ligne lien de réservation + langues
  const linkParts: string[] = [];
  const url = safeUrl(s.bookingUrl);
  if (url) {
    const label = escapeHtml(s.bookingLabel || "Book a call with me");
    linkParts.push(`<a href="${escapeHtml(url)}" style="color:#2563eb;text-decoration:underline;">${label}</a>`);
  } else if (s.bookingLabel && s.bookingUrl) {
    // URL invalide mais texte fourni : on affiche le texte brut
    linkParts.push(escapeHtml(s.bookingLabel));
  }
  if (s.languages) linkParts.push(`<span style="color:#5f6368;">${escapeHtml(s.languages)}</span>`);
  if (linkParts.length) {
    lines.push(`<div>${linkParts.join('<span style="color:#9aa0a6;"> | </span>')}</div>`);
  }

  if (s.phone) {
    lines.push(`<div style="color:#1a1a1a;">${escapeHtml(s.phone)}</div>`);
  }

  const ordered = s.imagePosition === "above" ? [imageBlock, ...lines] : [...lines, imageBlock];

  return (
    '<div style="margin-top:18px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:#1a1a1a;">' +
    ordered.filter(Boolean).join("") +
    "</div>"
  );
}

/** Rendu texte brut (partie text/plain du mail). "" si vide. */
export function renderSignaturePlain(sig: EmailSignature | null | undefined): string {
  if (!sig) return "";
  const s = normalizeSignature(sig);
  if (!signatureHasContent(s)) return "";

  const lines: string[] = ["--"];
  if (s.showLogo) lines.push("COACHELLO");
  const nameLine = [s.fullName, s.title].filter(Boolean).join(" | ");
  if (nameLine) lines.push(nameLine);

  const url = safeUrl(s.bookingUrl);
  if (url) lines.push(`${s.bookingLabel || "Book a call with me"}: ${url}`);
  if (s.languages) lines.push(s.languages);
  if (s.phone) lines.push(s.phone);

  return lines.join("\n");
}
