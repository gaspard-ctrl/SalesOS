import type { ClientEnrichmentContext } from "./context";
import type { Health, HealthLabel, Insights } from "./types";

// Calcul du health score d'un client. Version v1 sans IA — signaux simples
// extraits du contexte HubSpot + Claap déjà chargé pour l'enrichissement.
// L'objectif est d'avoir un score utile dès maintenant, on raffinera (IA,
// cron mensuel, alertes Slack) dans les itérations suivantes.
//
// Score 0..100 :
//   - 100 = full healthy (engagement régulier, sources fraîches, gros volume)
//   - 60..75 = à surveiller (signal d'engagement décroît)
//   - <50 = risque (silence ou signaux négatifs)
//
// Label dérivé du score :
//   - green ≥ 70
//   - yellow 40..70
//   - red < 40

type SignalContext = ReturnType<typeof extractSignals>;

function daysAgo(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.floor((Date.now() - t) / (24 * 60 * 60 * 1000));
}

function extractSignals(ctx: ClientEnrichmentContext) {
  const engagements = ctx.deal?.engagements ?? [];
  const meetings = ctx.meetings ?? [];

  const lastEngagementDate = engagements
    .map((e) => (e.date ? new Date(e.date).getTime() : null))
    .filter((t): t is number => t !== null && Number.isFinite(t))
    .sort((a, b) => b - a)[0] ?? null;

  const lastMeetingDate = meetings
    .map((m) => (m.meeting_started_at ? new Date(m.meeting_started_at).getTime() : null))
    .filter((t): t is number => t !== null && Number.isFinite(t))
    .sort((a, b) => b - a)[0] ?? null;

  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const meetingsLast90 = meetings.filter((m) => {
    if (!m.meeting_started_at) return false;
    const t = new Date(m.meeting_started_at).getTime();
    return Number.isFinite(t) && now - t <= 90 * day;
  }).length;

  const engagementsLast30 = engagements.filter((e) => {
    if (!e.date) return false;
    const t = new Date(e.date).getTime();
    return Number.isFinite(t) && now - t <= 30 * day;
  }).length;

  return {
    daysSinceLastEngagement: lastEngagementDate ? Math.floor((now - lastEngagementDate) / day) : null,
    daysSinceLastMeeting: lastMeetingDate ? Math.floor((now - lastMeetingDate) / day) : null,
    meetingsLast90,
    engagementsLast30,
    totalMeetings: meetings.length,
    totalEngagements: engagements.length,
    contactsCount: ctx.deal?.contacts?.length ?? 0,
  };
}

function scoreFromSignals(s: SignalContext): { score: number; drivers: string[] } {
  let score = 50; // baseline neutre
  const drivers: string[] = [];

  // ── Dernier contact = min(engagement HubSpot, meeting Claap)
  // Sans ça on rate les meetings post-signature (kickoff, QBR, follow-up CS)
  // qui sont des Claap mais pas forcément des engagements HubSpot sur le deal.
  const candidates = [s.daysSinceLastEngagement, s.daysSinceLastMeeting]
    .filter((d): d is number => d !== null);
  const daysSinceLastContact = candidates.length > 0 ? Math.min(...candidates) : null;

  if (daysSinceLastContact !== null) {
    if (daysSinceLastContact <= 14) {
      score += 20;
      drivers.push(`Contact récent (${daysSinceLastContact}j)`);
    } else if (daysSinceLastContact <= 45) {
      score += 5;
      drivers.push(`Dernier contact il y a ${daysSinceLastContact}j`);
    } else if (daysSinceLastContact <= 90) {
      score -= 10;
      drivers.push(`Silence de ${daysSinceLastContact}j sur le compte`);
    } else {
      score -= 25;
      drivers.push(`Silence prolongé (${daysSinceLastContact}j) — risque élevé`);
    }
  } else {
    score -= 15;
    drivers.push("Aucun engagement ni meeting connu");
  }

  // ── Meetings dans les 90 derniers jours
  if (s.meetingsLast90 >= 3) {
    score += 15;
    drivers.push(`${s.meetingsLast90} meetings sur 90j — engagement soutenu`);
  } else if (s.meetingsLast90 === 2) {
    score += 5;
  } else if (s.meetingsLast90 === 1) {
    score -= 5;
    drivers.push("Un seul meeting analysé sur 90j");
  } else {
    score -= 15;
    drivers.push("Aucun meeting Claap sur les 90 derniers jours");
  }

  // ── Volume d'engagements (proxy d'activité)
  if (s.engagementsLast30 >= 5) {
    score += 10;
    drivers.push(`${s.engagementsLast30} échanges (emails/calls/notes) sur 30j`);
  } else if (s.engagementsLast30 === 0) {
    score -= 5;
  }

  // ── Couverture contacts (champion fragile = peu de contacts mappés)
  if (s.contactsCount === 0) {
    score -= 5;
    drivers.push("Aucun contact HubSpot associé — visibilité limitée");
  } else if (s.contactsCount >= 3) {
    score += 5;
  }

  // Clamp 0..100
  score = Math.max(0, Math.min(100, Math.round(score)));

  // Top 5 drivers max, on les a déjà ajoutés du plus impactant au moins
  // impactant en parcourant le score ci-dessus, donc slice est OK.
  return { score, drivers: drivers.slice(0, 5) };
}

