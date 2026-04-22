-- Extend marketing_events.event_type to allow nurturing_campaign.
-- Run this on DBs that already have the table created without this type.
ALTER TABLE marketing_events DROP CONSTRAINT IF EXISTS marketing_events_event_type_check;
ALTER TABLE marketing_events
  ADD CONSTRAINT marketing_events_event_type_check
  CHECK (event_type IN ('salon', 'linkedin_pro', 'linkedin_perso', 'nurturing_campaign'));
