-- Sales Coach v3 — talk ratio, email draft, HubSpot tasks
-- ────────────────────────────────────────────────────────────────────────

ALTER TABLE sales_coach_analyses
  ADD COLUMN IF NOT EXISTS talk_ratio       JSONB,
  ADD COLUMN IF NOT EXISTS email_draft      JSONB,
  ADD COLUMN IF NOT EXISTS hubspot_task_ids TEXT[];
