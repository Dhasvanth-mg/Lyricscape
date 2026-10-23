// QueueManager: pure, serializable app-level queue.
// Distinguishes the *app* queue from any provider-side (e.g. Spotify) remote queue.

import type { RepeatMode, Track } from '../types';
import { mulberry32 } from '../kinetic/util';

export type QueueEntry = { qid: string; track: Track };

export type QueueState = {
  entries: QueueEntry[];
  /** qid of the currently loaded entry (or null) */
  currentQid: string | null;
  shuffle: boolean;
  /** qids in play order when shuffle is on */
  order: string[];
  repeat: RepeatMode;
  seed: number;
};

let counter = 0;
export function newQid(): string {
  counter += 1;
  return `q${Date.now().toString(36)}${counter.toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export const emptyQueue = (): QueueState => ({
  entries: [],
  currentQid: null,
  shuffle: false,
  order: [],
  repeat: 'off',
  seed: 1,
});

function shuffled(qids: string[], keepFirst: string | null, seed: number): string[] {
  const rest = qids.filter((q) => q !== keepFirst);
  const rnd = mulberry32(seed);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [rest[i], rest[j]] = [rest[j]!, rest[i]!];
  }
  return keepFirst ? [keepFirst, ...rest] : rest;
}

function rebuildOrder(s: QueueState): QueueState {
  const qids = s.entries.map((e) => e.qid);
  return { ...s, order: s.shuffle ? shuffled(qids, s.currentQid, s.seed) : qids };
}

export function playOrder(s: QueueState): string[] {
  return s.shuffle ? s.order : s.entries.map((e) => e.qid);
}

export function currentEntry(s: QueueState): QueueEntry | null {
  return s.entries.find((e) => e.qid === s.currentQid) ?? null;
}

export function currentIndex(s: QueueState): number {
  return s.entries.findIndex((e) => e.qid === s.currentQid);
}

export function setQueue(s: QueueState, tracks: Track[], startIndex = 0): QueueState {
  const entries = tracks.map((track) => ({ qid: newQid(), track }));
  const start = entries[Math.min(Math.max(0, startIndex), entries.length - 1)];
  return rebuildOrder({ ...s, entries, currentQid: start?.qid ?? null, seed: s.seed + 1 });
}

export function enqueue(s: QueueState, tracks: Track[], where: 'end' | 'next' = 'end'): QueueState {
  const added = tracks.map((track) => ({ qid: newQid(), track }));
  if (where === 'end' || !s.currentQid) {
    return rebuildKeep({ ...s, entries: [...s.entries, ...added], currentQid: s.currentQid ?? added[0]?.qid ?? null }, added, 'end');
  }
  const idx = currentIndex(s);
  const entries = [...s.entries.slice(0, idx + 1), ...added, ...s.entries.slice(idx + 1)];
  return rebuildKeep({ ...s, entries }, added, 'next');
}

/** Insert newly added entries into the shuffle order without reshuffling what has been decided. */
function rebuildKeep(s: QueueState, added: QueueEntry[], where: 'end' | 'next'): QueueState {
  if (!s.shuffle) return { ...s, order: s.entries.map((e) => e.qid) };
  const known = new Set(s.order);
  const kept = s.order.filter((q) => s.entries.some((e) => e.qid === q));
  const addQ = added.map((a) => a.qid).filter((q) => !known.has(q));
  if (where === 'next' && s.currentQid) {
    const at = kept.indexOf(s.currentQid);
    kept.splice(at + 1, 0, ...addQ);
  } else kept.push(...addQ);
  return { ...s, order: kept };
}

export function removeEntry(s: QueueState, qid: string): { state: QueueState; removedCurrent: boolean } {
  const wasCurrent = s.currentQid === qid;
  let currentQid = s.currentQid;
  if (wasCurrent) {
    const order = playOrder(s);
    const i = order.indexOf(qid);
    currentQid = order[i + 1] ?? order[i - 1] ?? null;
  }
  const entries = s.entries.filter((e) => e.qid !== qid);
  return { state: { ...s, entries, currentQid, order: s.order.filter((q) => q !== qid) }, removedCurrent: wasCurrent };
}

export function moveEntry(s: QueueState, qid: string, toIndex: number): QueueState {
  const from = s.entries.findIndex((e) => e.qid === qid);
  if (from < 0) return s;
  const entries = [...s.entries];
  const [item] = entries.splice(from, 1);
  entries.splice(Math.min(Math.max(0, toIndex), entries.length), 0, item!);
  return { ...s, entries, order: s.shuffle ? s.order : entries.map((e) => e.qid) };
}

export function jumpTo(s: QueueState, qid: string): QueueState {
  if (!s.entries.some((e) => e.qid === qid)) return s;
  return { ...s, currentQid: qid };
}

export function setShuffle(s: QueueState, on: boolean): QueueState {
  if (s.shuffle === on) return s;
  return rebuildOrder({ ...s, shuffle: on, seed: s.seed + 1 });
}

export function setRepeat(s: QueueState, repeat: RepeatMode): QueueState {
  return { ...s, repeat };
}

/**
 * Which entry plays after the current one?
 * `auto` is true when the previous track ended on its own (repeat-one applies); a manual "next" skips it.
 */
export function nextQid(s: QueueState, auto: boolean): string | null {
  const order = playOrder(s);
  if (order.length === 0) return null;
  if (auto && s.repeat === 'one' && s.currentQid) return s.currentQid;
  const i = s.currentQid ? order.indexOf(s.currentQid) : -1;
  if (i + 1 < order.length) return order[i + 1]!;
  if (s.repeat === 'all' || (!auto && s.repeat === 'one')) return order[0]!;
  return null;
}

/** Previous: caller decides whether to restart the current track instead (> 3s in). */
export function prevQid(s: QueueState): string | null {
  const order = playOrder(s);
  if (order.length === 0) return null;
  const i = s.currentQid ? order.indexOf(s.currentQid) : -1;
  if (i > 0) return order[i - 1]!;
  return s.repeat === 'all' ? order[order.length - 1]! : (s.currentQid ?? null);
}

export function upcoming(s: QueueState): QueueEntry[] {
  const order = playOrder(s);
  const i = s.currentQid ? order.indexOf(s.currentQid) : -1;
  const byQid = new Map(s.entries.map((e) => [e.qid, e]));
  return order.slice(i + 1).map((q) => byQid.get(q)!).filter(Boolean);
}

/** Replace everything after the current entry (used by party playback to follow the live party queue). */
export function replaceUpcoming(s: QueueState, tracks: Track[]): QueueState {
  const idx = s.entries.findIndex((e) => e.qid === s.currentQid);
  const head = idx >= 0 ? s.entries.slice(0, idx + 1) : [];
  const entries = [...head, ...tracks.map((track) => ({ qid: newQid(), track }))];
  return { ...s, entries, shuffle: false, order: entries.map((e) => e.qid), currentQid: s.currentQid ?? entries[0]?.qid ?? null };
}
