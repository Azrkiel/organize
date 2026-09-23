/**
 * Seconds left until `endAtMs` (epoch ms), clamped at 0. Callers re-derive this from a stored
 * end timestamp on every tick rather than counting down a local variable, since browsers
 * throttle `setInterval` in background tabs and a tick-counter would drift (PLAN.md Phase 7
 * task 5).
 */
export function remainingSeconds(endAtMs: number, nowMs: number = Date.now()): number {
  return Math.max(0, Math.round((endAtMs - nowMs) / 1000));
}

export function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
