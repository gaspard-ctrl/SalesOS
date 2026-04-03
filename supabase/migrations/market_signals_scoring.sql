-- Market Intel refonte : ajout scoring + tracking + enrichissement
-- À exécuter dans Supabase SQL Editor

ALTER TABLE market_signals ADD COLUMN IF NOT EXISTS score integer DEFAULT 0;
ALTER TABLE market_signals ADD COLUMN IF NOT EXISTS score_breakdown jsonb;
ALTER TABLE market_signals ADD COLUMN IF NOT EXISTS why_relevant text;
ALTER TABLE market_signals ADD COLUMN IF NOT EXISTS suggested_action text;
ALTER TABLE market_signals ADD COLUMN IF NOT EXISTS action_type text;
ALTER TABLE market_signals ADD COLUMN IF NOT EXISTS source_domain text;
ALTER TABLE market_signals ADD COLUMN IF NOT EXISTS is_read boolean DEFAULT false;
ALTER TABLE market_signals ADD COLUMN IF NOT EXISTS is_actioned boolean DEFAULT false;
ALTER TABLE market_signals ADD COLUMN IF NOT EXISTS company_enrichment jsonb;

-- Alert config sur la table users
ALTER TABLE users ADD COLUMN IF NOT EXISTS alert_config jsonb;

-- Index pour les filtres fréquents
CREATE INDEX IF NOT EXISTS idx_market_signals_score ON market_signals (score DESC);
CREATE INDEX IF NOT EXISTS idx_market_signals_user_score ON market_signals (user_id, score DESC);
