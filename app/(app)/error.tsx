"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

// Next's file convention: catches a render/data error anywhere under the app shell instead of
// a blank white screen (PLAN.md Phase 8 task 5). Must be a Client Component.
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border py-16 text-center">
      <AlertTriangle className="size-8 text-muted-foreground" />
      <p className="text-lg font-medium">Something went wrong</p>
      <p className="text-sm text-muted-foreground">Try again, or come back in a moment.</p>
      <Button variant="outline" size="sm" onClick={() => reset()}>
        Try again
      </Button>
    </div>
  );
}
