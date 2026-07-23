// ────────────────────────────────────────────────────────────────────────
// Ingestion du revenu facturé + objectifs par AE depuis le Google Drive
// "Dashboard revenue 2026 .xlsx" (source de vérité business, pas HubSpot).
//
// Le montant des deals HubSpot est peu fiable : le "facturé" du Sheet est la
// vraie donnée. On lit via l'OAuth Google existant (GOOGLE_DRIVE_REFRESH_TOKEN),
// download Drive + parsing xlsx (lib `xlsx` déjà installée), même pattern que
// lib/billing/google-sheet.ts.
//
// Parsing par LIBELLÉS de tables (jamais par coordonnées de cellules) pour
// survivre aux changements de mise en page. Best-effort : si l'env manque, si
// Drive est down ou si le format a bougé, on renvoie { ok:false } sans throw.
// ────────────────────────────────────────────────────────────────────────

import * as XLSX from "xlsx";

// Fichier "Dashboard revenue 2026 .xlsx" (partagé, mis à jour en continu).
// Surchargagle via env si le fichier de référence change.
const DEFAULT_FILE_ID = "1zjB-phoCampmQOFNwwiYnw6jwjvrfwmb";

export type RevenueQuarterRaw = {
  quarter: "Q1" | "Q2" | "Q3" | "Q4";
  newTarget: number | null;
  newBilled: number | null;
};

export type RepRevenue = {
  newTarget: number | null;
  newBilled: number | null;
  renewTarget: number | null;
  renewBilled: number | null;
  quarters: RevenueQuarterRaw[];
};

export type RevenueSheet = {
  ok: boolean;
  byRep: Map<string, RepRevenue>; // clé = prénom normalisé
};

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

// "400,000 €" / "€0" / 0 / "" → nombre (ou null).
function parseAmount(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== "string") return null;
  const cleaned = raw.replace(/[€\s ]/g, "").replace(/,/g, "").replace(/[^\d.-]/g, "");
  if (cleaned === "" || cleaned === "-") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

// Normalise une cellule texte : sans accents, minuscule, espaces compactés.
function norm(v: unknown): string {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// Clé rep = prénom normalisé (le Sheet utilise les prénoms : "Baptiste",
// "Mehdi"…). On matche donc sur le 1er token du nom SalesOS.
export function repKeyFromName(name: string | null | undefined): string {
  const first = norm(name).split(" ")[0] ?? "";
  return first;
}

type Grid = unknown[][];

function sheetGrid(wb: XLSX.WorkBook, name: string): Grid {
  const sheet = wb.Sheets[name];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false }) as Grid;
}

// Ligne "TOTAL" ou vide → fin d'un bloc AE.
function isRepRowEnd(cell: unknown): boolean {
  const n = norm(cell);
  return n === "" || n === "total";
}

