-- Signature email par utilisateur (chacun la sienne), injectée dans les mails
-- partant de la page Prospection. Structure JSON : { enabled, fullName, title,
-- phone, bookingUrl, bookingLabel, languages, showLogo }.
-- Éditée dans /settings. À exécuter dans le SQL Editor Supabase.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_signature JSONB;
