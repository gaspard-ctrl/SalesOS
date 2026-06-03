-- Deux checklists d'action sur la fiche client (colonne de gauche) :
--
--   1. Checklist HubSpot : propositions IA de remplissage des champs de
--      qualification du deal (BANT + extras) restés vides après le closed-won.
--      On ne stocke PAS l'etat "rempli/manquant" : il est derive en live des
--      valeurs courantes du deal HubSpot (un champ est "valide" des qu'il a une
--      valeur). On ne persiste que les suggestions IA (pour ne pas regenerer a
--      chaque ouverture de fiche) :
--        { fields: [{ property, label, suggestion, rationale }], generated_at }
--
--   2. Checklist onboarding : taches d'onboarding du compte, 100 % manuelles
--      (template de base, cochees a la main). Etat coche persiste :
--        { items: [{ key, label, done, done_at }] }

--   3. Email "demander les infos manquantes" : brouillon genere par IA et mis
--      en cache (pour ne pas le regenerer a chaque ouverture de la modal). Inclut
--      aussi les editions de l'AE :
--        { to, subject, body, missing, generated_at }

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS hubspot_field_suggestions JSONB,
  ADD COLUMN IF NOT EXISTS onboarding_checklist      JSONB,
  ADD COLUMN IF NOT EXISTS missing_info_email_draft  JSONB;
