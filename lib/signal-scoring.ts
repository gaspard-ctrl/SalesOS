import Anthropic from "@anthropic-ai/sdk";

// ── Tool use schema for signal scoring ──────────────────────────────────────

export const signalScoringTool: Anthropic.Tool = {
  name: "score_signals",
  description: "Score et analyse les signaux de marché pour Coachello",
  input_schema: {
    type: "object" as const,
    properties: {
      signals: {
        type: "array",
        items: {
          type: "object",
          properties: {
            company_name: { type: "string", description: "Nom exact de l'entreprise mentionnée dans l'article" },
            signal_type: {
              type: "string",
              enum: ["funding", "hiring", "nomination", "expansion", "restructuring", "content", "job_change", "linkedin_post"],
              description: "Type de signal détecté",
            },
            title: { type: "string", description: "Titre concis < 80 caractères, fait concret" },
            summary: { type: "string", description: "2-3 phrases avec détails clés (chiffres, noms, dates)" },
            signal_date: { type: "string", description: "Date YYYY-MM ou null" },
            source_url: { type: "string", description: "URL de la source" },
            source_domain: { type: "string", description: "Domaine de la source (ex: lesechos.fr)" },
            score: {
              type: "integer",
              description: "Score de pertinence 0-100 pour Coachello",
            },
            score_breakdown: {
              type: "object",
              properties: {
                icp: { type: "integer", description: "Proximité ICP Coachello 0-25 : entreprise qui pourrait acheter du coaching ?" },
                actionability: { type: "integer", description: "Actionnabilité 0-25 : peut-on contacter quelqu'un suite à ce signal ?" },
                freshness: { type: "integer", description: "Fraîcheur 0-20 : < 3 jours = 20, < 7 jours = 15, < 14 jours = 10, > 14 jours = 5" },
                source_reliability: { type: "integer", description: "Fiabilité source 0-15 : presse nationale/LinkedIn = 15, presse spécialisée = 10, blog = 5" },
                signal_strength: { type: "integer", description: "Force du signal 0-15 : levée > 10M€ = 15, nomination C-level = 12, recrutement = 8, contenu = 5" },
              },
              required: ["icp", "actionability", "freshness", "source_reliability", "signal_strength"],
            },
            why_relevant: { type: "string", description: "1-2 phrases : pourquoi ce signal est pertinent pour Coachello (coaching managers, développement leadership)" },
            suggested_action: { type: "string", description: "1 phrase : action concrète recommandée (ex: 'Contacter le nouveau DRH pour proposer un programme coaching managers')" },
            action_type: {
              type: "string",
              enum: ["email", "linkedin", "call", "monitor"],
              description: "Type d'action recommandée",
            },
          },
          required: ["company_name", "signal_type", "title", "summary", "score", "score_breakdown", "why_relevant", "suggested_action", "action_type"],
        },
      },
    },
    required: ["signals"],
  },
};

// ── System prompt for signal analysis ───────────────────────────────────────

