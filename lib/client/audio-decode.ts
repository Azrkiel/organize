/**
 * Browser-only audio decoding for the Whisper pipeline (PLAN.md Phase 9 task 4). Not unit-tested
 * for the same reason as lecture-audio-db.ts — jsdom has no real Web Audio implementation.
 */

/** Joins one segment's IndexedDB-stored chunks back into a single decodable file. */
export function concatenateChunks(chunks: Blob[], mimeType: string): Blob {
  return new Blob(chunks, { type: mimeType });
}

/** Root-mean-square level of a PCM buffer, roughly 0 (silence) to ~1 (full scale). Pure math, so
 * unlike the rest of this file it's unit-tested directly — used to skip feeding near-silent audio
 * to Whisper, which otherwise reliably hallucinates a short filler word (classically "you") on
 * silence rather than saying nothing (a well-documented Whisper failure mode). */
export function computeRms(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sumSquares = 0;
  for (let i = 0; i < samples.length; i++) sumSquares += samples[i] * samples[i];
  return Math.sqrt(sumSquares / samples.length);
}

/** Maps a linear 0-1 RMS level to a 0-100 meter percent on a dBFS scale — the same kind of scale
 * OBS/Audacity/any real audio meter uses, rather than a straight linear map. Linear scaling makes
 * normal speech (RMS often only ~0.02-0.1) barely move a bar at all, since most of a mic's usable
 * range sits in the bottom few percent of linear amplitude; a dB scale spreads that out so a
 * quiet-but-real voice visibly moves the meter instead of looking dead. `minDb` is the level
 * mapped to 0% (a very quiet room is usually well below -50dBFS on a laptop mic; 0dBFS is full scale). */
export function rmsToMeterPercent(rms: number, minDb = -55): number {
  if (rms <= 0) return 0;
  const db = 20 * Math.log10(rms);
  const percent = ((db - minDb) / -minDb) * 100;
  return Math.max(0, Math.min(100, percent));
}

/** Decodes a compressed audio Blob (webm/opus, mp4/aac, ...) to 16kHz mono PCM, the format
 * Whisper expects. Uses a real-time AudioContext to decode the container/codec, then an
 * OfflineAudioContext to resample + downmix to 16kHz mono (PLAN.md Phase 9 task 4). */
export async function decodeToMono16k(blob: Blob): Promise<Float32Array> {
  const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) throw new Error("This browser doesn't support Web Audio decoding.");

  const arrayBuffer = await blob.arrayBuffer();
  const decodeCtx = new AudioContextCtor();
  let decoded: AudioBuffer;
  try {
    decoded = await decodeCtx.decodeAudioData(arrayBuffer);
  } finally {
    await decodeCtx.close().catch(() => {});
  }

  const targetSampleRate = 16000;
  const targetLength = Math.max(1, Math.ceil(decoded.duration * targetSampleRate));
  const offlineCtx = new OfflineAudioContext(1, targetLength, targetSampleRate);
  const source = offlineCtx.createBufferSource();
  source.buffer = decoded;
  source.connect(offlineCtx.destination);
  source.start(0);
  const rendered = await offlineCtx.startRendering();
  return rendered.getChannelData(0);
}
