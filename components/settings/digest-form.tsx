"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendTestDigest, updateDigestSettings } from "@/app/(app)/actions/settings";

export function DigestForm({
  accountEmail,
  initialEnabled,
  initialEmail,
}: {
  accountEmail: string;
  initialEnabled: boolean;
  initialEmail: string;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [email, setEmail] = useState(initialEmail);
  const [pending, startTransition] = useTransition();
  const [testPending, startTestTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function handleSave() {
    setMessage(null);
    startTransition(async () => {
      const result = await updateDigestSettings({ enabled, email });
      setMessage(result.error ?? "Saved.");
    });
  }

  function handleTest() {
    setMessage(null);
    startTestTransition(async () => {
      const result = await sendTestDigest();
      setMessage(result.error ?? `Test digest sent to ${email || accountEmail}.`);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Checkbox id="digest-enabled" checked={enabled} onCheckedChange={(c) => setEnabled(c === true)} />
        <Label htmlFor="digest-enabled" className="text-sm font-normal">
          Send me a daily digest
        </Label>
      </div>
      <div className="space-y-1">
        <Label htmlFor="digest-email" className="text-xs text-muted-foreground">
          Send to (defaults to {accountEmail})
        </Label>
        <Input
          id="digest-email"
          type="email"
          placeholder={accountEmail}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={handleSave} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : "Save"}
        </Button>
        <Button size="sm" variant="outline" onClick={handleTest} disabled={testPending}>
          {testPending ? <Loader2 className="animate-spin" /> : "Send test digest"}
        </Button>
        {message && <span className="text-xs text-muted-foreground">{message}</span>}
      </div>
    </div>
  );
}
