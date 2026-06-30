-- Persiste le label du pipeline du deal HubSpot associé au lead. Permet de
-- considérer "gagné" tout deal passé dans le pipeline Customer Success /
-- Passation (où HubSpot remet hs_is_closed_won à false). cf isWonDeal dans
-- lib/deals/stages.ts.

ALTER TABLE lead_analyses
  ADD COLUMN IF NOT EXISTS deal_pipeline_label TEXT;
