-- Brief client à destination des coachs (structure inspirée du message Slack
-- existant qu'on partage manuellement sur le canal coachs au moment du
-- staffing). Généré par Claude lors de l'enrichissement, alimenté par
-- HubSpot + transcripts Claap + fields_json déjà extraits.
--
-- Stocké en JSONB plutôt que markdown brut pour pouvoir :
--   - re-renderer dans plusieurs canaux (Slack, copy-to-clipboard, dashboard
--     coach, etc.) sans reparser un blob de texte,
--   - éditer field par field plus tard (batch 4) sans casser le format.

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS coach_brief JSONB,
  ADD COLUMN IF NOT EXISTS coach_brief_generated_at TIMESTAMPTZ;
