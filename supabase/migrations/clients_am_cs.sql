-- Handover AM/CS : l'AE assigne un Account Manager et un Customer Success au
-- client closed-won et les notifie sur Slack une fois la fiche complète.
-- On stocke l'email + le nom (pour pré-remplir les dropdowns et le bandeau) et
-- la date de notification (bandeau "notified on …"). Pas de garde d'idempotence
-- stricte : l'AE peut re-notifier après avoir corrigé des infos.

alter table clients
  add column if not exists am_email text,
  add column if not exists am_name text,
  add column if not exists cs_email text,
  add column if not exists cs_name text,
  add column if not exists am_cs_notified_at timestamptz;
