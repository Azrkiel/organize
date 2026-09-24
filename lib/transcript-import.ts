/** Parses an imported `.txt`/`.srt`/`.vtt` transcript file into plain text (PLAN.md Phase 9 task 5). */

function isCueIndexLine(line: string): boolean {
  return /^\d+$/.test(line);
}

function isTimecodeLine(line: string): boolean {
  return line.includes("-->");
}

/** Strips VTT's inline cue tags (`<b>`, `<i>`, `<v Speaker Name>`, timestamp tags, ...). */
function stripInlineTags(line: string): string {
  return line.replace(/<[^>]+>/g, "");
}

function parseSubtitleFormat(text: string): string {
  const cues: string[] = [];
  let currentLines: string[] = [];

  function flush() {
    if (currentLines.length > 0) {
      cues.push(currentLines.join(" ").trim());
      currentLines = [];
    }
  }

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      flush();
      continue;
    }
    if (line.toUpperCase() === "WEBVTT" || line.toUpperCase().startsWith("NOTE")) continue;
    if (isCueIndexLine(line) || isTimecodeLine(line)) continue;
    currentLines.push(stripInlineTags(line));
  }
  flush();

  return cues.join("\n").trim();
}

export type TranscriptExtension = "txt" | "srt" | "vtt";

export function getTranscriptExtension(filename: string): TranscriptExtension | null {
  const ext = filename.toLowerCase().split(".").pop();
  return ext === "txt" || ext === "srt" || ext === "vtt" ? ext : null;
}

/** Returns the extracted transcript text, or null if the extension is unsupported or nothing usable came out. */
export function parseTranscriptFile(filename: string, raw: string): string | null {
  const ext = getTranscriptExtension(filename);
  if (!ext) return null;

  const normalized = raw.replace(/\r\n/g, "\n").trim();
  const text = ext === "txt" ? normalized : parseSubtitleFormat(normalized);
  return text.length > 0 ? text : null;
}
