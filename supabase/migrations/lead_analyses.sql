-- Lead analyses: LLM extraction (email/name/company) + HubSpot deal matching
-- + funnel snapshot. One row per analysis run (a "Réanalyser" click adds a
-- new row), with `leads.last_analysis_id` pointing to the most recent one for
-- fast lookups in the page query.

CREATE TABLE IF NOT EXISTS lead_analyses (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id                  UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  status                   TEXT NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending','done','no_match','error')),
  -- LLM extraction
  extracted_email          TEXT,
  extracted_name           TEXT,
  extracted_company        TEXT,
  extraction_confidence    NUMERIC,
  extraction_notes         TEXT,
  -- HubSpot matching
  hubspot_contact_id       TEXT,
  hubspot_deal_id          TEXT,
  match_strategy           TEXT,           -- 'email' | 'person' | 'company' | 'none'
  -- Deal snapshot at analysis time
  deal_name                TEXT,
  deal_stage               TEXT,
  deal_stage_label         TEXT,
  deal_amount              NUMERIC,
  deal_close_date          TIMESTAMPTZ,
  deal_owner_id            TEXT,
  deal_owner_name          TEXT,
  deal_is_closed           BOOLEAN,
  deal_is_closed_won       BOOLEAN,
  -- Funnel
  time_to_deal_seconds     BIGINT,
  time_to_close_seconds    BIGINT,
  -- Debug / cost
  model                    TEXT,
  input_tokens             INT,
  output_tokens            INT,
  raw_claude_response      JSONB,
  error_message            TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_analyses_lead   ON lead_analyses(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_analyses_deal   ON lead_analyses(hubspot_deal_id);
CREATE INDEX IF NOT EXISTS idx_lead_analyses_status ON lead_analyses(status);

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS last_analysis_id   UUID REFERENCES lead_analyses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS analysis_status    TEXT
    CHECK (analysis_status IS NULL OR analysis_status IN ('pending','done','no_match','error')),
  ADD COLUMN IF NOT EXISTS analyzed_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS orphan_alerted_at  TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_leads_analysis_status ON leads(analysis_status);
