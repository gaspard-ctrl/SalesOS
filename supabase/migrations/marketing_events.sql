-- Marketing events: salons, posts LinkedIn (pro/perso) — team-wide timeline
-- overlaid on the marketing overview traffic chart to correlate activity
-- with audience spikes.
-- ────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS marketing_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_date   DATE NOT NULL,
  event_type   TEXT NOT NULL CHECK (event_type IN ('salon', 'linkedin_pro', 'linkedin_perso', 'nurturing_campaign')),
  label        TEXT NOT NULL,
  created_by   TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketing_events_date ON marketing_events(event_date DESC);
