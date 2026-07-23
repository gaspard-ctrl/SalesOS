// ────────────────────────────────────────────────────────────────────────
// Lecture des KPIs finance AGRÉGÉS (niveau société) depuis le classeur
// "Dashboard revenue 2026 .xlsx" (Google Drive), en temps réel.
//
// Deux onglets :
//   - "Revenue par Trimestre" : CA facturé vs target (total + par trimestre) +
//     split renew/new + YoY. Onglet propre et bien structuré → source primaire.
//   - "Dashboard" (bloc METRICS) : metrics pluriannuelles (revenue+YoY, nb
//     clients, panier moyen, RFP), churn, repeat, revenue par type, SaaS, LTV.
//
// Parsing par LIBELLÉS / ancres d'années (jamais par coordonnées fixes) pour
// survivre aux changements de mise en page. Best-effort : renvoie null sur toute
// cellule absente/illisible, ne throw jamais vers l'appelant (le tool catche).
//
// À éviter (cassés à la source) : onglet "Sheet1" (#VALUE!) et le mini-tableau
// "TOP 10 CLIENTS 2026" du Dashboard (colonne noms en #VALUE!) → non lus ici.
//
// ── Valeurs de référence au 2026-07-21 (pour valider le parsing après déploiement) :
//   total_2026 = { billed: 1 631 263, target: 4 013 150, pct: 0.406 }
//   renew = { 860 011, 2 163 150, 0.398 }   new = { 771 252, 1 850 000, 0.417 }
//   Q1 = { billed 750 778, target 813 850, pct 0.923, gap -63 072, cumul 750 778 }
//   churn = { clients 0.2174, revenue 0.1522 }   ltv = { all 181 226, rfp 644 209 }
//   2026 (YTD) metrics = { revenue 1 631 263, clients 39, panier_moyen 41 827 }
//   cac / ltv_cac = null (vides "?" à la source)
// ────────────────────────────────────────────────────────────────────────

import { downloadWorkbook, sheetGrid, parseAmount, parsePercent, norm } from "./drive-xlsx";

const DEFAULT_FILE_ID = "1zjB-phoCampmQOFNwwiYnw6jwjvrfwmb";
const TRIMESTRE_TAB = "Revenue par Trimestre";
const DASHBOARD_TAB = "Dashboard";

type Row = unknown[];

export type PerfBlock = { billed: number | null; target: number | null; pct: number | null };

export type QuarterKpi = {
  quarter: "Q1" | "Q2" | "Q3" | "Q4";
  billed: number | null;
  target: number | null;
  pct: number | null;
  gap: number | null;
  cumulative: number | null;
};

export type YearMetric = {
  year: string;
  revenue: number | null;
  revenue_yoy: number | null;
  clients: number | null;
  panier_moyen: number | null;
  panier_moyen_over_10k: number | null;
  rfp_revenue: number | null;
  rfp_share_of_total: number | null;
  rfp_count: number | null;
  rfp_panier_moyen: number | null;
};

export type RevenueByType = { year: string; human: number | null; ai: number | null; hybrid: number | null };
export type RevenueSaaS = { year: string; saas: number | null; total: number | null; pct: number | null };

export type RevenueKpis = {
  ok: boolean;
  source: string;
  year: number;
  total_2026: PerfBlock;
  renew: PerfBlock;
  new: PerfBlock;
  quarters: QuarterKpi[];
  total_2025: number | null;
  yoy_2026: number | null;
  metrics_by_year: YearMetric[];
  churn: { clients: number | null; revenue: number | null };
  new_over_total: number | null;
  repeat_25_26: number | null;
  revenue_by_type: RevenueByType[];
  revenue_saas: RevenueSaaS[];
  ltv: { all: number | null; rfp: number | null };
  cac: number | null;
  ltv_cac: number | null;
};

function findCol(row: Row, pred: (n: string) => boolean): number {
  return row.findIndex((c) => pred(norm(c)));
}
function hasCol(row: Row, pred: (n: string) => boolean): boolean {
  return row.some((c) => pred(norm(c)));
}
const isYear = (v: unknown) => /^20\d\d/.test(norm(v));

// ── Onglet "Revenue par Trimestre" : totaux + par trimestre + renew/new ──
function parseTrimestre(grid: Row[]): Pick<
  RevenueKpis,
  "total_2026" | "renew" | "new" | "quarters" | "total_2025" | "yoy_2026"
