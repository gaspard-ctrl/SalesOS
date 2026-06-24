import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { logUsage } from "@/lib/log-usage";
import { fetchCompanyContacts } from "@/lib/watchlist/fetch-company-contacts";
import { draftProspectionEmail, type DraftRecipient } from "@/lib/watchlist/draft-email";
import { searchPeople as apolloSearchPeople, revealPerson, isApolloConfigured } from "@/lib/apollo/client";
import { hubspotFetch, hubspotAssociate } from "@/lib/hubspot";
import type { SignalRow, SignalCandidate } from "./types";

// Mots-clés ICP pour reconnaître un bon contact (buyer RH / People / L&D).
const ICP_KEYWORDS = ["chro", "drh", "ressources humaines", "human resources", "people", "talent", "l&d", "learning", "hrbp", "rh", "formation"];
const ICP_TITLES = ["CHRO", "DRH", "VP People", "Head of L&D", "People", "Talent", "HRBP", "Learning"];
const ICP_SENIORITIES = ["c_suite", "vp", "head", "director"];

function isIcp(title: string | null | undefined): boolean {
  const t = (title ?? "").toLowerCase();
  return ICP_KEYWORDS.some((k) => t.includes(k));
}

export interface CandidatesResult {
  signal: SignalRow | null;
  scopeCompanyId: string | null;
  candidates: SignalCandidate[];
  apolloConfigured: boolean;
}

/**
 * Prépare la liste des destinataires possibles pour un signal SANS rien dépenser
 * (pas de reveal, pas de draft) : contacts CRM du compte + candidats ICP Apollo
 * (emails masqués). L'utilisateur choisit ensuite qui contacter. Rangés : ICP CRM
 * d'abord, puis CRM, puis Apollo par séniorité.
 */
