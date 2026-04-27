-- Sales Coach: post-meeting analyses triggered by Claap webhook
-- ────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sales_coach_analyses (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claap_recording_id   TEXT UNIQUE NOT NULL,
  claap_event_id       TEXT,
  user_id              UUID REFERENCES users(id) ON DELETE SET NULL,
  recorder_email       TEXT NOT NULL,
  hubspot_deal_id      TEXT,
  meeting_title        TEXT,
  meeting_started_at   TIMESTAMPTZ,
  meeting_type         TEXT,
  transcript_text      TEXT,
  status               TEXT NOT NULL DEFAULT 'pending',
  error_message        TEXT,
  analysis             JSONB,
  score_global         NUMERIC,
  slack_sent_at        TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_coach_user ON sales_coach_analyses (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_coach_deal ON sales_coach_analyses (hubspot_deal_id);
CREATE INDEX IF NOT EXISTS idx_sales_coach_status ON sales_coach_analyses (status);
