/**
 * IndexedDB offline queue for slide photos (PLAN.md Phase 12 task 3): if the phone is offline
 * when a photo is snapped, the already-compressed blob is queued here instead of failing, and
 * flushed automatically once the browser reports being back online. Browser-only glue, not
 * unit-tested for the same reason as lib/client/lecture-audio-db.ts (no real IndexedDB in vitest).
 */
import { uploadLecturePhoto } from "@/lib/client/lecture-photo-upload";

const DB_NAME = "organize-photo-queue";
const DB_VERSION = 1;
const STORE = "queue";

export type QueuedPhoto = {
  id: string;
  userId: string;
  lectureId: string | null;
  courseId: string | null;
  blob: Blob;
  offsetSeconds: number | null;
  caption: string | null;
  queuedAt: number;
};

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
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

export async function enqueuePhoto(item: Omit<QueuedPhoto, "id" | "queuedAt">): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  const record: QueuedPhoto = { ...item, id: crypto.randomUUID(), queuedAt: Date.now() };
  tx.objectStore(STORE).put(record);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getQueuedPhotos(): Promise<QueuedPhoto[]> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readonly");
  return promisify(tx.objectStore(STORE).getAll());
}

async function removeQueuedPhoto(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).delete(id);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Uploads every queued photo, oldest first, removing each on success. Stops at the first failure
 * (still offline, or a real error) rather than burning through the rest — the next `online` event
 * or manual retry starts again from the front. */
export async function flushPhotoQueue(onPhotoFlushed?: () => void): Promise<void> {
  const items = await getQueuedPhotos();
  for (const item of items.sort((a, b) => a.queuedAt - b.queuedAt)) {
    const result = await uploadLecturePhoto(item);
    if (result.error) return;
    await removeQueuedPhoto(item.id);
    onPhotoFlushed?.();
  }
}
