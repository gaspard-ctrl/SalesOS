export type TargetField = "name" | "owner" | "sector" | "current_coaching_platform" | "notes";

export type ColumnMapping = Record<TargetField, number>;

export const TARGET_FIELDS: { key: TargetField; label: string; required: boolean }[] = [
  { key: "name", label: "Entreprise", required: true },
  { key: "owner", label: "Owner", required: false },
  { key: "sector", label: "Secteur", required: false },
  { key: "current_coaching_platform", label: "Plateforme coaching", required: false },
  { key: "notes", label: "Notes", required: false },
];

export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") {
        out.push(cur);
        cur = "";
      } else cur += ch;
    }
  }
  out.push(cur);
  return out;
}

export function parseCsvAll(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/);
  let headers: string[] = [];
  const rows: string[][] = [];
  let headerSet = false;
  for (const raw of lines) {
    if (!raw.trim()) continue;
    const cells = splitCsvLine(raw);
    if (!headerSet) {
      headers = cells.map((c) => c.trim());
      headerSet = true;
    } else {
      rows.push(cells);
    }
  }
  return { headers, rows };
}

export function autoDetectMapping(headers: string[]): ColumnMapping {
  const lower = headers.map((h) => h.toLowerCase());
  const find = (...candidates: string[]): number => lower.findIndex((c) => candidates.includes(c));
  return {
    name: find("name", "company", "entreprise", "société", "societe"),
    owner: find("owner", "propriétaire", "proprietaire", "responsable"),
    sector: find("sector", "secteur", "industry", "industrie"),
    current_coaching_platform: find(
      "current_coaching_platform",
      "coaching_platform",
      "plateforme",
      "plateforme_coaching",
      "platform",
      "coaching platform",
      "plateforme de coaching",
      "plateforme coaching"
    ),
    notes: find("notes", "note", "commentaire", "commentaires"),
  };
}

export function rewriteCsvWithMapping(
  rows: string[][],
  mapping: ColumnMapping,
  defaultOwner: string | null
): string {
  const escape = (v: string): string => {
    if (/[",\r\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
    return v;
  };
  const fallbackOwner = (defaultOwner ?? "").trim();
  const header = "name,owner,sector,current_coaching_platform,notes";
  const body = rows.map((cells) => {
    const get = (idx: number) => (idx >= 0 ? (cells[idx] ?? "").trim() : "");
    const ownerFromCsv = get(mapping.owner);
    const owner = ownerFromCsv || fallbackOwner;
    return [
      escape(get(mapping.name)),
      escape(owner),
      escape(get(mapping.sector)),
      escape(get(mapping.current_coaching_platform)),
      escape(get(mapping.notes)),
    ].join(",");
  });
  return [header, ...body].join("\n");
}
