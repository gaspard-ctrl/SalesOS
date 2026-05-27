// Types partagés pour la feature Clients.
// Le contenu des fields est stocké dans `clients.fields_json` (jsonb) sous
// la forme `{ [fieldKey]: ClientFieldValue }`. Chaque field garde sa valeur,
// la confiance de l'IA, et la source (HubSpot note/email/meeting, Claap
// recording, ou édition manuelle). L'UI peut ainsi cliquer sur un field
// pour voir d'où il vient et afficher une pastille de confiance.

export type ClientFieldSource =
  | { kind: "hubspot"; entity: "note" | "email" | "meeting" | "call" | "deal" | "company"; id?: string }
  | { kind: "claap"; recordingId?: string }
  | { kind: "manual"; userEmail?: string }
  | { kind: "inferred" };

export type ClientFieldValue<T = unknown> = {
  value: T | null;
  confidence: number; // 0..1
  source: ClientFieldSource | null;
  updated_at: string; // ISO
};

// ── 2.1 Informations générales ───────────────────────────────────────────
export type GeneralInfoFields = {
  entreprise_compte: ClientFieldValue<string>;
  contact_signataire: ClientFieldValue<{ name: string; email?: string; role?: string }>;
  contact_principal_rh: ClientFieldValue<{ name: string; email?: string; role?: string }>;
  contact_rh_operationnel: ClientFieldValue<{ name: string; email?: string; role?: string }>;
  autres_parties_prenantes: ClientFieldValue<Array<{ name: string; email?: string; role?: string }>>;
  langues_requises: ClientFieldValue<string[]>;
  zones_geographiques: ClientFieldValue<string[]>;
};

// ── 2.2 Périmètre du programme ───────────────────────────────────────────
export type TypeCoaching = "humain" | "ia" | "hybride";
export type ProgramScopeFields = {
  type_coaching: ClientFieldValue<TypeCoaching>;
  nom_programme: ClientFieldValue<string>;
  population_accompagnee: ClientFieldValue<string>;
  nb_coaches_estime: ClientFieldValue<number>;
  cohortes_format: ClientFieldValue<string>;
  auto_assessment: ClientFieldValue<{ enabled: boolean; details?: string }>;
  flash_feedback: ClientFieldValue<{ enabled: boolean; details?: string }>;
  tripartite: ClientFieldValue<{ enabled: boolean; details?: string }>;
  quadripartite: ClientFieldValue<{ enabled: boolean; details?: string }>;
  offres_associees: ClientFieldValue<string[]>;
};

// ── 2.3 Objectifs & attentes ─────────────────────────────────────────────
export type GoalsFields = {
  objectifs_business_rh: ClientFieldValue<string[]>;
  kpis_cles: ClientFieldValue<string[]>;
  attentes_specifiques: ClientFieldValue<string>;
};

// ── 2.4 Organisation & intégration ───────────────────────────────────────
export type OrgFields = {
  integration_it: ClientFieldValue<string>;
  referentiels_documents: ClientFieldValue<Array<{ title: string; url?: string }>>;
  contraintes_organisationnelles: ClientFieldValue<string>;
};

// ── 2.5 Contexte & historique ────────────────────────────────────────────
export type RelationCommerciale = "nouveau" | "renouvellement" | "upsell";
export type HistoryFields = {
  relation_commerciale: ClientFieldValue<RelationCommerciale>;
  initiatives_rh_paralleles: ClientFieldValue<string>;
  points_de_vigilance: ClientFieldValue<string[]>;
};

// ── 2.6 Planning & prochaines étapes ─────────────────────────────────────
export type PlanningFields = {
  kickoff_envisage_le: ClientFieldValue<string>; // ISO date
  suivi_cs_attendu: ClientFieldValue<string[]>;
  engagements_sales: ClientFieldValue<string[]>;
};

export type ClientFields = {
  general_info: GeneralInfoFields;
  program_scope: ProgramScopeFields;
  goals: GoalsFields;
  org: OrgFields;
  history: HistoryFields;
  planning: PlanningFields;
};

