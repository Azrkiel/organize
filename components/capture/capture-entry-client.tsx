"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getInProgressRecordings } from "@/lib/client/lecture-audio-db";
import { CaptureView } from "@/components/capture/capture-view";
import type { Course } from "@/lib/types";

/** Mobile bottom-nav "Capture" tab landing (PLAN.md Phase 12 task 10, no QR code involved): if a
 * lecture is actively recording, jump straight to its lecture-scoped capture page so offsets stay
 * meaningful; otherwise let the owner pick a course and file photos there directly. */
export function CaptureEntryClient({ userId, courses }: { userId: string; courses: Course[] }) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [courseId, setCourseId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getInProgressRecordings()
      .then((rows) => {
        if (cancelled) return;
        if (rows.length > 0) {
          router.replace(`/capture/${rows[0].lectureId}`);
        } else {
          setChecked(true);
        }
      })
      .catch(() => {
        if (!cancelled) setChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!checked) {
    return <p className="text-center text-sm text-muted-foreground">Checking for an active recording…</p>;
  }

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
