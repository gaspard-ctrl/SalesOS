-- Posts LinkedIn PROPRES (page entreprise "pro" + profil perso) scrapés
-- hebdomadairement via Bright Data, avec leurs réactions (likes) et commentaires.
--
-- post_url UNIQUE = clé d'upsert : un re-scrape met à jour likes/comments/texte
-- mais ne dédouble jamais.
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS marketing_linkedin_posts (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_url               TEXT NOT NULL UNIQUE,                    -- clé d'upsert
  source                 TEXT NOT NULL CHECK (source IN ('pro', 'perso')),
  source_url             TEXT NOT NULL,                           -- URL company/profile d'origine
  author                 TEXT,
  content                TEXT NOT NULL DEFAULT '',
  posted_at              TIMESTAMPTZ,
  likes                  INTEGER NOT NULL DEFAULT 0,
  comments               INTEGER NOT NULL DEFAULT 0,
  raw                    JSONB,                                   -- ligne brute Bright Data (debug)
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lecture de l'onglet (plus récents d'abord).
CREATE INDEX IF NOT EXISTS marketing_linkedin_posts_posted_at_idx
  ON marketing_linkedin_posts (posted_at DESC);
