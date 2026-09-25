/** Browser feature-detection helpers for lecture recording (PLAN.md Phase 9 tasks 1-3). */

/** Explicit mic constraints rather than a bare `{ audio: true }` — the same baseline every serious
 * browser recording/notetaking tool (Meet, Zoom, Granola, ...) asks for: cancel the laptop's own
 * speaker bleed, suppress steady background noise, and auto-normalize a quiet voice, instead of
 * leaving it to whatever the browser's bare defaults happen to be. None of this fixes a genuinely
 * silent or wrong input device — see `createMicLevelMeter` below for surfacing that. */
export const MIC_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  channelCount: 1,
};

export type AudioInputDevice = { deviceId: string; label: string };

/** Every audio input Chrome can see, labeled — only meaningfully labeled once mic permission has
 * already been granted at least once (a fresh, never-asked page gets blank labels, harmless).
 * Exists because "whatever the OS/browser currently calls the default input" isn't reliable:
 * confirmed live that a laptop with bundled audio-enhancement software (MSI Sound Tune, similar
 * tools exist from Dell/Lenovo/Realtek) can default Chrome to a virtual/loopback device that
 * reports a perfectly healthy MediaStreamTrack — not muted, not ended — while producing exactly
 * zero signal, with the real hardware mic sitting right next to it in the device list, unused. */
export async function listAudioInputDevices(): Promise<AudioInputDevice[]> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((d) => d.kind === "audioinput").map((d) => ({ deviceId: d.deviceId, label: d.label || "Microphone" }));
  } catch {
    return [];
  }
}

export type MicLevelMeter = { getLevel: () => number; stop: () => void };

/** A live 0-1 mic input level off an already-acquired stream. Recording apps show this (or
 * something like it) specifically so a muted/wrong/disconnected mic is obvious immediately, rather
 * than only discovered afterward as a garbled or near-empty transcript. */
export function createMicLevelMeter(stream: MediaStream): MicLevelMeter | null {
  const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) return null;

  const ctx = new AudioContextCtor();
  // A freshly created AudioContext can start "suspended" under a browser's autoplay policy,
  // especially this far into an async chain (getUserMedia + a server round trip already
  // happened) rather than synchronously inside the original click. A suspended context never
  // processes audio at all, so the analyser would report flat silence regardless of whether the
  // mic itself is working — resume it explicitly rather than assuming "running".
  ctx.resume().catch(() => {});
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0.6;
  source.connect(analyser);
  const data = new Uint8Array(analyser.frequencyBinCount);

  function getLevel(): number {
    if (ctx.state !== "running") {
      ctx.resume().catch(() => {});
      return 0;
    }
    analyser.getByteTimeDomainData(data);
    let sumSquares = 0;
    for (let i = 0; i < data.length; i++) {
      const centered = (data[i] - 128) / 128;
      sumSquares += centered * centered;
    }
    return Math.sqrt(sumSquares / data.length);
  }

  function stop() {
    try {
      source.disconnect();
    } catch {}
    ctx.close().catch(() => {});
  }

  return { getLevel, stop };
}

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