function labelFromScore(score: number): HealthLabel {
  if (score >= 70) return "green";
  if (score >= 40) return "yellow";
  return "red";
}

export function computeHealth(ctx: ClientEnrichmentContext, previousScore: number | null): Health {
  const signals = extractSignals(ctx);
  const { score, drivers } = scoreFromSignals(signals);
  const label = labelFromScore(score);

  let trend: "up" | "down" | "stable" | undefined;
  if (previousScore !== null) {
    if (score > previousScore + 5) trend = "up";
    else if (score < previousScore - 5) trend = "down";
    else trend = "stable";
  }

  return {
    score,
    label,
    drivers,
    computed_at: new Date().toISOString(),
    trend,
  };
}

// Insights = 3-5 actions concrètes que le CS devrait faire ce mois-ci. v1 :
// règles dérivées des signaux (pas d'IA). On peut passer Sonnet plus tard
// pour des recommandations plus contextuelles.
export function computeInsights(ctx: ClientEnrichmentContext, health: Health): Insights {
  const s = extractSignals(ctx);
  const actions: Array<{ title: string; rationale?: string; priority?: "high" | "medium" | "low" }> = [];
  const observations: string[] = [];

  // Idem que dans scoreFromSignals : "dernier contact" = min(engagement, meeting)
  const lastContactCandidates = [s.daysSinceLastEngagement, s.daysSinceLastMeeting]
    .filter((d): d is number => d !== null);
  const daysSinceLastContact = lastContactCandidates.length > 0 ? Math.min(...lastContactCandidates) : null;

  if (health.label === "red") {
    if (daysSinceLastContact !== null && daysSinceLastContact > 60) {
      actions.push({
        title: "Reprendre contact immédiatement",
        rationale: `Silence de ${daysSinceLastContact}j — risque de churn élevé.`,
        priority: "high",
      });
    }
    if (s.meetingsLast90 === 0) {
      actions.push({
        title: "Planifier un point QBR / adoption",
        rationale: "Aucun meeting CS analysé sur les 90 derniers jours.",
        priority: "high",
      });
    }
  }

  if (health.label === "yellow") {
    if (daysSinceLastContact !== null && daysSinceLastContact > 30) {
      actions.push({
        title: "Envoyer un check-in",
        rationale: `Dernier échange il y a ${daysSinceLastContact}j.`,
        priority: "medium",
      });
    }
    if (s.meetingsLast90 < 2) {
      actions.push({
        title: "Planifier une session de feedback",
        rationale: "Le rythme d'échanges baisse, capter le ressenti.",
        priority: "medium",
      });
    }
  }

  if (s.contactsCount <= 1) {
    actions.push({
      title: "Identifier un sponsor de backup",
      rationale: "Un seul contact mappé côté HubSpot — champion fragile.",
      priority: "medium",
    });
  }

  if (s.meetingsLast90 >= 3 && health.label === "green") {
    actions.push({
      title: "Documenter le bon pattern",
      rationale: `${s.meetingsLast90} meetings sur 90j et compte healthy — bonne pratique à formaliser.`,
      priority: "low",
    });
  }

  // Observations
  if (s.totalEngagements > 30) observations.push(`Compte mature : ${s.totalEngagements} engagements HubSpot.`);
  if (s.totalMeetings > 5) observations.push(`${s.totalMeetings} meetings analysés sur l'historique du deal.`);
  if (s.daysSinceLastMeeting !== null && s.daysSinceLastMeeting < 7) {
    observations.push(`Meeting récent (${s.daysSinceLastMeeting}j) — moment opportun pour itérer.`);
  }

  return {
    generated_at: new Date().toISOString(),
    actions: actions.slice(0, 5),
    observations: observations.slice(0, 3),
  };
}
