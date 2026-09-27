-- Fixes a real bug: the mobile "Capture" nav tab decided whether a lecture was actively recording
-- by checking IndexedDB on the CURRENT device (lib/client/lecture-audio-db.ts), but recording
-- always happens on the laptop while photos come from the phone — two different devices with two
-- different IndexedDBs. The phone's own IndexedDB never has the laptop's in-progress recording, so
-- tapping "Capture" on the phone always fell through to "pick a course" and the photo never got a
-- lecture_id, silently breaking the slide-to-notes integration (PLAN.md Phase 12 task 10).
--
-- Fix: track "currently recording" server-side so any device can see it. 'recorded' used to cover
-- both "still recording" and "recording finished, not yet transcribed" — split those apart.
alter table lectures drop constraint lectures_status_check;
alter table lectures add constraint lectures_status_check
  check (status in ('recording','recorded','transcribing','transcribed','notes_ready','error'));
