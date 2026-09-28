"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { linkLectureTopic, unlinkLectureTopic } from "@/app/(app)/actions/topics";
import type { LectureTopicsData } from "@/lib/server/topics";

/** Which syllabus topics this lecture covers (PLAN.md Phase 13 task 4): linked topics, one-click
 * suggestions once notes exist, and a picker for anything the suggestions missed. */
export function LectureTopicsPanel({ lectureId, data }: { lectureId: string; data: LectureTopicsData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const byId = new Map(data.topics.map((t) => [t.id, t]));
  const linked = new Set(data.linkedIds);
  const others = data.topics.filter((t) => !linked.has(t.id));

  function run(action: () => Promise<{ error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  const link = (topicId: string) => run(() => linkLectureTopic({ lectureId, topicId }));
  const unlink = (topicId: string) => run(() => unlinkLectureTopic({ lectureId, topicId }));

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <p className="text-sm font-medium text-muted-foreground">Topics covered</p>

      {data.linkedIds.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {data.linkedIds.map((id) => (
            <span key={id} className="inline-flex items-center gap-1 rounded-full bg-muted py-0.5 pr-1 pl-2.5 text-xs">
              {byId.get(id)?.title ?? "Topic"}
              <button
                type="button"
                onClick={() => unlink(id)}
                disabled={pending}
                className="rounded-full p-0.5 hover:bg-background"
                aria-label={`Remove ${byId.get(id)?.title ?? "topic"}`}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">None linked yet.</p>
      )}

      {data.suggestedIds.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">Suggested from this lecture&apos;s notes:</p>
          <div className="flex flex-wrap gap-1.5">
            {data.suggestedIds.map((id) => (
              <Button key={id} variant="outline" size="xs" onClick={() => link(id)} disabled={pending}>
                <Plus className="size-3" /> {byId.get(id)?.title}
              </Button>
            ))}
          </div>
        </div>
      )}

      {others.length > 0 && (
        <select
          value=""
          onChange={(e) => e.target.value && link(e.target.value)}
          disabled={pending}
          className="h-8 w-full max-w-xs rounded-md border border-input bg-transparent px-2 text-sm text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          aria-label="Add a topic"
        >
          <option value="">Add a topic…</option>
          {others.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
