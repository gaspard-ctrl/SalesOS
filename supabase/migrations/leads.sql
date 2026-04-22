-- Leads: mirror of messages posted in the Slack channel #1a-new-incoming-leads,
-- plus a manual validation status. Used by the Marketing "Leads" admin tab
-- and as the source of truth for the "Incoming Leads" KPI / timeline (only
-- rows with validation_status = 'validated' are counted).
-- ────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS leads (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slack_ts          TEXT NOT NULL UNIQUE,
  slack_channel_id  TEXT NOT NULL,
  slack_permalink   TEXT,
  author_id         TEXT,
  author_name       TEXT,
  text              TEXT NOT NULL DEFAULT '',
  files             JSONB NOT NULL DEFAULT '[]'::jsonb,
  posted_at         TIMESTAMPTZ NOT NULL,
  validation_status TEXT NOT NULL DEFAULT 'pending' CHECK (validation_status IN ('pending','validated','rejected')),
  validated_by      TEXT,
  validated_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_leads_status_posted ON leads(validation_status, posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_posted_at ON leads(posted_at DESC);
