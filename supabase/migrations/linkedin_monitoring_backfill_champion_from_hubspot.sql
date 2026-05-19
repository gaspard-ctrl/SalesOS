-- Backfill : tout profil Radar lié à HubSpot (hubspot_id non nul) est traité
-- comme champion. Aligne l'état historique sur la nouvelle règle d'auto-flag
-- à l'import (closedwon/closedlost → is_champion=true).

UPDATE linkedin_monitored_profiles
  SET is_champion = true
  WHERE hubspot_id IS NOT NULL
    AND is_champion = false;
