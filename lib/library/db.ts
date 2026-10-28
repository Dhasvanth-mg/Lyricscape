// Browser-local persistence (IndexedDB): imported audio files, per-track timed lyrics
// (for ANY provider, including Spotify), playlists. No cloud involved.

import type { Track } from '../types';

const DB_NAME = 'lyricscape';
const DB_VERSION = 1;

export type StoredLocalTrack = {
  id: string; // canonical track id: licensed:<sha256 prefix>
  track: Track; // audioUrl is a sentinel `idb:<id>`
  blob: Blob;
  artwork?: Blob;
  sha256: string;
  addedAt: number;
  fileName: string;
  size: number;
};

export type StoredLyrics = {
  trackId: string;
  lrc: string; // enhanced LRC text (canonical storage format)
  source: string; // provenance, e.g. "user-supplied", "LRCLIB (community)"
  synced: boolean;
  savedAt: number;
  /** LRCLIB record id, so "try another version" can skip what was already shown */
  versionId?: number;
  tried?: number[];
  /**
   * Who made these timestamps. 'lrclib' / 'musixmatch' / 'lyricsfile' came from a lookup and may be swapped;
   * 'user' (pasted/imported), 'edited' (hand-timed) and 'auto-aligned' belong to the user and are never replaced
   * by a lookup. Absent on records saved before this field existed: treated as the user's (never overwritten).
   */
  origin?: 'lrclib' | 'musixmatch' | 'lyricsfile' | 'user' | 'edited' | 'auto-aligned';
  /** how well the looked-up recording matched the track, for the UI */
  match?: import('../types').MatchInfo;
};

export type StoredPlaylist = { id: string; title: string; trackIds: string[]; tracks: Track[]; createdAt: number; updatedAt: number };

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB is unavailable in this browser.'));
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('localTracks')) db.createObjectStore('localTracks', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('lyrics')) db.createObjectStore('lyrics', { keyPath: 'trackId' });
      if (!db.objectStoreNames.contains('playlists')) db.createObjectStore('playlists', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error ?? new Error('Could not open the local library.'));
    };
  });
  return dbPromise;
}

function wrap<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function store(name: string, mode: IDBTransactionMode) {
  const db = await open();
  return db.transaction(name, mode).objectStore(name);
}

// ---- local tracks ---------------------------------------------------------------------
export async function putLocalTrack(t: StoredLocalTrack) {
  await wrap((await store('localTracks', 'readwrite')).put(t));
}
export async function getLocalTrack(id: string): Promise<StoredLocalTrack | undefined> {
  return wrap((await store('localTracks', 'readonly')).get(id));
}
export async function listLocalTracks(): Promise<StoredLocalTrack[]> {
  const all = await wrap((await store('localTracks', 'readonly')).getAll());
  return (all as StoredLocalTrack[]).sort((a, b) => b.addedAt - a.addedAt);
}
export async function deleteLocalTrack(id: string) {
  await wrap((await store('localTracks', 'readwrite')).delete(id));
}

// ---- lyrics (keyed by canonical track id, any provider) ------------------------------------
export async function saveLyrics(l: StoredLyrics) {
  await wrap((await store('lyrics', 'readwrite')).put(l));
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('lyricscape:lyrics', { detail: l.trackId }));
}
export async function getLyrics(trackId: string): Promise<StoredLyrics | undefined> {
  try {
    return await wrap((await store('lyrics', 'readonly')).get(trackId));
  } catch {
    return undefined;
  }
}
export async function deleteLyrics(trackId: string) {
  await wrap((await store('lyrics', 'readwrite')).delete(trackId));
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('lyricscape:lyrics', { detail: trackId }));
}
export async function listLyricsIds(): Promise<string[]> {
  return (await wrap((await store('lyrics', 'readonly')).getAllKeys())) as string[];
}

// ---- playlists -------------------------------------------------------------------------------
export async function listPlaylists(): Promise<StoredPlaylist[]> {
  const all = (await wrap((await store('playlists', 'readonly')).getAll())) as StoredPlaylist[];
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}
export async function getPlaylist(id: string) {
  return (await wrap((await store('playlists', 'readonly')).get(id))) as StoredPlaylist | undefined;
}
export async function putPlaylist(p: StoredPlaylist) {
  await wrap((await store('playlists', 'readwrite')).put({ ...p, updatedAt: Date.now() }));
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('lyricscape:playlists'));
}
export async function deletePlaylist(id: string) {
  await wrap((await store('playlists', 'readwrite')).delete(id));
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('lyricscape:playlists'));
}

// ---- kv ---------------------------------------------------------------------------------------
export async function kvGet<T>(key: string): Promise<T | undefined> {
  try {
    return (await wrap((await store('kv', 'readonly')).get(key))) as T | undefined;
  } catch {
    return undefined;
  }
}
export async function kvSet(key: string, value: unknown) {
  await wrap((await store('kv', 'readwrite')).put(value, key));
}

export async function clearAllLocalData() {
  for (const name of ['localTracks', 'lyrics', 'playlists', 'kv']) await wrap((await store(name, 'readwrite')).clear());
}
