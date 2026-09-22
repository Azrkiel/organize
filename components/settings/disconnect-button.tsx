"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { disconnectIntegration } from "@/app/(app)/actions/integrations";
import type { CalendarProvider } from "@/lib/server/calendar/types";

export function DisconnectButton({ provider }: { provider: CalendarProvider }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleDisconnect() {
    startTransition(async () => {
      await disconnectIntegration(provider);
      router.refresh();
    });
  }

  return (
    <Button variant="outline" size="sm" onClick={handleDisconnect} disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : "Disconnect"}
    </Button>
  );
}