> {
  const empty = (): PerfBlock => ({ billed: null, target: null, pct: null });
  const out = {
    total_2026: empty(),
    renew: empty(),
    new: empty(),
    quarters: [] as QuarterKpi[],
    total_2025: null as number | null,
    yoy_2026: null as number | null,
  };

  // Tableau par trimestre : Période | Facturé | Target | % Atteinte | Écart | Cumul
  const hIdx = grid.findIndex(
    (r) =>
      Array.isArray(r) &&
      hasCol(r, (n) => n === "periode") &&
      hasCol(r, (n) => n === "facture") &&
      hasCol(r, (n) => n === "target"),
  );
  if (hIdx !== -1) {
    const h = grid[hIdx];
    const periodeCol = findCol(h, (n) => n === "periode");
    const billedCol = findCol(h, (n) => n === "facture");
    const targetCol = findCol(h, (n) => n === "target");
    const pctCol = findCol(h, (n) => n.includes("atteinte"));
    const gapCol = findCol(h, (n) => n === "ecart");
    const cumulCol = findCol(h, (n) => n.includes("cumul"));
    for (let i = hIdx + 1; i < grid.length; i++) {
      const r = grid[i];
      if (!Array.isArray(r)) continue;
      const label = norm(r[periodeCol]);
      const mq = /^2026 q([1-4])/.exec(label);
      if (mq) {
        out.quarters.push({
          quarter: `Q${mq[1]}` as QuarterKpi["quarter"],
          billed: parseAmount(r[billedCol]),
          target: parseAmount(r[targetCol]),
          pct: pctCol >= 0 ? parsePercent(r[pctCol]) : null,
          gap: gapCol >= 0 ? parseAmount(r[gapCol]) : null,
          cumulative: cumulCol >= 0 ? parseAmount(r[cumulCol]) : null,
        });
      } else if (label === "2026 total") {
        out.total_2026 = {
          billed: parseAmount(r[billedCol]),
          target: parseAmount(r[targetCol]),
          pct: pctCol >= 0 ? parsePercent(r[pctCol]) : null,
        };
      } else if (label === "2025 total") {
        out.total_2025 = parseAmount(r[billedCol]);
      } else if (label.startsWith("croissance yoy")) {
        out.yoy_2026 = parsePercent(r[billedCol]);
      } else if (label.startsWith("par type de revenue")) {
        break;
      }
    }
  }

  // Tableau "PAR TYPE DE REVENUE" : Type | Facturé 2026 | Target 2026 | % Atteinte
  const tIdx = grid.findIndex(
    (r) => Array.isArray(r) && hasCol(r, (n) => n === "type") && hasCol(r, (n) => n.includes("facture 2026")),
  );
  if (tIdx !== -1) {
    const h = grid[tIdx];
    const typeCol = findCol(h, (n) => n === "type");
    const billedCol = findCol(h, (n) => n.includes("facture 2026"));
    const targetCol = findCol(h, (n) => n.includes("target 2026"));
    const pctCol = findCol(h, (n) => n.includes("atteinte"));
    for (let i = tIdx + 1; i < grid.length; i++) {
      const r = grid[i];
      if (!Array.isArray(r)) continue;
      const label = norm(r[typeCol]);
      const block: PerfBlock = {
        billed: parseAmount(r[billedCol]),
        target: parseAmount(r[targetCol]),
        pct: pctCol >= 0 ? parsePercent(r[pctCol]) : null,
      };
      if (label === "renew") out.renew = block;
      else if (label === "new") out.new = block;
      else if (label === "total") {
        if (out.total_2026.billed == null) out.total_2026 = block;
      }
    }
  }

  return out;
}

// ── Dashboard, bloc METRICS par année (ancrage sur le token d'année répété) ──
function parseMetricsByYear(grid: Row[]): YearMetric[] {
  const out: YearMetric[] = [];
  for (const r of grid) {
    if (!Array.isArray(r)) continue;
    const anchors: number[] = [];
    r.forEach((c, idx) => {
      if (isYear(c)) anchors.push(idx);
    });
    // Une ligne de metrics annuelles porte 5 bandes (Revenue, N° clients,
    // Panier moyen, Panier >10k, RFP), chacune préfixée par l'année.
    if (anchors.length < 5) continue;
    const [b0, b1, b2, b3, b4] = anchors;
    out.push({
      year: String(r[b0] ?? "").trim(),
      revenue: parseAmount(r[b0 + 1]),
      revenue_yoy: parsePercent(r[b0 + 2]),
      clients: parseAmount(r[b1 + 1]),
      panier_moyen: parseAmount(r[b2 + 1]),
      panier_moyen_over_10k: parseAmount(r[b3 + 1]),
      rfp_revenue: parseAmount(r[b4 + 1]),
      rfp_share_of_total: parsePercent(r[b4 + 3]),
      rfp_count: parseAmount(r[b4 + 4]),
      rfp_panier_moyen: parseAmount(r[b4 + 5]),
    });
  }
  return out;
}

// ── Dashboard, blocs Churn / New-Total / Repeat / Revenue par type / SaaS / LTV ──
function parseChurnLtv(grid: Row[]): Pick<
  RevenueKpis,
  "churn" | "new_over_total" | "repeat_25_26" | "revenue_by_type" | "revenue_saas" | "ltv" | "cac" | "ltv_cac"
