-- Sales Coach: introduit le statut "awaiting_manual_deal" pour les meetings
-- externes Claap dont aucun deal HubSpot n'a pu etre resolu automatiquement.
-- L'analyse est mise en pause, l'utilisateur saisit le nom du deal depuis
-- l'UI, et le flow normal reprend.
--
-- La colonne status est un TEXT libre (pas de CHECK / enum), donc rien a
-- alterer cote schema : cette migration sert de marqueur de deploiement et
-- documente la nouvelle valeur. Pas d'index dedie : idx_sales_coach_status
-- couvre deja le filtrage.

COMMENT ON COLUMN sales_coach_analyses.status IS
  'Etats : pending | analyzing | done | error | skipped | awaiting_manual_deal';