// ── Parse l'onglet "Suivi New" : NEW target/billed + par trimestre, par AE ──
function parseNew(wb: XLSX.WorkBook, byRep: Map<string, RepRevenue>): boolean {
  for (const sheetName of wb.SheetNames) {
    const grid = sheetGrid(wb, sheetName);
    // En-tête = ligne contenant "AE" ET un libellé "objectif new".
    const headerIdx = grid.findIndex(
      (r) => Array.isArray(r) && r.some((c) => norm(c) === "ae") && r.some((c) => norm(c).includes("objectif new")),
    );
    if (headerIdx === -1) continue;

    const header = grid[headerIdx].map((c) => norm(c));
    const aeCol = header.findIndex((h) => h === "ae");
    const newTargetCol = header.findIndex((h) => h.includes("objectif new"));
    const newBilledCol = header.findIndex((h) => h.includes("new facture"));
    const objQ: Record<number, number> = {};
    const facQ: Record<number, number> = {};
    header.forEach((h, i) => {
      const mo = /^obj q([1-4])/.exec(h);
      if (mo) objQ[Number(mo[1])] = i;
      const mf = /^facture q([1-4])/.exec(h);
      if (mf) facQ[Number(mf[1])] = i;
    });

    for (let i = headerIdx + 1; i < grid.length; i++) {
      const r = grid[i];
      if (!Array.isArray(r)) continue;
      if (isRepRowEnd(r[aeCol])) break;
      const key = repKeyFromName(String(r[aeCol]));
      if (!key) continue;
      const quarters: RevenueQuarterRaw[] = ([1, 2, 3, 4] as const).map((q) => ({
        quarter: `Q${q}` as RevenueQuarterRaw["quarter"],
        newTarget: objQ[q] != null ? parseAmount(r[objQ[q]]) : null,
        newBilled: facQ[q] != null ? parseAmount(r[facQ[q]]) : null,
      }));
      const existing = byRep.get(key) ?? emptyRepRevenue();
      existing.newTarget = newTargetCol >= 0 ? parseAmount(r[newTargetCol]) : null;
      existing.newBilled = newBilledCol >= 0 ? parseAmount(r[newBilledCol]) : null;
      existing.quarters = quarters;
      byRep.set(key, existing);
    }
    return true;
  }
  return false;
}

// ── Parse le bloc "RENEW / SALES" (onglet Dashboard) : renew target/billed ──
function parseRenew(wb: XLSX.WorkBook, byRep: Map<string, RepRevenue>): void {
  for (const sheetName of wb.SheetNames) {
    const grid = sheetGrid(wb, sheetName);
    for (let r = 0; r < grid.length; r++) {
      const row = grid[r];
      if (!Array.isArray(row)) continue;
      const markerCol = row.findIndex((c) => norm(c).replace(/ /g, "") === "renew/sales");
      if (markerCol === -1) continue;

      // En-tête AE/Target/Facturé dans les ~4 lignes suivantes, colonnes >= markerCol-1.
      for (let h = r; h <= r + 4 && h < grid.length; h++) {
        const hr = grid[h];
        if (!Array.isArray(hr)) continue;
        const aeCol = hr.findIndex((c, i) => i >= markerCol - 1 && norm(c) === "ae");
        const targetCol = hr.findIndex((c, i) => i >= markerCol - 1 && norm(c) === "target");
        const billedCol = hr.findIndex((c, i) => i >= markerCol - 1 && norm(c) === "facture");
        if (aeCol === -1 || targetCol === -1 || billedCol === -1) continue;
        for (let i = h + 1; i < grid.length; i++) {
          const rr = grid[i];
          if (!Array.isArray(rr)) continue;
          if (isRepRowEnd(rr[aeCol])) break;
          const key = repKeyFromName(String(rr[aeCol]));
          if (!key) continue;
          const existing = byRep.get(key) ?? emptyRepRevenue();
          existing.renewTarget = parseAmount(rr[targetCol]);
          existing.renewBilled = parseAmount(rr[billedCol]);
          byRep.set(key, existing);
        }
        return; // bloc renew traité
      }
    }
  }
}

function emptyRepRevenue(): RepRevenue {
  return { newTarget: null, newBilled: null, renewTarget: null, renewBilled: null, quarters: [] };
}

export async function fetchRevenueSheet(): Promise<RevenueSheet> {
  const fileId = process.env.AE_REVENUE_DRIVE_FILE_ID || DEFAULT_FILE_ID;
  const byRep = new Map<string, RepRevenue>();
  try {
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
    const wb = XLSX.read(buf, { type: "buffer" });
    const okNew = parseNew(wb, byRep);
    parseRenew(wb, byRep); // best-effort, ne bloque pas
    return { ok: okNew && byRep.size > 0, byRep };
  } catch (e) {
    console.warn("[ae-activity] revenue sheet failed:", e instanceof Error ? e.message : e);
    return { ok: false, byRep };
  }
}
