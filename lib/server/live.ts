// The one "now playing" state that overlays read. In memory only: it describes this moment and is gone on restart.
// The browser tab that plays music publishes it (opt-in, Settings -> Lyrics outside the app); readers get it over SSE.

import { EMPTY_SONG, type LiveClock, type LivePost, type LiveState } from '../live/types';

type Listener = (kind: 'song' | 'clock', s: LiveState) => void;
const g = globalThis as unknown as { __lyricscapeLive?: { state: LiveState; subs: Set<Listener> } };
const live = (g.__lyricscapeLive ??= { state: { song: EMPTY_SONG, clock: { playing: false, lyricMs: 0, at: 0, trackOffsetMs: 0 }, seq: 0 }, subs: new Set() });

export function liveState(): LiveState {
  return live.state;
}

export function applyLive(p: LivePost): LiveState {
  const clock: LiveClock = p.clock;
  live.state = p.kind === 'song' ? { song: p.song, clock, seq: live.state.seq + 1 } : { ...live.state, clock, seq: live.state.seq + 1 };
  for (const l of live.subs) {
    try {
      l(p.kind, live.state);
    } catch {
      /* a dead stream must not break others */
    }
  }
  return live.state;
}

export function onLive(fn: Listener): () => void {
  live.subs.add(fn);
  return () => live.subs.delete(fn);
}

export function liveReaders(): number {
  return live.subs.size;
}

/** for tests */
export function resetLive() {
  live.state = { song: EMPTY_SONG, clock: { playing: false, lyricMs: 0, at: 0, trackOffsetMs: 0 }, seq: 0 };
  live.subs.clear();
}
