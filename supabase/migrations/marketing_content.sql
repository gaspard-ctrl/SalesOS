-- Marketing Content Factory: persistent analysis, recommendations, drafts
-- ────────────────────────────────────────────────────────────────────────

-- Most recent analysis per user (overwritten on each "Run Analysis")
CREATE TABLE IF NOT EXISTS marketing_content_analysis (
  user_id      TEXT PRIMARY KEY,
  analysis     JSONB NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Article topic recommendations (one row per recommendation)
CREATE TABLE IF NOT EXISTS marketing_content_recommendations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           TEXT NOT NULL,
  topic             TEXT NOT NULL,
  target_keyword    TEXT NOT NULL,
  justification     TEXT,
  estimated_traffic INTEGER DEFAULT 0,
  difficulty        TEXT DEFAULT 'medium',
  priority          TEXT DEFAULT 'medium',
  status            TEXT NOT NULL DEFAULT 'recommended',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketing_recs_user ON marketing_content_recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_marketing_recs_status ON marketing_content_recommendations(user_id, status);

-- Generated drafts (FR + EN article content + WP metadata + internal links)
CREATE TABLE IF NOT EXISTS marketing_content_drafts (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            TEXT NOT NULL,
  recommendation_id  UUID REFERENCES marketing_content_recommendations(id) ON DELETE SET NULL,
  topic              TEXT NOT NULL,
  target_keyword     TEXT,
  content            JSONB NOT NULL,           -- { fr: "...", en: "..." }
  wordpress_format   JSONB NOT NULL,           -- { fr: {...}, en: {...} }
  internal_links     JSONB DEFAULT '{}'::jsonb, -- { fr: [...], en: [...] }
  style_match_score  INTEGER DEFAULT 0,
  structure_notes    TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketing_drafts_user ON marketing_content_drafts(user_id);
CREATE INDEX IF NOT EXISTS idx_marketing_drafts_rec ON marketing_content_drafts(recommendation_id);
