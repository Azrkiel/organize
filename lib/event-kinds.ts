/** Event kinds a person can pick when adding an event by hand (PLAN.md Phase 13 task 6) — the
 * same set as the `events.kind` check constraint. */
export const MANUAL_EVENT_KINDS = ["exam", "class", "deadline", "study", "other"] as const;
export type ManualEventKind = (typeof MANUAL_EVENT_KINDS)[number];
