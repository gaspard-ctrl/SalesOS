-- Sales Coach: conserver la company HubSpot matchée séparément du deal,
-- pour fallback d'affichage quand le deal est introuvable ou non lié.
-- Ne change pas la logique de classification prospect/client (qui reste
-- basée sur le stage du deal via resolveAudience).

ALTER TABLE sales_coach_analyses
  ADD COLUMN IF NOT EXISTS hubspot_company_id TEXT,
  ADD COLUMN IF NOT EXISTS company_snapshot JSONB;

CREATE INDEX IF NOT EXISTS idx_sales_coach_company
  ON sales_coach_analyses (hubspot_company_id);
