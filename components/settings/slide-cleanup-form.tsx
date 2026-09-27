"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateSlideCleanupSettings } from "@/app/(app)/actions/settings";

const DEFAULT_DAYS = 30;

/** Off by default (PLAN.md Phase 12 task 9) — the daily cron does the actual deletion once a
 * lecture has a generated note and this many days have passed since. */
export function SlideCleanupForm({ initialDays }: { initialDays: number | null }) {
  const [enabled, setEnabled] = useState(initialDays !== null);
  const [days, setDays] = useState(initialDays ?? DEFAULT_DAYS);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function handleSave() {
    setMessage(null);
    startTransition(async () => {
      const result = await updateSlideCleanupSettings(enabled ? days : null);
      setMessage(result.error ?? "Saved.");
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Checkbox id="slide-cleanup-enabled" checked={enabled} onCheckedChange={(c) => setEnabled(c === true)} />
        <Label htmlFor="slide-cleanup-enabled" className="text-sm font-normal">
          Delete slide photos once notes are generated
        </Label>
      </div>
      {enabled && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">After</span>
          <Input
            type="number"
            min={1}
            max={3650}
            className="w-20"
            value={days}
            onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 1))}
          />
          <span className="text-sm text-muted-foreground">days</span>
        </div>
      )}
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={handleSave} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : "Save"}
        </Button>
        {message && <span className="text-xs text-muted-foreground">{message}</span>}
      </div>
    </div>
  );
}