// ── Sections meta (pour l'UI : ordre, libellés, mapping) ─────────────────
// Ordre repris du plan §2 (Informations → Périmètre → Objectifs → Orga →
// Contexte → Planning). Source de vérité unique pour l'UI : la fiche
// itère sur SECTION_DEFINITIONS pour afficher chaque bloc dans l'ordre.

export type SectionKey = keyof ClientFields;

export type FieldDefinition = {
  key: string;
  label: string;
  kind: "text" | "long_text" | "array_string" | "array_contact" | "array_doc" | "number" | "date" | "enum" | "bool_with_details" | "contact";
  options?: readonly string[];
};

export const SECTION_DEFINITIONS: ReadonlyArray<{
  key: SectionKey;
  label: string;
  fields: FieldDefinition[];
}> = [
  {
    key: "general_info",
    label: "Informations générales",
    fields: [
      { key: "entreprise_compte", label: "Entreprise / compte", kind: "text" },
      { key: "contact_signataire", label: "Contact signataire", kind: "contact" },
      { key: "contact_principal_rh", label: "Contact principal RH", kind: "contact" },
      { key: "contact_rh_operationnel", label: "Contact RH opérationnel", kind: "contact" },
      { key: "autres_parties_prenantes", label: "Autres parties prenantes", kind: "array_contact" },
      { key: "langues_requises", label: "Langues requises", kind: "array_string" },
      { key: "zones_geographiques", label: "Zones géographiques", kind: "array_string" },
    ],
  },
  {
    key: "program_scope",
    label: "Périmètre du programme",
    fields: [
      { key: "type_coaching", label: "Type de coaching", kind: "enum", options: ["humain", "ia", "hybride"] as const },
      { key: "nom_programme", label: "Nom du programme", kind: "text" },
      { key: "population_accompagnee", label: "Population accompagnée", kind: "text" },
      { key: "nb_coaches_estime", label: "Nb de coachés estimé", kind: "number" },
      { key: "cohortes_format", label: "Cohortes / format", kind: "text" },
      { key: "auto_assessment", label: "Auto-assessment", kind: "bool_with_details" },
      { key: "flash_feedback", label: "Flash feedback", kind: "bool_with_details" },
      { key: "tripartite", label: "Tripartite", kind: "bool_with_details" },
      { key: "quadripartite", label: "Quadripartite", kind: "bool_with_details" },
      { key: "offres_associees", label: "Offres associées", kind: "array_string" },
    ],
  },
  {
    key: "goals",
    label: "Objectifs & attentes",
    fields: [
      { key: "objectifs_business_rh", label: "Objectifs business / RH", kind: "array_string" },
      { key: "kpis_cles", label: "KPIs clés", kind: "array_string" },
      { key: "attentes_specifiques", label: "Attentes spécifiques", kind: "long_text" },
    ],
  },
  {
    key: "org",
    label: "Organisation & intégration",
    fields: [
      { key: "integration_it", label: "Intégration IT (SSO, SIRH, Slack, …)", kind: "long_text" },
      { key: "referentiels_documents", label: "Référentiels & documents", kind: "array_doc" },
      { key: "contraintes_organisationnelles", label: "Contraintes organisationnelles", kind: "long_text" },
    ],
  },
  {
    key: "history",
    label: "Contexte & historique",
    fields: [
      { key: "relation_commerciale", label: "Relation commerciale", kind: "enum", options: ["nouveau", "renouvellement", "upsell"] as const },
      { key: "initiatives_rh_paralleles", label: "Initiatives RH parallèles", kind: "long_text" },
      { key: "points_de_vigilance", label: "Points de vigilance", kind: "array_string" },
    ],
  },
  {
    key: "planning",
    label: "Planning & prochaines étapes",
    fields: [
      { key: "kickoff_envisage_le", label: "Kickoff envisagé le", kind: "date" },
      { key: "suivi_cs_attendu", label: "Suivi CS attendu", kind: "array_string" },
      { key: "engagements_sales", label: "Engagements sales", kind: "array_string" },
    ],
  },
] as const;

// ── Deal recap (généré plus tard, structuré façon Coachello-GPT) ─────────
export type DealRecap = {
  generated_at: string;
  timeline?: Array<{ when?: string; title: string; description: string; source?: ClientFieldSource | null }>;
  how_closed?: string;
  objections?: string[];
  triggers?: string[];
  sales_promises?: string[];
  onboarding_risks?: string[];
};

