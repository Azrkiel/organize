/**
 * IndexedDB storage for in-progress and finished lecture audio (PLAN.md Phase 9 task 2).
 *
 * Browser-only glue around the native `indexedDB` API — there's no meaningful way to unit-test
 * this in Vitest's jsdom environment (no real IndexedDB), so it's covered by live browser
 * verification instead, the same way Phase 8's service worker was.
 *
 * Chunks are keyed as `${lectureId}#${segment}#${chunk}` (zero-padded so lexicographic order
 * matches numeric order), which lets every "get this lecture" / "get this segment" query below
 * be a single IDBKeyRange.bound() prefix scan instead of a secondary index.
 */

const DB_NAME = "organize-lecture-audio";
const DB_VERSION = 1;
const CHUNKS_STORE = "chunks";
const RECORDINGS_STORE = "recordings";

export type RecordingMeta = {
  lectureId: string;
  courseId: string | null;
  title: string;
  mimeType: string;
  segmentIndex: number;
  startedAt: number; // epoch ms
  recording: boolean; // false once explicitly stopped; a true row still present after reload = crash recovery
};

type ChunkRecord = {
  id: string;
  lectureId: string;
  segmentIndex: number;
  chunkIndex: number;
  blob: Blob;
  size: number;
  savedAt: number;
};

function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

function chunkId(lectureId: string, segmentIndex: number, chunkIndex: number): string {
  return `${lectureId}#${pad(segmentIndex, 4)}#${pad(chunkIndex, 6)}`;
}

function lecturePrefixRange(lectureId: string): IDBKeyRange {
  return IDBKeyRange.bound(`${lectureId}#`, `${lectureId}#￿`);
}

function segmentPrefixRange(lectureId: string, segmentIndex: number): IDBKeyRange {
  const prefix = `${lectureId}#${pad(segmentIndex, 4)}#`;
  return IDBKeyRange.bound(prefix, `${prefix}￿`);
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(CHUNKS_STORE)) db.createObjectStore(CHUNKS_STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(RECORDINGS_STORE)) db.createObjectStore(RECORDINGS_STORE, { keyPath: "lectureId" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function promisify<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveChunk(lectureId: string, segmentIndex: number, chunkIndex: number, blob: Blob): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(CHUNKS_STORE, "readwrite");
  const record: ChunkRecord = {
    id: chunkId(lectureId, segmentIndex, chunkIndex),
    lectureId,
    segmentIndex,
    chunkIndex,
    blob,
    size: blob.size,
    savedAt: Date.now(),
  };
  tx.objectStore(CHUNKS_STORE).put(record);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** All chunks for one ~10-minute segment, in order, ready to be concatenated into one decodable file. */
export async function getSegmentChunks(lectureId: string, segmentIndex: number): Promise<Blob[]> {
  const db = await openDb();
  const tx = db.transaction(CHUNKS_STORE, "readonly");
  const records = await promisify<ChunkRecord[]>(tx.objectStore(CHUNKS_STORE).getAll(segmentPrefixRange(lectureId, segmentIndex)));
  records.sort((a, b) => a.chunkIndex - b.chunkIndex);
  return records.map((r) => r.blob);
}

/** Every segment index that has at least one saved chunk, ascending. */
export async function getSegmentIndexes(lectureId: string): Promise<number[]> {
  const db = await openDb();
  const tx = db.transaction(CHUNKS_STORE, "readonly");
  const records = await promisify<ChunkRecord[]>(tx.objectStore(CHUNKS_STORE).getAll(lecturePrefixRange(lectureId)));
  return [...new Set(records.map((r) => r.segmentIndex))].sort((a, b) => a - b);
}

export async function getLectureAudioBytes(lectureId: string): Promise<number> {
  const db = await openDb();
  const tx = db.transaction(CHUNKS_STORE, "readonly");
  const records = await promisify<ChunkRecord[]>(tx.objectStore(CHUNKS_STORE).getAll(lecturePrefixRange(lectureId)));
  return records.reduce((sum, r) => sum + r.size, 0);
}

/** Every distinct lecture id that has at least one stored audio chunk on this device. */
export async function getAllLectureIdsWithAudio(): Promise<string[]> {
  const db = await openDb();
  const tx = db.transaction(CHUNKS_STORE, "readonly");
  const records = await promisify<ChunkRecord[]>(tx.objectStore(CHUNKS_STORE).getAll());
  return [...new Set(records.map((r) => r.lectureId))];
}

/** Total local audio across every lecture — the Settings storage readout (PLAN.md Phase 9 task 7). */
export async function getTotalAudioBytes(): Promise<number> {
  const db = await openDb();
  const tx = db.transaction(CHUNKS_STORE, "readonly");
  const records = await promisify<ChunkRecord[]>(tx.objectStore(CHUNKS_STORE).getAll());
  return records.reduce((sum, r) => sum + r.size, 0);
}

export async function deleteLectureAudio(lectureId: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction([CHUNKS_STORE, RECORDINGS_STORE], "readwrite");
  const chunkStore = tx.objectStore(CHUNKS_STORE);
  const keys = await promisify<IDBValidKey[]>(chunkStore.getAllKeys(lecturePrefixRange(lectureId)));
  for (const key of keys) chunkStore.delete(key);
  tx.objectStore(RECORDINGS_STORE).delete(lectureId);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Deletes every stored audio chunk across all lectures — "Delete all transcribed audio" (task 7). */
export async function deleteAllAudio(): Promise<void> {
  const db = await openDb();
  const tx = db.transaction([CHUNKS_STORE, RECORDINGS_STORE], "readwrite");
  tx.objectStore(CHUNKS_STORE).clear();
  tx.objectStore(RECORDINGS_STORE).clear();
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveRecordingMeta(meta: RecordingMeta): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(RECORDINGS_STORE, "readwrite");
  tx.objectStore(RECORDINGS_STORE).put(meta);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getRecordingMeta(lectureId: string): Promise<RecordingMeta | null> {
  const db = await openDb();
  const tx = db.transaction(RECORDINGS_STORE, "readonly");
  const result = await promisify<RecordingMeta | undefined>(tx.objectStore(RECORDINGS_STORE).get(lectureId));
  return result ?? null;
}

/** Any recording left marked `recording: true` — the crash-recovery case ("reload mid-recording"). */
export async function getInProgressRecordings(): Promise<RecordingMeta[]> {
  const db = await openDb();
  const tx = db.transaction(RECORDINGS_STORE, "readonly");
  const all = await promisify<RecordingMeta[]>(tx.objectStore(RECORDINGS_STORE).getAll());
  return all.filter((r) => r.recording);
}
