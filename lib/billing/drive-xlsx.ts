// ────────────────────────────────────────────────────────────────────────
// Helper partagé : télécharge un classeur Google Drive (.xlsx) via l'OAuth
// Google existant (GOOGLE_DRIVE_REFRESH_TOKEN) et le parse avec la lib `xlsx`.
//
// Factorise le pattern autrefois dupliqué dans lib/billing/google-sheet.ts et
// lib/ae-activity/revenue-sheet.ts. Best-effort : throw sur erreur réseau/env,
// les appelants catchent et renvoient un état vide plutôt que de casser la
// réponse.
// ────────────────────────────────────────────────────────────────────────

import * as XLSX from "xlsx";

let _driveAccessToken: string | null = null;
let _driveTokenExpiry = 0;

async function getDriveAccessToken(): Promise<string> {
  if (_driveAccessToken && Date.now() < _driveTokenExpiry) return _driveAccessToken;
  const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;
  if (!refreshToken) throw new Error("GOOGLE_DRIVE_REFRESH_TOKEN manquant");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Refresh token Drive échoué (${res.status}): ${errBody.slice(0, 120)}`);
  }
  const { access_token, expires_in } = await res.json();
  _driveAccessToken = access_token;
  _driveTokenExpiry = Date.now() + ((expires_in ?? 3600) - 60) * 1000;
  return access_token;
}

/** Télécharge un fichier Drive par son id et le parse comme classeur xlsx. */
export async function downloadWorkbook(fileId: string): Promise<XLSX.WorkBook> {
  const token = await getDriveAccessToken();
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Drive download ${res.status}: ${t.slice(0, 120)}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  return XLSX.read(buf, { type: "buffer" });
}

/** Grille [ligne][colonne] d'un onglet (header:1, lignes vides ignorées). */
export function sheetGrid(wb: XLSX.WorkBook, name: string): unknown[][] {
  const sheet = wb.Sheets[name];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false }) as unknown[][];
}

/** "€511,165" / "813,850€" / "-63,072 €" / 0 / "" → nombre (ou null). Retire
 *  €, espaces (y compris insécables/fines) et séparateurs de milliers. */
export function parseAmount(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== "string") return null;
  const cleaned = raw
    .replace(/[€\s  ]/g, "")
    .replace(/,/g, "")
    .replace(/[^\d.-]/g, "");
  if (cleaned === "" || cleaned === "-") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** "92.3%" → 0.923 ; un nombre déjà fractionnaire (0.923) est renvoyé tel quel ;
 *  "?" / "" / "-" → null. */
export function parsePercent(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== "string") return null;
  const s = raw.replace(/[%\s  ]/g, "").replace(/,/g, ".");
  if (s === "" || s === "-" || s === "?") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n / 100 : null;
}

/** Normalise une cellule texte : sans accents, minuscule, espaces compactés. */
export function norm(v: unknown): string {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
