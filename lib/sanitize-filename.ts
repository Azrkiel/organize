/**
 * Makes an arbitrary string (a note/course/folder title) safe to use as a file or folder name
 * inside the export ZIP — strips characters invalid on Windows/macOS, collapses whitespace, and
 * falls back to a placeholder rather than producing an empty segment.
 */
export function sanitizeFilename(name: string, fallback = "Untitled"): string {
  const cleaned = name
    .replace(/[/\\:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length > 0 ? cleaned.slice(0, 150) : fallback;
}
