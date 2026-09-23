"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { logFocusSession } from "@/app/(app)/actions/focus";
import { formatClock, remainingSeconds } from "@/lib/focus-timer";
import type { Course } from "@/lib/types";

type Phase = "idle" | "work" | "break";

type TimerState = {
  phase: Phase;
  /** Epoch ms the current phase ends at, or null when idle or paused. */
  endAt: number | null;
  /** Frozen remaining ms while paused, or null when not paused. */
  pausedRemainingMs: number | null;
  workMinutes: number;
  breakMinutes: number;
  courseId: string | null;
};

const DEFAULT_STATE: TimerState = {
  phase: "idle",
  endAt: null,
  pausedRemainingMs: null,
  workMinutes: 25,
  breakMinutes: 5,
  courseId: null,
};

const STORAGE_KEY = "organize:focus-timer-v1";

function notify(title: string, body: string) {
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification(title, { body });
    }
  } catch {
    // Notifications are a nice-to-have; never let them break the timer.
  }
}

export function FocusTimerView({ courses }: { courses: Course[] }) {
  // Server and first client render must match, so this starts at the same default either way
  // and only picks up a saved-in-progress session after mount (see the effect below).
  const [state, setState] = useState<TimerState>(DEFAULT_STATE);
  const [, forceTick] = useState(0);
  // Stable reference — this component re-renders every 250ms while a timer is running (see the
  // tick effect below), and an inline object literal would otherwise churn Base UI Select's
  // internal store sync on every one of those renders.
  const courseItems = useMemo(
    () => ({ __none__: "No course", ...Object.fromEntries(courses.map((c) => [c.id, c.name])) }),
    [courses]
  );
  const stateRef = useRef(state);
  stateRef.current = state;
  const processedEndAtRef = useRef<number | null>(null);
  const hydrated = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = { ...DEFAULT_STATE, ...JSON.parse(raw) } as TimerState;
        // Guard against a corrupted/stale save: a non-idle phase with neither a running
        // end time nor a paused remainder is a dead end (no button would ever show).
        if (saved.phase !== "idle" && saved.endAt === null && saved.pausedRemainingMs === null) {
          saved.phase = "idle";
        }
        setState(saved);
      }
    } catch {}
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (!hydrated.current) return; // don't overwrite the saved state with the pre-hydration default
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
  }, [state]);

  function completePhase(s: TimerState) {
    if (s.phase === "work" && s.endAt !== null) {
      logFocusSession({
        courseId: s.courseId,
        minutes: s.workMinutes,
        startedAt: new Date(s.endAt - s.workMinutes * 60_000),
      }).catch(() => {});
      notify("Focus session complete", "Time for a break.");
      setState((prev) => ({ ...prev, phase: "break", endAt: Date.now() + prev.breakMinutes * 60_000, pausedRemainingMs: null }));
    } else if (s.phase === "break") {
      notify("Break's over", "Ready for another focus session?");
      setState((prev) => ({ ...prev, phase: "idle", endAt: null, pausedRemainingMs: null }));
    }
  }

  // A tick just forces a re-render; the actual remaining time always comes fresh from
  // `endAt` (see lib/focus-timer.ts), so a throttled background tab can't make it drift.
  useEffect(() => {
    const id = setInterval(() => {
      forceTick((t) => t + 1);
      const s = stateRef.current;
      if (s.phase === "idle" || s.endAt === null) return;
      if (remainingSeconds(s.endAt) > 0) return;
      if (processedEndAtRef.current === s.endAt) return; // this phase's completion already handled
      processedEndAtRef.current = s.endAt;
      completePhase(s);
    }, 250);
    return () => clearInterval(id);
  }, []);

  function handleStart() {
    try {
      if (typeof Notification !== "undefined" && Notification.permission === "default") {
        Notification.requestPermission();
      }
    } catch {}
    processedEndAtRef.current = null;
    setState((prev) => ({ ...prev, phase: "work", endAt: Date.now() + prev.workMinutes * 60_000, pausedRemainingMs: null }));
  }

  function handlePause() {
    setState((prev) => (prev.endAt === null ? prev : { ...prev, pausedRemainingMs: remainingSeconds(prev.endAt) * 1000, endAt: null }));
  }

  function handleResume() {
    processedEndAtRef.current = null;
    setState((prev) => (prev.pausedRemainingMs === null ? prev : { ...prev, endAt: Date.now() + prev.pausedRemainingMs, pausedRemainingMs: null }));
  }

  function handleReset() {
    processedEndAtRef.current = null;
    setState((prev) => ({ ...prev, phase: "idle", endAt: null, pausedRemainingMs: null }));
  }

  const running = state.endAt !== null;
  const paused = state.pausedRemainingMs !== null;
  const activeSeconds = running
    ? remainingSeconds(state.endAt!)
    : paused
      ? Math.round(state.pausedRemainingMs! / 1000)
      : state.workMinutes * 60;

  const courseName = courses.find((c) => c.id === state.courseId)?.name;

  return (
    <div className="mx-auto max-w-sm space-y-6 text-center">
      <div>
        <p className="text-sm font-medium text-muted-foreground">
          {state.phase === "work" ? "Focus" : state.phase === "break" ? "Break" : "Ready"}
          {courseName && state.phase !== "idle" ? ` · ${courseName}` : ""}
        </p>
        <p className="font-mono text-6xl font-semibold tabular-nums tracking-tight">{formatClock(activeSeconds)}</p>
      </div>

      {state.phase === "idle" && !paused && (
        <div className="space-y-3 rounded-lg border p-4 text-left">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="focus-work-minutes">Focus (min)</Label>
              <Input
                id="focus-work-minutes"
                type="number"
                min={1}
                max={180}
                value={state.workMinutes}
                onChange={(e) => setState((p) => ({ ...p, workMinutes: Math.max(1, Number(e.target.value) || 1) }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="focus-break-minutes">Break (min)</Label>
              <Input
                id="focus-break-minutes"
                type="number"
                min={1}
                max={60}
                value={state.breakMinutes}
                onChange={(e) => setState((p) => ({ ...p, breakMinutes: Math.max(1, Number(e.target.value) || 1) }))}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Course</Label>
            <Select
              items={courseItems}
              value={state.courseId ?? "__none__"}
              onValueChange={(v) => setState((p) => ({ ...p, courseId: v === "__none__" ? null : v }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="No course" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No course</SelectItem>
                {courses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <div className="flex justify-center gap-2">
        {state.phase === "idle" && !paused && (
          <Button onClick={handleStart}>
            <Play className="size-4" /> Start
          </Button>
        )}
        {running && (
          <Button variant="outline" onClick={handlePause}>
            <Pause className="size-4" /> Pause
          </Button>
        )}
        {paused && (
          <Button onClick={handleResume}>
            <Play className="size-4" /> Resume
          </Button>
        )}
        {(running || paused) && (
          <Button variant="ghost" onClick={handleReset}>
            <RotateCcw className="size-4" /> Reset
          </Button>
        )}
      </div>
    </div>
  );
}
