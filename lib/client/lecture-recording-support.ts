/** Browser feature-detection helpers for lecture recording (PLAN.md Phase 9 tasks 1-3). */

/** Picks the best-supported MediaRecorder mime type: webm/opus on Chrome/Edge/Firefox, mp4/aac on
 * Safari. Returns "" when nothing matches (or MediaRecorder itself doesn't exist), in which case
 * the caller should construct MediaRecorder without an explicit mimeType and let the browser pick. */
export function pickAudioMimeType(
  isTypeSupported: (type: string) => boolean = (t) =>
    typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)
): string {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/aac"];
  for (const type of candidates) {
    try {
      if (isTypeSupported(type)) return type;
    } catch {
      // isTypeSupported can throw on some browsers for malformed strings — treat as unsupported.
    }
  }
  return "";
}

type WakeLockSentinelLike = { release: () => Promise<void> };

/** Requests a screen wake lock so the laptop doesn't sleep mid-lecture. Silently no-ops (returns
 * null) on unsupported browsers or a denied request — never blocks recording from starting. */
export async function requestWakeLock(): Promise<WakeLockSentinelLike | null> {
  try {
    const nav = navigator as Navigator & { wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> } };
    if (nav.wakeLock) return await nav.wakeLock.request("screen");
  } catch {
    // Wake lock is a nice-to-have; a denial or an unsupported browser shouldn't block recording.
  }
  return null;
}

/** Asks the browser not to evict this site's storage (IndexedDB audio) under pressure. Best-effort. */
export async function persistStorage(): Promise<void> {
  try {
    await navigator.storage?.persist?.();
  } catch {
    // Best-effort only.
  }
}

export interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: { transcript: string };
}
export interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
export interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: Event & { error?: string }) => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

/** The Web Speech API constructor if this browser has it (unprefixed or webkit-prefixed), else null. */
export function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}
