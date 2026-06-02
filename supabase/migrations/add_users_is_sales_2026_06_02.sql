-- Flag "Sales" par utilisateur : décide qui reçoit le deal digest par AE.
-- Défaut false (personne ne reçoit tant que l'admin ne coche pas). À cocher
-- dans /admin > Gestion des utilisateurs. À exécuter dans Supabase SQL Editor.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_sales BOOLEAN NOT NULL DEFAULT false;