export async function getSignalCandidates(signalId: string): Promise<CandidatesResult> {
  const { data: sig } = await db.from("prospect_signals").select("*").eq("id", signalId).maybeSingle<SignalRow>();
  if (!sig) return { signal: null, scopeCompanyId: null, candidates: [], apolloConfigured: isApolloConfigured() };

  const out: SignalCandidate[] = [];
  const seenNames = new Set<string>();
  // Échantillons (prénom, nom, email) pour deviner le pattern d'emails société.
  const samples: { first: string; last: string; email: string }[] = [];

  // Contacts CRM (si le compte est déjà dans la watchlist). On inclut AUSSI les
  // contacts dont l'email n'est pas encore révélé (bouton "Reveal" sur la fiche) :
  // ils restent sélectionnables, l'email sera révélé (Apollo par nom) ou deviné
  // (pattern société) au moment du draft.
  if (sig.scope_company_id) {
    const { contacts } = await fetchCompanyContacts(sig.scope_company_id).catch(() => ({ contacts: [] }));
    // Pattern d'emails connus (contacts déjà révélés) -> sert à deviner les autres.
    for (const c of contacts) {
      if (c.email && c.firstname && c.lastname) samples.push({ first: c.firstname, last: c.lastname, email: c.email });
    }
    for (const c of contacts) {
      const name = `${c.firstname ?? ""} ${c.lastname ?? ""}`.trim() || c.email || "";
      if (!name || seenNames.has(name.toLowerCase())) continue;
      seenNames.add(name.toLowerCase());
      out.push({
        key: `crm:${c.id}`,
        source: "crm",
        name,
        title: c.jobtitle,
        email: c.email,
        apolloId: null,
        icp: isIcp(c.jobtitle),
        // Sans email : reveal Apollo par nom au draft, email deviné en secours.
        firstName: c.firstname ?? null,
        lastName: c.lastname ?? null,
        guessEmail: c.email ? null : guessEmail(c.firstname ?? undefined, c.lastname ?? undefined, samples),
      });
    }
  }

  // Candidats Apollo ICP (emails masqués, reveal à la demande).
  const apolloPeople: { id: string; first: string; last: string }[] = [];
  if (isApolloConfigured() && sig.company_name) {
    const search = await apolloSearchPeople({
      organizationName: sig.company_name,
      titles: ICP_TITLES,
      seniorities: ICP_SENIORITIES,
      perPage: 10,
    }).catch(() => null);
    for (const p of search?.people ?? []) {
      const name = (p.name || `${p.first_name ?? ""} ${p.last_name ?? ""}`).trim();
      if (!name || !p.id || seenNames.has(name.toLowerCase())) continue;
      seenNames.add(name.toLowerCase());
      if (p.first_name && p.last_name) apolloPeople.push({ id: p.id, first: p.first_name, last: p.last_name });
      out.push({
        key: `apollo:${p.id}`,
        source: "apollo",
        name,
        title: p.title,
        email: null,
        apolloId: p.id,
        icp: isIcp(p.title) || ICP_SENIORITIES.includes((p.seniority ?? "").toLowerCase()),
      });
    }
  }

  // Tri : ICP CRM > CRM > Apollo ICP > Apollo, l'ICP toujours devant.
  const rank = (c: SignalCandidate) => {
    let r = 0;
    if (c.source === "crm") r += 2;
    if (c.icp) r += 4;
    return r;
  };
  out.sort((a, b) => rank(b) - rank(a));

  // FOCUS sur la personne nommée (nomination / job_change) : on l'extrait du
  // signal et on la met en tête. Email résolu au draft (reveal Apollo par nom),
  // avec un email DEVINÉ en secours d'après le pattern emails de la société.
  let candidates = out;
  if (sig.signal_type === "nomination" || sig.signal_type === "job_change") {
    const nominee = await extractNominee(sig).catch(() => null);
    if (nominee && (nominee.firstName || nominee.lastName)) {
      const full = `${nominee.firstName ?? ""} ${nominee.lastName ?? ""}`.trim();
      // Pas de contact CRM pour apprendre le pattern d'emails ? On révèle UN
      // collègue ICP via Apollo (1 crédit) pour comprendre la structure des emails
      // de la société, puis on devine l'email du nominé.
      if (samples.length === 0 && apolloPeople.length > 0 && isApolloConfigured()) {
        const learned = await learnEmailPattern(apolloPeople, out);
        if (learned) samples.push(learned);
      }
      const guess = guessEmail(nominee.firstName, nominee.lastName, samples);
      // Évite un doublon si déjà présent (CRM/Apollo).
      const dupIdx = candidates.findIndex((c) => c.name.toLowerCase() === full.toLowerCase());
      if (dupIdx >= 0) candidates.splice(dupIdx, 1);
      candidates = [
        {
          key: "nominee",
          source: "nominee",
          name: full,
          title: nominee.title ?? null,
          email: guess,
          apolloId: null,
          icp: true,
          focus: true,
          guessed: !!guess,
          firstName: nominee.firstName ?? null,
          lastName: nominee.lastName ?? null,
          guessEmail: guess,
        },
        ...candidates,
      ];
    }
  }

  return {
    signal: sig,
    scopeCompanyId: sig.scope_company_id,
    candidates: candidates.slice(0, 12),
    apolloConfigured: isApolloConfigured(),
  };
}

// ── Extraction de la personne nommée + devinette d'email ─────────────────────

const NOMINEE_MODEL = "claude-haiku-4-5-20251001";

const NOMINEE_TOOL: Anthropic.Tool = {
  name: "emit_nominee",
  description: "Renvoie la personne nommée/promue dans le signal, si une personne précise est citée.",
  input_schema: {
    type: "object" as const,
    properties: {
      found: { type: "boolean", description: "true si une personne précise est nommée/promue." },
      first_name: { type: "string", description: "Prénom, ou vide." },
      last_name: { type: "string", description: "Nom de famille, ou vide." },
      title: { type: "string", description: "Nouveau poste/titre, ou vide." },
    },
    required: ["found"],
  },
};