// ── Coach brief (généré par l'enrichissement, partagé manuellement aux coachs) ─
// Structure calquée sur le message Slack qu'on envoie au canal coachs au
// staffing : intro company + contexte business + programmes + objectifs +
// langues + journey + dates. Stocké structuré, rendu en markdown côté UI
// (CoachBriefPanel) ou plus tard en Slack/email.

export type CoachBriefLanguages = {
  region: string; // ex: "EUROPE", "APAC", "LATAM", "Global"
  languages: string[];
};

export type CoachBriefProgram = {
  name: string;        // ex: "Executive Program", "Managers Program"
  description: string; // ex: "designed to accompany senior leaders on strategic topics"
  nb_sessions?: number | null;
  population?: string | null; // ex: "senior leaders", "managers"
};

export type CoachBrief = {
  intro?: string | null;
  industry?: string | null;
  website?: string | null;
  context?: string | null;
  programs?: CoachBriefProgram[];
  goal?: string | null;
  location?: string | null;
  coaching_languages?: CoachBriefLanguages[];
  coachee_journey?: string | null;
  ai_coaching?: boolean | null;
  coachello_app?: string | null;          // "Slack", "Teams", "Email"
  briefing_meeting_date?: string | null;  // ISO ou texte libre si pas encore fixé
  nb_sessions_per_coachee?: number | null;
  tripartite?: string | null;             // "Optional in first session", "Required", "None"
  onboarding_start_date?: string | null;
  program_end_date?: string | null;
  program_duration?: string | null;       // "6 months", "9 months", "6 to 9 months"
};

// ── Health / Insights / News (squelettes — remplis dans une étape ultérieure) ─
export type HealthLabel = "green" | "yellow" | "red";
export type HealthSnapshot = {
  score: number;
  label: HealthLabel;
  drivers: string[];
  computed_at: string;
};
export type Health = HealthSnapshot & {
  trend?: "up" | "down" | "stable";
};

export type Insights = {
  generated_at: string;
  actions: Array<{ title: string; rationale?: string; priority?: "high" | "medium" | "low" }>;
  observations: string[];
};

export type News = {
  refreshed_at: string;
  items: Array<{
    title: string;
    url: string;
    published_at?: string;
    summary?: string;
    relevance?: number;
  }>;
};

// ── Recordings Claap découverts (live API, pas encore dans sales_coach_analyses) ─
// Persistés en JSONB dans `clients.discovered_claap_recordings` au moment de
// l'enrichissement. Sert au TimelinePanel pour afficher des meetings qui
// existent côté Claap mais qui n'ont pas (encore) été passés dans le pipeline
// sales-coach. Cf. migration clients_discovered_meetings.sql.
export type DiscoveredRecording = {
  recording_id: string;
  meeting_title: string | null;
  meeting_started_at: string | null;
  claap_url: string | null;
  discovered_at: string;
};

// ── Row Supabase ─────────────────────────────────────────────────────────
export type ClientRow = {
  id: string;
  hubspot_deal_id: string;
  hubspot_company_id: string | null;
  company_name: string;
  owner_email: string | null;
  owner_name: string | null;
  closedwon_at: string;
  deal_amount: number | null;
  fields_json: Partial<ClientFields>;
  deal_recap: DealRecap | null;
  coach_brief: CoachBrief | null;
  coach_brief_generated_at: string | null;
  health: Health | null;
  health_history: HealthSnapshot[];
  insights: Insights | null;
  news: News | null;
  discovered_claap_recordings: DiscoveredRecording[];
  enrichment_status: "pending" | "running" | "done" | "error";
  enrichment_error: string | null;
  last_enriched_at: string | null;
  last_health_run_at: string | null;
  last_news_run_at: string | null;
  created_at: string;
  updated_at: string;
};

// Factory pour générer un ClientFieldValue null (utilisé quand l'IA n'a
// pas trouvé de signal pour ce field). Garde une trace de la tentative
// d'extraction au lieu d'un trou complet dans fields_json.
export function emptyField<T>(): ClientFieldValue<T> {
  return {
    value: null,
    confidence: 0,
    source: null,
    updated_at: new Date().toISOString(),
  };
}
