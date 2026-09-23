"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** A single-field name/rename dialog shared by courses and folders. */
export function NameDialog({
  open,
  onOpenChange,
  title,
  description,
  initialValue = "",
  submitLabel = "Save",
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  initialValue?: string;
  submitLabel?: string;
  onSubmit: (name: string) => Promise<{ error?: string } | void>;
}) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // This dialog is opened purely by the parent flipping `open` from outside (no internal
  // Trigger), and Base UI's `onOpenChange` only fires for its own internally-detected close
  // requests (Escape/backdrop/close button) — never for an externally-driven open. Reacting to
  // the `open` prop directly (rather than a callback that never runs for this transition) is
  // what makes a stale value from the last time this same instance was open actually reset —
  // e.g. rename "Course A", close, rename a different row: without this, the input reopens
  // showing "Course A" again instead of that row's own name.
  useEffect(() => {
    if (open) {
      setValue(initialValue);
      setError(null);
    }
  }, [open, initialValue]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await onSubmit(value);
      if (result?.error) {
        setError(result.error);
        return;
      }
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          <div className="space-y-2 py-4">
            <Label htmlFor="name-dialog-input" className="sr-only">
              Name
            </Label>
            <Input
              id="name-dialog-input"
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              maxLength={100}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending || value.trim().length === 0} className="w-full">
              {pending ? "Saving…" : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