> {
  const res = {
    churn: { clients: null as number | null, revenue: null as number | null },
    new_over_total: null as number | null,
    repeat_25_26: null as number | null,
    revenue_by_type: [] as RevenueByType[],
    revenue_saas: [] as RevenueSaaS[],
    ltv: { all: null as number | null, rfp: null as number | null },
    cac: null as number | null,
    ltv_cac: null as number | null,
  };

  const cIdx = grid.findIndex((r) => Array.isArray(r) && hasCol(r, (n) => n.startsWith("churn")));
  if (cIdx !== -1) {
    const h = grid[cIdx];
    const churnCol = findCol(h, (n) => n.startsWith("churn"));
    const newTotalCol = findCol(h, (n) => n.replace(/ /g, "") === "new/total");
    const repeatCol = findCol(h, (n) => n.startsWith("repeat"));
    const typeCol = findCol(h, (n) => n.startsWith("revenue per type"));
    const saasCol = findCol(h, (n) => n.startsWith("revenue saas"));

    const clientsRow = grid[cIdx + 1]; // "Clients" : churn clients + new/total + repeat
    if (Array.isArray(clientsRow)) {
      if (churnCol >= 0) res.churn.clients = parsePercent(clientsRow[churnCol + 1]);
      if (newTotalCol >= 0) res.new_over_total = parsePercent(clientsRow[newTotalCol]);
      if (repeatCol >= 0) res.repeat_25_26 = parsePercent(clientsRow[repeatCol]);
    }
    const revenueRow = grid[cIdx + 2]; // "Revenue" : churn revenue
    if (Array.isArray(revenueRow) && churnCol >= 0) {
      res.churn.revenue = parsePercent(revenueRow[churnCol + 1]);
    }

    // Sous-tables revenue par type / SaaS : lignes années en cIdx+2 et cIdx+3.
    for (let i = cIdx + 2; i <= cIdx + 3 && i < grid.length; i++) {
      const r = grid[i];
      if (!Array.isArray(r)) continue;
      if (typeCol >= 0 && isYear(r[typeCol])) {
        res.revenue_by_type.push({
          year: String(r[typeCol] ?? "").trim(),
          human: parseAmount(r[typeCol + 1]),
          ai: parseAmount(r[typeCol + 2]),
          hybrid: parseAmount(r[typeCol + 3]),
        });
      }
      if (saasCol >= 0 && isYear(r[saasCol])) {
        res.revenue_saas.push({
          year: String(r[saasCol] ?? "").trim(),
          saas: parseAmount(r[saasCol + 1]),
          total: parseAmount(r[saasCol + 2]),
          pct: parsePercent(r[saasCol + 3]),
        });
      }
    }
  }

  // LTV | CAC | LTV/CAC : lignes "All" et "RFP" sous l'en-tête. CAC & LTV/CAC
  // valent "?" à la source → parseAmount renvoie null (jamais inventé).
  const lIdx = grid.findIndex((r) => Array.isArray(r) && r.some((c) => norm(c) === "ltv"));
  if (lIdx !== -1) {
    const ltvCol = findCol(grid[lIdx], (n) => n === "ltv");
    const allRow = grid[lIdx + 1];
    const rfpRow = grid[lIdx + 2];
    if (Array.isArray(allRow) && ltvCol >= 0) res.ltv.all = parseAmount(allRow[ltvCol + 1]);
    if (Array.isArray(rfpRow) && ltvCol >= 0) res.ltv.rfp = parseAmount(rfpRow[ltvCol + 1]);
  }

  return res;
}

export async function fetchRevenueKpis(): Promise<RevenueKpis> {
  const fileId = process.env.AE_REVENUE_DRIVE_FILE_ID || DEFAULT_FILE_ID;
  const base: RevenueKpis = {
    ok: false,
    source: "sheet revenue (Dashboard + Revenue par Trimestre)",
    year: new Date().getFullYear(),
    total_2026: { billed: null, target: null, pct: null },
    renew: { billed: null, target: null, pct: null },
    new: { billed: null, target: null, pct: null },
    quarters: [],
    total_2025: null,
    yoy_2026: null,
    metrics_by_year: [],
    churn: { clients: null, revenue: null },
    new_over_total: null,
    repeat_25_26: null,
    revenue_by_type: [],
    revenue_saas: [],
    ltv: { all: null, rfp: null },
    cac: null,
    ltv_cac: null,
  };

  try {
    const wb = await downloadWorkbook(fileId);
    const trim = parseTrimestre(sheetGrid(wb, TRIMESTRE_TAB));
    base.total_2026 = trim.total_2026;
    base.renew = trim.renew;
    base.new = trim.new;
    base.quarters = trim.quarters;
    base.total_2025 = trim.total_2025;
    base.yoy_2026 = trim.yoy_2026;

    const dash = sheetGrid(wb, DASHBOARD_TAB);
    base.metrics_by_year = parseMetricsByYear(dash);
    const cl = parseChurnLtv(dash);
    base.churn = cl.churn;
    base.new_over_total = cl.new_over_total;
    base.repeat_25_26 = cl.repeat_25_26;
    base.revenue_by_type = cl.revenue_by_type;
    base.revenue_saas = cl.revenue_saas;
    base.ltv = cl.ltv;
    base.cac = cl.cac;
    base.ltv_cac = cl.ltv_cac;

    base.ok = base.total_2026.billed != null || base.metrics_by_year.length > 0;
    return base;
  } catch (e) {
    console.warn("[revenue-kpis] fetch failed:", e instanceof Error ? e.message : e);
    return base;
  }
}
