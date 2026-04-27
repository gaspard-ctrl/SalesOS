-- HubSpot Cleaner: audit log of corrective actions applied to HubSpot
-- ────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hubspot_cleaner_actions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  audit_type    TEXT NOT NULL,
  action        TEXT NOT NULL,
  object_type   TEXT NOT NULL,
  object_id     TEXT NOT NULL,
  payload       JSONB,
  before_state  JSONB,
  after_state   JSONB,
  status        TEXT NOT NULL DEFAULT 'success',
  error_message TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hubspot_cleaner_user ON hubspot_cleaner_actions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hubspot_cleaner_object ON hubspot_cleaner_actions (object_type, object_id);
CREATE INDEX IF NOT EXISTS idx_hubspot_cleaner_audit ON hubspot_cleaner_actions (audit_type, created_at DESC);
