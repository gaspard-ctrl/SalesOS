import type { DealScore } from "@/lib/deal-scoring";

export interface Deal {
  id: string;
  dealname: string;
  dealstage: string;
  amount: string;
  closedate: string;
  createdate: string;
  probability: string;
  ownerId: string;
  ownerName: string;
  lastContacted: string;
  lastModified: string;
  numContacts: number;
  dealType: string;
  score: DealScore | null;
  reasoning: string | null;
  next_action: string | null;
  scoredAt: string | null;
  qualification: Record<string, string | null> | null;
}

export interface DealDetails extends Deal {
  description: string;
  contacts: { id: string; name: string; jobTitle: string; email: string; linkedinUrl: string | null }[];
  company: { name: string; industry: string; employees: string; website: string };
  engagements: { type: string; date: string; body: string }[];
  reasoning: string | null;
  next_action: string | null;
  scoredAt: string | null;
  qualification: Record<string, string | null> | null;
}

export interface Stage {
  id: string;
  label: string;
  order: number;
  probability: number | null;
}

export interface Analysis {
  synthese: string;
  riskLevel: "Faible" | "Moyen" | "Élevé";
  dynamique: { momentum: string; analyse: string };
  qualification: { budget: string; authority: string; need: string; timeline: string; fit: string };
  signaux: { positifs: string[]; negatifs: string[] };
  risques: { risque: string; severite: "Faible" | "Moyen" | "Élevé" }[];
  scoreInsight: string;
  prochaines_etapes: { action: string; priorite: "Urgent" | "Moyen" | "Faible"; impact: string }[];
  // legacy compat
  summary?: string;
  positiveSignals?: string[];
  negativeSignals?: string[];
  nextSteps?: string[];
  scoringInsight?: string;
}

export const STAGE_COLORS = ["#3b82f6", "#7c3aed", "#f97316", "#f01563", "#d97706", "#16a34a", "#6b7280", "#0891b2", "#be185d"];

export function stageColor(index: number): string {
  return STAGE_COLORS[index % STAGE_COLORS.length];
}

export function fmt(amount: string): string {
  const n = parseFloat(amount);
  if (isNaN(n)) return "—";
  return n >= 1000 ? `${(n / 1000).toFixed(0)}k€` : `${n.toFixed(0)}€`;
}

export function fmtDate(dateStr: string): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

export function timeAgo(dateStr: string): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 864e5);
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return "Hier";
  if (days < 7) return `Il y a ${days}j`;
  if (days < 30) return `Il y a ${Math.floor(days / 7)}sem`;
  return `Il y a ${Math.floor(days / 30)}mois`;
}

export function engagementTypeBadge(type: string): string {
  const map: Record<string, string> = {
    EMAIL: "Email",
    CALL: "Appel",
    MEETING: "Réunion",
    NOTE: "Note",
    TASK: "Tâche",
  };
  return map[type?.toUpperCase()] ?? type;
}

export function formatDealForSlack(
  details: DealDetails,
  stageLabel: string,
  score: DealScore | null,
  reasoning: string | null,
  nextAction: string | null,
  qualification: Record<string, string | null> | null
): string {
  const lines: string[] = [
    `*Deal — ${details.dealname}*`,
    "",
    `*Stage :* ${stageLabel}`,
  ];
  if (details.amount) lines.push(`*Montant :* ${parseFloat(details.amount).toLocaleString("fr-FR")}€`);
  if (details.closedate) lines.push(`*Clôture :* ${new Date(details.closedate).toLocaleDateString("fr-FR")}`);
  if (details.ownerName) lines.push(`*Owner :* ${details.ownerName}`);

  if (score) {
    lines.push("", `*Score :* ${score.total}/100`);
    if (score.components?.length) {
      lines.push(...score.components.map((c) => `  • ${c.name} : ${c.earned}/${c.max}`));
    }
  }

  if (reasoning) lines.push("", `*Analyse :*`, reasoning);
  if (nextAction) lines.push("", `*Prochaine action :* ${nextAction}`);

  if (qualification) {
    const QUAL_LABELS: Record<string, string> = {
      budget: "Budget",
      estimatedBudget: "Budget estimé",
      authority: "Autorité",
      need: "Besoin",
      champion: "Champion",
      needDetailed: "Besoin détaillé",
      timeline: "Timeline",
      strategicFit: "Fit stratégique",
    };
    const entries = Object.entries(qualification).filter(([, v]) => !!v);
    if (entries.length > 0) {
      lines.push("", `*Qualification :*`);
      entries.forEach(([k, v]) => {
        lines.push(`  • ${QUAL_LABELS[k] ?? k} : ${v}`);
      });
    }
  }

  if (details.company?.name) {
    const cp = details.company;
    const companyParts = [
      cp.name,
      cp.industry ? `Secteur : ${cp.industry}` : null,
      cp.employees ? `Effectifs : ${cp.employees}` : null,
    ].filter(Boolean);
    lines.push("", `*Entreprise :*`, ...companyParts.map((p) => `  • ${p}`));
  }

  if (details.contacts?.length > 0) {
    lines.push("", `*Contacts :*`);
    details.contacts.forEach((c) => {
      const parts = [c.name, c.jobTitle, c.email].filter(Boolean);
      lines.push(`  • ${parts.join(" — ")}`);
    });
  }

  return lines.join("\n");
}
