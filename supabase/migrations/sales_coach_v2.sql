-- Sales Coach v2 — enrich analyses with deal snapshot + meeting classification
-- ────────────────────────────────────────────────────────────────────────

ALTER TABLE sales_coach_analyses
  ADD COLUMN IF NOT EXISTS deal_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS meeting_kind  TEXT;

CREATE INDEX IF NOT EXISTS idx_sales_coach_meeting_kind ON sales_coach_analyses (meeting_kind);