async function extractNominee(
  sig: SignalRow,
): Promise<{ firstName: string; lastName: string; title: string | null } | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const client = new Anthropic({ timeout: 30_000, maxRetries: 1 });
  const msg = await client.messages.create({
    model: NOMINEE_MODEL,
    max_tokens: 200,
    system: "Tu extrais la personne nommée, promue ou recrutée mentionnée dans un signal de prospection. Si aucune personne précise n'est citée (juste l'entreprise), found=false. Réponds uniquement via emit_nominee.",
    messages: [{ role: "user", content: `Titre: ${sig.title}\nRésumé: ${sig.summary ?? ""}` }],
    tools: [NOMINEE_TOOL],
    tool_choice: { type: "tool" as const, name: "emit_nominee" },
  });
  logUsage(null, NOMINEE_MODEL, msg.usage.input_tokens, msg.usage.output_tokens, "signals_nominee");
  const block = msg.content.find((b) => b.type === "tool_use");
  if (!block || !("input" in block)) return null;
  const out = block.input as { found?: boolean; first_name?: string; last_name?: string; title?: string };
  if (!out.found) return null;
  const firstName = (out.first_name ?? "").trim();
  const lastName = (out.last_name ?? "").trim();
  if (!firstName && !lastName) return null;
  return { firstName, lastName, title: (out.title ?? "").trim() || null };
}

/**
 * Révèle un collègue ICP via Apollo (1 crédit) pour APPRENDRE le pattern d'emails
 * de la société quand on n'a aucun contact CRM. Met aussi à jour l'email de ce
 * candidat dans la liste (il devient joignable). Renvoie l'échantillon ou null.
 */
async function learnEmailPattern(
  people: { id: string; first: string; last: string }[],
  out: SignalCandidate[],
): Promise<{ first: string; last: string; email: string } | null> {
  for (const p of people.slice(0, 3)) {
    const revealed = await revealPerson({ apolloId: p.id }).catch(() => null);
    const email = revealed?.person?.email;
    if (email && !email.includes("email_not_unlocked") && email.includes("@")) {
      const cand = out.find((c) => c.apolloId === p.id);
      if (cand) {
        cand.email = email;
        cand.source = "crm"; // a maintenant un vrai email -> plus de reveal
        cand.apolloId = null;
      }
      return { first: p.first, last: p.last, email };
    }
  }
  return null;
}

