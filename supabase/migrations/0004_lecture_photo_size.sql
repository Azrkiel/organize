-- PLAN.md Phase 12 task 9: fold lecture-photos usage into the Phase 3 storage-usage readout
-- (one combined total, not a second untracked number) — needs its own tracked size the same way
-- attachments.size_bytes already works, since Storage object metadata isn't queried for this.
alter table lecture_photos add column size_bytes integer;

-- Off by default (null). Used by the daily cron (app/api/cron/digest/route.ts) to delete slide
-- photos once notes have been generated and this many days have passed.
alter table settings add column delete_slide_photos_after_days integer;
