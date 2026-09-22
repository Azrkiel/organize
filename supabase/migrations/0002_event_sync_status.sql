-- Phase 5 task 7: track calendar sync failures per event so the UI can show a
-- "sync failed, retry" badge instead of silently swallowing the error.
-- Null = in sync (or nothing to sync). Set = at least one connected provider's
-- last sync attempt for this event failed; cleared back to null on a successful retry.
alter table events add column sync_error text;