function nameNorm(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Devine l'email d'une personne d'après le pattern d'emails connus de la société
 * (échantillons prénom/nom/email du CRM). Détecte le format (first.last, flast,
 * first, ...) sur un échantillon puis l'applique au nominé. null si indéterminable.
 */
function guessEmail(
  firstNameRaw: string | undefined,
  lastNameRaw: string | undefined,
  samples: { first: string; last: string; email: string }[],
): string | null {
  const first = nameNorm(firstNameRaw ?? "");
  const last = nameNorm(lastNameRaw ?? "");
  if ((!first && !last) || samples.length === 0) return null;

  const templates: { id: string; fn: (f: string, l: string) => string }[] = [
    { id: "first.last", fn: (f, l) => `${f}.${l}` },
    { id: "firstlast", fn: (f, l) => `${f}${l}` },
    { id: "flast", fn: (f, l) => `${f.slice(0, 1)}${l}` },
    { id: "first_last", fn: (f, l) => `${f}_${l}` },
    { id: "f.last", fn: (f, l) => `${f.slice(0, 1)}.${l}` },
    { id: "first.l", fn: (f, l) => `${f}.${l.slice(0, 1)}` },
    { id: "lastfirst", fn: (f, l) => `${l}${f}` },
    { id: "first", fn: (f) => f },
    { id: "last", fn: (_f, l) => l },
  ];

  for (const s of samples) {
    const sf = nameNorm(s.first);
    const sl = nameNorm(s.last);
    const at = s.email.indexOf("@");
    if (at < 1 || !sf || !sl) continue;
    const local = s.email.slice(0, at).toLowerCase();
    const domain = s.email.slice(at + 1).toLowerCase();
    const match = templates.find((t) => t.fn(sf, sl) === local);
    if (match && domain && first && last) {
      return `${match.fn(first, last)}@${domain}`;
    }
  }
  // Pas de pattern reconnu : si toutes les samples partagent un domaine, tente first.last.
  const domains = new Set(samples.map((s) => s.email.split("@")[1]?.toLowerCase()).filter(Boolean));
  if (domains.size === 1 && first && last) {
    return `${first}.${last}@${[...domains][0]}`;
  }
  return null;
}

export interface DraftForSignalResult {
  ok: boolean;
  recipient: DraftRecipient | null;
  draft: { subject: string; body: string } | null;
  scopeCompanyId: string | null;
  apolloUsed: boolean;
  error?: string;
}

/**
 * Génère le brouillon pour le destinataire CHOISI par l'utilisateur. Révèle
 * l'email via Apollo (1 crédit) seulement si le candidat n'en a pas déjà un.
 * Marque le signal 'actioned' et stocke le brouillon (visible sur la fiche).
 */
export async function draftForSignal(params: {
  signalId: string;
  userId: string;
  userEmail?: string | null;
  choice: {
    email?: string | null;
    name?: string | null;
    apolloId?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    /** Email deviné, utilisé si le reveal Apollo échoue (focus nominé). */
    fallbackEmail?: string | null;
  };
}): Promise<DraftForSignalResult> {
  const { data: sig } = await db.from("prospect_signals").select("*").eq("id", params.signalId).maybeSingle<SignalRow>();
  if (!sig) return { ok: false, recipient: null, draft: null, scopeCompanyId: null, apolloUsed: false, error: "Signal not found" };

  // Assurer un compte watchlist (discovery -> ajout).
  let scopeCompanyId = sig.scope_company_id;
  if (!scopeCompanyId) {
    scopeCompanyId = await ensureScopeCompany(sig, params.userId);
  }

  // Résoudre l'email du destinataire choisi.
  let recipient: DraftRecipient | null = null;
  let apolloUsed = false;
  const c = params.choice;

  if (c.email) {
    recipient = { name: c.name ?? null, email: c.email };
  } else if (isApolloConfigured() && (c.apolloId || (c.firstName && c.lastName))) {
    apolloUsed = true;
    // Reveal par id (candidat Apollo) ou par nom (focus nominé).
    const revealed = await revealPerson(
      c.apolloId
        ? { apolloId: c.apolloId }
        : { firstName: c.firstName!, lastName: c.lastName!, organizationName: sig.company_name },
    ).catch(() => null);
    const email = revealed?.person?.email;
    if (email && !email.includes("email_not_unlocked")) {
      const name = (revealed?.person?.name || c.name || "").trim() || null;
      recipient = { name, email };
      const { hubspot_company_id } = await fetchCompanyContacts(scopeCompanyId).catch(() => ({ hubspot_company_id: null }));
      void pushContactToHubspot({
        hubspotCompanyId: hubspot_company_id,
        email,
        firstName: revealed?.person?.first_name ?? c.firstName ?? null,
        lastName: revealed?.person?.last_name ?? c.lastName ?? null,
        title: revealed?.person?.title ?? null,
      });
    }
  }

  // Secours : email deviné (pattern société) si Apollo n'a rien révélé.
  if (!recipient && c.fallbackEmail) {
    recipient = { name: c.name ?? null, email: c.fallbackEmail };
  }

  // Rédiger (ancré sur le signal). Même sans destinataire on génère un brouillon générique.
  // Si le destinataire EST la personne nommée dans le signal (focus nominé), on
  // s'adresse directement à elle (félicitations + accompagnement de sa prise de
  // poste). Sinon, on écrit à un buyer RH à propos du changement dans la société.
  const recipientIsNominee = !!(c.firstName && c.lastName);
  const signalLine = recipientIsNominee
    ? `Signal déclencheur (${sig.signal_type}) : ${sig.title}${sig.summary ? ` - ${sig.summary}` : ""}. Le destinataire EST la personne concernée par ce signal (${recipient?.name ?? `${c.firstName} ${c.lastName}`}). Adresse-toi directement à elle : félicite-la brièvement pour sa prise de poste, puis propose un accompagnement coaching/leadership pour réussir ses premiers mois et embarquer ses équipes. Pas de flagornerie.`
    : `Signal déclencheur (${sig.signal_type}) : ${sig.title}${sig.summary ? ` - ${sig.summary}` : ""}. Ancre l'accroche du mail sur ce signal précis et l'angle coaching/leadership pertinent pour le destinataire.`;
  const draft = await draftProspectionEmail({
    scopeCompanyId,
    userId: params.userId,
    userEmail: params.userEmail,
    instructions: signalLine,
    recipients: recipient ? [recipient] : [],
  });

  // Marquer actioned + stocker. Si la rédaction a ÉCHOUÉ, on NE marque PAS le
  // signal actioned : il resterait sinon hors du feed sans brouillon exploitable,
  // l'utilisateur ne pourrait plus réessayer. On garde 'new' mais on conserve le
  // destinataire/scope résolus pour qu'un nouvel essai ne re-dépense pas Apollo.
  const draftFailed = !!draft.error;
  const actionedAt = new Date().toISOString();
  const { error: updateError } = await db
    .from("prospect_signals")
    .update({
      scope_company_id: scopeCompanyId,
      feed: "watchlist",
      status: draftFailed ? "new" : "actioned",
      actioned_at: draftFailed ? null : actionedAt,
      draft_subject: draftFailed ? null : draft.subject,
      draft_body: draftFailed ? null : draft.body,
      draft_recipient: recipient,
      updated_at: actionedAt,
    })
    .eq("id", sig.id);
  if (updateError) {
    console.error("[signals/act] draft persist error:", updateError.message);
    return { ok: false, recipient, draft: null, scopeCompanyId, apolloUsed, error: updateError.message };
  }

  return {
    ok: !draftFailed,
    recipient,
    draft: draftFailed ? null : { subject: draft.subject, body: draft.body },
    scopeCompanyId,
    apolloUsed,
    error: draft.error,
  };
}

/**
 * "S'en occuper plus tard" : ajoute la société à la watchlist (si discovery),
 * rattache le signal et le marque actioned, SANS générer de brouillon. Le signal
 * sort du feed et reste visible sur la fiche compte.
 */
export async function saveSignalToWatchlist(params: {
  signalId: string;
  userId: string;
}): Promise<{ ok: boolean; scopeCompanyId: string | null; error?: string }> {
  const { data: sig } = await db.from("prospect_signals").select("*").eq("id", params.signalId).maybeSingle<SignalRow>();
  if (!sig) return { ok: false, scopeCompanyId: null, error: "Signal not found" };

  let scopeCompanyId = sig.scope_company_id;
  if (!scopeCompanyId) scopeCompanyId = await ensureScopeCompany(sig, params.userId);

  const now = new Date().toISOString();
  const { error: updateError } = await db
    .from("prospect_signals")
    .update({
      scope_company_id: scopeCompanyId,
      feed: "watchlist",
      status: "actioned",
      actioned_at: now,
      updated_at: now,
    })
    .eq("id", sig.id);
  if (updateError) {
    console.error("[signals/act] save persist error:", updateError.message);
    return { ok: false, scopeCompanyId, error: updateError.message };
  }

  return { ok: true, scopeCompanyId };
}

async function ensureScopeCompany(sig: SignalRow, userId: string): Promise<string> {
  const { data: existing } = await db.from("scope_companies").select("id").ilike("name", sig.company_name).maybeSingle();
  if (existing?.id) return existing.id as string;
  const { data: ownerRow } = await db.from("users").select("name").eq("id", userId).maybeSingle();
  const { data: created, error } = await db
    .from("scope_companies")
    .insert({ name: sig.company_name, owner: (ownerRow?.name as string | null) ?? null, notes: `Added from signal: ${sig.title}` })
    .select("id")
    .single();
  if (error || !created) throw new Error(`Failed to add company to watchlist: ${error?.message ?? "unknown"}`);
  return created.id as string;
}

async function pushContactToHubspot(params: {
  hubspotCompanyId: string | null;
  email: string;
  firstName: string | null;
  lastName: string | null;
  title: string | null;
}): Promise<void> {
  try {
    const created = await hubspotFetch<{ id?: string }>("/crm/v3/objects/contacts", "POST", {
      properties: {
        email: params.email,
        firstname: params.firstName ?? "",
        lastname: params.lastName ?? "",
        jobtitle: params.title ?? "",
      },
    });
    if (created?.id && params.hubspotCompanyId) {
      await hubspotAssociate("contacts", created.id, "companies", params.hubspotCompanyId);
    }
  } catch (e) {
    console.warn("[signals/act] HubSpot contact push skipped:", e instanceof Error ? e.message : e);
  }
}
