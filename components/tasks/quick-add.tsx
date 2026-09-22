"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createTask } from "@/app/(app)/actions/tasks";
import { parseTaskInput } from "@/lib/parse-task";
import { resolveCourseTag } from "@/lib/resolve-course-tag";
import type { Course } from "@/lib/types";

export function QuickAdd({ courses }: { courses: Course[] }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;

    const parsed = parseTaskInput(trimmed);
    const course = parsed.courseTag ? resolveCourseTag(parsed.courseTag, courses) : null;

    startTransition(async () => {
      const result = await createTask({
        title: parsed.title || trimmed,
        dueAt: parsed.dueAt,
        priority: parsed.priority,
        courseId: course?.id ?? null,
      });
      if (!result.error) {
        setValue("");
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder='"calc hw tomorrow 5pm !high #calc"'
        disabled={pending}
        className="flex-1"
      />
      <Button type="submit" disabled={pending || value.trim().length === 0}>
        <Plus className="size-4" /> Add
      </Button>
    </form>
  );
}