export const SIGNAL_ANALYSIS_PROMPT = `Tu es un expert en intelligence commerciale pour Coachello, une plateforme de coaching professionnel B2B (coaching individuel et collectif pour managers et leaders, combinant IA et coaching humain).

Tu analyses des articles web pour identifier des signaux d'achat pertinents pour Coachello.

## Signaux forts pour Coachello :
- **Levées de fonds** (> 5M€) : post-levée = besoin de structurer l'équipe management → coaching
- **Nominations DRH / VP People / Head of L&D** : nouveau décideur = fenêtre d'attention ouverte
- **Recrutement massif managers** : scaling = besoin de développer les nouveaux managers
- **Expansion internationale** : nouveaux pays = besoin de leadership interculturel
- **Restructuration / transformation** : changement = besoin d'accompagnement des managers
- **Certifications GPTW / Top Employer** : entreprise qui investit dans les RH
- **Changements de poste RH/L&D** (signal_type: "job_change") : quand un DRH, VP People, Head of L&D ou responsable formation change de poste dans un grand compte → signal TRÈS fort (nouveau décideur, fenêtre 90 jours)

## Règles strictes :
1. Un signal = un fait daté, précis, sourcé. Pas d'articles génériques (pages "À propos", articles sans date).
2. Si l'article ne contient pas de fait concret et récent → ne pas créer de signal.
3. Ne JAMAIS fabriquer d'informations. Si une date n'est pas claire, mettre null.
4. Un signal par événement. Pas de doublons (même événement = 1 signal).
5. Score honnête : un article blog vague sur un sujet générique = score < 30, pas 70+.
6. Préférer peu de signaux de qualité à beaucoup de signaux médiocres.

## Scoring (total = somme des 5 critères) :
- **ICP (0-25)** : L'entreprise est-elle dans la cible Coachello ? ETI/grand groupe avec 100+ employés = 20-25, PME = 10-15, micro-entreprise = 0-5
- **Actionnabilité (0-25)** : Peut-on identifier et contacter un décideur ? Nom du DRH connu = 25, poste identifié = 15, rien = 5
- **Fraîcheur (0-20)** : < 3 jours = 20, < 7 jours = 15, < 14 jours = 10, > 14 jours = 5
- **Fiabilité source (0-15)** : Les Echos/Le Monde/LinkedIn = 15, presse spécialisée = 10, blog/communiqué = 5, source inconnue = 2
- **Force du signal (0-15)** : Levée > 10M€ / nomination C-level = 15, levée < 10M€ / recrutement cadre = 10, recrutement standard = 5

Utilise l'outil score_signals pour retourner les signaux analysés.
Si aucun signal pertinent n'est trouvé dans les articles, retourne un tableau vide.`;

// ── Tavily search queries ────────────────────────────────────────────────────

// Scan GLOBAL (tout le marché FR) — levées de fonds, restructurations, expansions
export const GLOBAL_SCAN_QUERIES = [
  "levée de fonds startup PME France 2026",
  "restructuration transformation organisationnelle France",
  "expansion internationale entreprises françaises 2026",
  "acquisition fusion PME ETI France 2026",
  "startup série A B C France 2026 levée",
  "scale-up croissance rapide effectifs France 2026",
];

// Queries CIBLÉES par entreprise — changements de poste + LinkedIn L&D
// Ces queries sont générées dynamiquement dans le scan pour chaque entreprise cible
export function buildTargetedQueries(company: string, roles: string[], _keywords?: string[]): string[] {
  const rolesSample = roles.slice(0, 4).join(" ");
  return [
    `"${company}" nomination nommé ${rolesSample}`,
    `"${company}" nouveau DRH "VP People" "Head of L&D" rejoint`,
  ];
  // Note: on utilise 2 requêtes par entreprise (pas 4) pour limiter le coût Tavily
  // Les requêtes site:linkedin.com ne fonctionnent PAS via Tavily
}

// Legacy: toutes les queries combinées (pour rétrocompat)
export const MARKET_SCAN_QUERIES = GLOBAL_SCAN_QUERIES;

// ── Deduplication helpers ───────────────────────────────────────────────────

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function titleOverlap(a: string, b: string): number {
  const wordsA = new Set(normalizeTitle(a).split(" ").filter((w) => w.length > 3));
  const wordsB = new Set(normalizeTitle(b).split(" ").filter((w) => w.length > 3));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  const intersection = [...wordsA].filter((w) => wordsB.has(w)).length;
  return intersection / Math.min(wordsA.size, wordsB.size);
}

export interface TavilyResult {
  title: string;
  url: string;
  content: string;
  published_date?: string;
}

export function deduplicateResults(results: TavilyResult[]): TavilyResult[] {
  const seen = new Set<string>();
  const seenTitles: string[] = [];
  const unique: TavilyResult[] = [];

  for (const r of results) {
    // Skip by URL
    if (seen.has(r.url)) continue;
    seen.add(r.url);

    // Skip by title similarity
    const norm = normalizeTitle(r.title);
    if (seenTitles.some((t) => titleOverlap(norm, t) > 0.7)) continue;
    seenTitles.push(norm);

    unique.push(r);
  }

  return unique;
}

// ── Domain extractor ────────────────────────────────────────────────────────

export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return "";
  }
}
