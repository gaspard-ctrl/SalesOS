// Garde-fou pour la phase de test : décide si un closed-won doit déclencher
// automatiquement l'enrichissement Claude. Sans ça, n'importe quel deal qui
// passe en closed-won consomme ~0,20 $ d'API Anthropic sans qu'on l'ait
// validé. On peut couper via env var le temps de l'expé.
//
// Modes :
//  - CLIENTS_AUTO_ENRICH=false : la row clients est créée en status=pending
//    par le webhook, mais l'enrichissement n'est PAS déclenché. Le user lance
//    manuellement via le bouton "Lancer l'enrichissement" sur la fiche
//    (POST /api/clients/[id]/enrich, admin-only).
//  - CLIENTS_AUTO_ENRICH=true ou non set : comportement nominal.
//  - CLIENTS_ENRICHMENT_DEAL_WHITELIST=id1,id2 (optionnel) : si défini ET
//    qu'auto est activé, seuls ces dealIds déclenchent automatiquement.
//    Les autres restent en pending (même fallback que le manuel).

export type AutoEnrichDecision =
  | { auto: true }
  | { auto: false; reason: "disabled" | "not_in_whitelist" };

export function decideAutoEnrich(dealId: string): AutoEnrichDecision {
  if (process.env.CLIENTS_AUTO_ENRICH === "false") {
    return { auto: false, reason: "disabled" };
  }
  const whitelistRaw = process.env.CLIENTS_ENRICHMENT_DEAL_WHITELIST;
  if (whitelistRaw) {
    const list = whitelistRaw.split(",").map((s) => s.trim()).filter(Boolean);
    if (list.length > 0 && !list.includes(dealId)) {
      return { auto: false, reason: "not_in_whitelist" };
    }
  }
  return { auto: true };
}
