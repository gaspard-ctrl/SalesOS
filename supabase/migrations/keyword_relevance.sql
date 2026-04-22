-- Business-relevance classification for SEO keywords
-- ────────────────────────────────────────────────────────────────────────

-- Per-user cache of keyword business-relevance classifications.
-- Rows are scoped by context_hash so edits to lib/business-context.ts
-- automatically invalidate stale classifications without manual cleanup.
CREATE TABLE IF NOT EXISTS marketing_keyword_relevance (
  user_id          TEXT NOT NULL,
  keyword          TEXT NOT NULL,
  relevance_score  INTEGER NOT NULL,
  category         TEXT NOT NULL,           -- 'relevant' | 'partial' | 'irrelevant'
  reason           TEXT,
  context_hash     TEXT NOT NULL,
  classified_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, keyword)
);

CREATE INDEX IF NOT EXISTS idx_keyword_relevance_user_hash
  ON marketing_keyword_relevance(user_id, context_hash);

-- Extend recommendations with relevance metadata (nullable for back-compat).
ALTER TABLE marketing_content_recommendations
  ADD COLUMN IF NOT EXISTS relevance_score  INTEGER,
  ADD COLUMN IF NOT EXISTS relevance_reason TEXT;
