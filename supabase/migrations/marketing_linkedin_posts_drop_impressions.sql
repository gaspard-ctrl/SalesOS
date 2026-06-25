-- Suppression de la mécanique "impressions" des posts LinkedIn (analytics privées
-- saisies à la main + rappel Slack). On ne garde que la liste des posts avec leurs
-- réactions (likes) et commentaires.
--
-- À appliquer UNIQUEMENT si marketing_linkedin_posts a déjà été créée AVEC ces
-- colonnes (DROP COLUMN IF EXISTS = no-op sinon). Sur une base neuve, le CREATE de
-- marketing_linkedin_posts.sql ne crée déjà plus ces colonnes.
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE marketing_linkedin_posts DROP COLUMN IF EXISTS impressions;
ALTER TABLE marketing_linkedin_posts DROP COLUMN IF EXISTS impressions_updated_at;
ALTER TABLE marketing_linkedin_posts DROP COLUMN IF EXISTS impressions_updated_by;
ALTER TABLE marketing_linkedin_posts DROP COLUMN IF EXISTS notified_at;
