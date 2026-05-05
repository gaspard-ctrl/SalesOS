-- Persist HubSpot Lead-object (CRM object type 0-136) properties on
-- lead_analyses to power the "Funnel leads → leads HubSpot" view in
-- /marketing > Leads. The Lead object has its own pipeline + stages
-- (e.g. New, Connected, Qualifying, ...) distinct from a Contact's
-- hs_lead_status.

ALTER TABLE lead_analyses
  ADD COLUMN IF NOT EXISTS hubspot_lead_id          TEXT,
  ADD COLUMN IF NOT EXISTS hubspot_lead_name        TEXT,
  ADD COLUMN IF NOT EXISTS hubspot_lead_pipeline_id TEXT,
  ADD COLUMN IF NOT EXISTS hubspot_lead_stage_id    TEXT,
  ADD COLUMN IF NOT EXISTS hubspot_lead_stage_label TEXT,
  ADD COLUMN IF NOT EXISTS hubspot_lead_owner_id    TEXT,
  ADD COLUMN IF NOT EXISTS hubspot_lead_owner_name  TEXT;

CREATE INDEX IF NOT EXISTS idx_lead_analyses_hubspot_lead_id
  ON lead_analyses (hubspot_lead_id);

CREATE INDEX IF NOT EXISTS idx_lead_analyses_hubspot_lead_stage
  ON lead_analyses (hubspot_lead_stage_label);
