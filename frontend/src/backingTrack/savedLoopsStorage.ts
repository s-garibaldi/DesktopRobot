/**
 * IndexedDB storage for saved backing track loops.
 * Persists MP3 audio and metadata in the browser.
 */

import type { BackingTrackSpec } from './types';

const DB_NAME = 'backing-track-loops';
const DB_VERSION = 1;
const STORE_NAME = 'loops';

export interface SavedLoopMeta {
  id: string;
  name: string;
  createdAt: number;
  spec?: BackingTrackSpec;
}

export interface SavedLoop extends SavedLoopMeta {
  audio: ArrayBuffer;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

function specToDefaultName(spec: BackingTrackSpec): string {
  const parts: string[] = [];
  if (spec.chords?.length) parts.push(spec.chords.join(' '));
  if (spec.bpm) parts.push(`${spec.bpm} bpm`);
  if (spec.style) parts.push(spec.style);
  return parts.length ? parts.join(' • ') : 'Backing track';
}

/** Save a loop. Returns the stored id. */
export async function saveLoop(
  audio: ArrayBuffer,
  options: { name?: string; spec?: BackingTrackSpec } = {}
): Promise<string> {
  const db = await openDb();
  const id = crypto.randomUUID();
  const name = options.name ?? (options.spec ? specToDefaultName(options.spec) : 'Backing track');
  const createdAt = Date.now();

  const record: SavedLoop = {
    id,
    name,
    createdAt,
    spec: options.spec,
    audio,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.add(record);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db.close();
      resolve(id);
    };
  });
}

/** Load a saved loop by id. */
export async function loadLoop(id: string): Promise<SavedLoop | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db.close();
      resolve((request.result as SavedLoop) ?? null);
    };
  });
}

/** List all saved loops (metadata only, no audio). */
export async function listSavedLoops(): Promise<SavedLoopMeta[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db.close();
      const rows = (request.result as SavedLoop[]) ?? [];
      const meta: SavedLoopMeta[] = rows.map(({ id, name, createdAt, spec }) => ({
        id,
        name,
        createdAt,
        spec,
      }));
      meta.sort((a, b) => b.createdAt - a.createdAt);
      resolve(meta);
    };
  });
}

/** Delete a saved loop. */
export async function deleteSavedLoop(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db.close();
      resolve();
    };
  });
}
