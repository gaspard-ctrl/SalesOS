-- Persist HubSpot contact properties on lead_analyses to enable the "lead stage"
-- funnel in /marketing > Leads (track contacts that exist in HubSpot but don't
-- have a deal yet — hs_lead_status: NEW, ATTEMPTED_TO_CONTACT, CONNECTED, ...).

ALTER TABLE lead_analyses
  ADD COLUMN IF NOT EXISTS contact_email           TEXT,
  ADD COLUMN IF NOT EXISTS contact_name            TEXT,
  ADD COLUMN IF NOT EXISTS contact_lifecyclestage  TEXT,
  ADD COLUMN IF NOT EXISTS contact_hs_lead_status  TEXT,
  ADD COLUMN IF NOT EXISTS contact_owner_id        TEXT,
  ADD COLUMN IF NOT EXISTS contact_owner_name      TEXT;

CREATE INDEX IF NOT EXISTS idx_lead_analyses_contact_lead_status
  ON lead_analyses (contact_hs_lead_status);

CREATE INDEX IF NOT EXISTS idx_lead_analyses_contact_id
  ON lead_analyses (hubspot_contact_id);
