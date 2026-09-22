import type { Course } from "@/lib/types";

/**
 * Matches a quick-add `#tag` against the real course list: exact name match first, then a
 * course name starting with the tag, then any course name containing it. Case-insensitive.
 * Returns null if nothing matches (the caller leaves the task's course unset in that case).
 */
export function resolveCourseTag(tag: string, courses: Course[]): Course | null {
  const needle = tag.trim().toLowerCase();
  if (!needle) return null;

  const exact = courses.find((c) => c.name.toLowerCase() === needle);
  if (exact) return exact;

  const startsWith = courses.find((c) => c.name.toLowerCase().startsWith(needle));
  if (startsWith) return startsWith;

  const contains = courses.find((c) => c.name.toLowerCase().includes(needle));
  return contains ?? null;
}
