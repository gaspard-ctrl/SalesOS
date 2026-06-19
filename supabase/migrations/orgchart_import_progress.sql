-- Suivi de progression des jobs d'import/refresh/reorganize orgchart.
-- Le worker écrit { phase, done, total, label } au fil de l'eau ; le front poll.
ALTER TABLE orgchart_import_jobs
  ADD COLUMN IF NOT EXISTS progress JSONB NOT NULL DEFAULT '{}'::jsonb;
