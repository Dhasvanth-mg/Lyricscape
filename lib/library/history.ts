// Songs played on this device, kept in the local library (IndexedDB) for the home page.
// Only track metadata is stored (as the library already stores it), never audio. Cleared with the rest of the local library.

import type { Track } from '../types';
import { kvGet, kvSet } from './db';
import { addPlay, type PlayRecord } from './recommend';

const KEY = 'history.v1';
export const HISTORY_EVENT = 'lyricscape:history';

export async function loadHistory(): Promise<PlayRecord[]> {
  return (await kvGet<PlayRecord[]>(KEY)) ?? [];
}

export async function recordPlay(track: Track, at = Date.now()) {
  await kvSet(KEY, addPlay(await loadHistory(), track, at));
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(HISTORY_EVENT));
}

export async function clearHistory() {
  await kvSet(KEY, []);
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(HISTORY_EVENT));
}
