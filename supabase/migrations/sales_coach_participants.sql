-- Sales Coach: store external meeting participants for display in UI
-- ────────────────────────────────────────────────────────────────────────

ALTER TABLE sales_coach_analyses
  ADD COLUMN IF NOT EXISTS participants JSONB;
