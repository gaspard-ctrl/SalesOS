-- Sales Coach: persist the actual Slack recap message that was posted, so we
-- can render it in the new /sales-coach Recaps view without re-formatting and
-- can deep-link users back to the Slack thread.

ALTER TABLE sales_coach_analyses
  ADD COLUMN IF NOT EXISTS meeting_recap_slack_text TEXT,
  ADD COLUMN IF NOT EXISTS meeting_recap_slack_permalink TEXT,
  ADD COLUMN IF NOT EXISTS meeting_recap_slack_ts TEXT,
  ADD COLUMN IF NOT EXISTS meeting_recap_slack_channel TEXT;
