-- LinkedIn monitoring : profils monitorés + cache posts
-- À exécuter dans Supabase SQL Editor

-- Profils LinkedIn monitorés (Radar)
CREATE TABLE IF NOT EXISTS linkedin_monitored_profiles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  username text NOT NULL UNIQUE,
  full_name text,
  headline text,
  company text,
  profile_url text,
  source text DEFAULT 'manual',
  radar_active boolean DEFAULT false,
  last_snapshot jsonb,
  last_change_at timestamp,
  created_at timestamp DEFAULT now()
);

-- Cache des posts LinkedIn scannés
CREATE TABLE IF NOT EXISTS linkedin_posts_cache (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  post_url text NOT NULL UNIQUE,
  author_name text,
  author_headline text,
  author_username text,
  company_match text,
  text_preview text,
  posted_at timestamp,
  keyword_match text,
  is_processed boolean DEFAULT false,
  signal_id uuid,
  created_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_linkedin_profiles_company ON linkedin_monitored_profiles (company);
CREATE INDEX IF NOT EXISTS idx_linkedin_posts_company ON linkedin_posts_cache (company_match);
