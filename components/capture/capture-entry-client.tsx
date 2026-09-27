"use client";

import { useState } from "react";
import { CaptureView } from "@/components/capture/capture-view";
import type { Course } from "@/lib/types";

/** Mobile bottom-nav "Capture" tab landing (PLAN.md Phase 12 task 10) when nothing is actively
 * recording — the parent server component already redirects to `/capture/[lectureId]` when
 * something is (a server-side check, not this device's own IndexedDB, since recording always
 * happens on the laptop and this page can be opened from the phone). This just lets the owner pick
 * a course and file photos with no lecture link. */
export function CaptureEntryClient({ userId, courses }: { userId: string; courses: Course[] }) {
  const [courseId, setCourseId] = useState<string | null>(null);

  if (courseId) {
    return (
      <CaptureView
        userId={userId}
        lectureId={null}
        courseId={courseId}
        heading={courses.find((c) => c.id === courseId)?.name ?? "Capture"}
        recordedAt={null}
        initialPhotos={[]}
      />
    );
  }

  return (
    <div className="mx-auto max-w-sm space-y-4">
      <p className="text-center text-sm text-muted-foreground">
        Nothing is recording right now. Pick a course to add slides to instead:
      </p>
      <div className="flex flex-col gap-2">
        {courses.map((course) => (
          <button
            key={course.id}
            onClick={() => setCourseId(course.id)}
            className="rounded-md border px-4 py-3 text-left text-sm font-medium hover:bg-accent"
            style={{ borderLeftColor: course.color, borderLeftWidth: 4 }}
          >
            {course.name}
          </button>
        ))}
      </div>
    </div>
  );
}
