import { describe, expect, it } from 'vitest';
import { PlaybackClock } from '@/lib/player/clock';
import {
  currentEntry,
  emptyQueue,
  enqueue,
  jumpTo,
  moveEntry,
  nextQid,
  playOrder,
  prevQid,
  removeEntry,
  replaceUpcoming,
  setQueue,
  setRepeat,
  setShuffle,
  upcoming,
} from '@/lib/player/queue';
import type { Track } from '@/lib/types';

const mk = (n: number): Track[] =>
  Array.from({ length: n }, (_, i) => ({ id: `demo:t${i}`, provider: 'demo', title: `T${i}`, artists: ['A'], durationMs: 1000 }));

const title = (s: ReturnType<typeof emptyQueue>, qid: string | null) => s.entries.find((e) => e.qid === qid)?.track.title ?? null;

describe('PlaybackClock', () => {
  it('advances with wall time only while playing', () => {
    let t = 0;
    const c = new PlaybackClock(() => t);
    c.reset(1000, true);
    t += 500;
    expect(c.position()).toBe(1500);
    c.setPlaying(false);
    t += 5000;
    expect(c.position()).toBe(1500);
  });
  it('snaps on large drift, slews on small drift', () => {
    let t = 0;
    const c = new PlaybackClock(() => t);
    c.reset(0, true);
    t += 1000;
    c.sync(1050, true); // 50ms ahead: slew, not snap
    expect(c.position()).toBeGreaterThan(1000);
    expect(c.position()).toBeLessThan(1050);
    c.sync(9000, true); // seek elsewhere
    expect(c.position()).toBe(9000);
  });
});

describe('queue', () => {
  it('plays in order, stops at the end with repeat off, wraps with repeat all', () => {
    let q = setQueue(emptyQueue(), mk(3), 0);
    expect(title(q, q.currentQid)).toBe('T0');
    q = jumpTo(q, nextQid(q, true)!);
    q = jumpTo(q, nextQid(q, true)!);
    expect(title(q, q.currentQid)).toBe('T2');
    expect(nextQid(q, true)).toBeNull();
    q = setRepeat(q, 'all');
    expect(title(q, nextQid(q, true))).toBe('T0');
  });

  it('repeat-one only applies when a track ends by itself', () => {
    let q = setQueue(emptyQueue(), mk(3), 1);
    q = setRepeat(q, 'one');
    expect(title(q, nextQid(q, true))).toBe('T1');
    expect(title(q, nextQid(q, false))).toBe('T2');
  });

  it('previous goes back, and wraps only with repeat all', () => {
    let q = setQueue(emptyQueue(), mk(3), 0);
    expect(title(q, prevQid(q))).toBe('T0');
    q = setRepeat(q, 'all');
    expect(title(q, prevQid(q))).toBe('T2');
  });

  it('shuffle keeps the current track first and visits every entry exactly once', () => {
    let q = setQueue(emptyQueue(), mk(12), 4);
    q = setShuffle(q, true);
    const order = playOrder(q);
    expect(order[0]).toBe(q.currentQid);
    expect(new Set(order).size).toBe(12);
    // turning shuffle off restores user order
    q = setShuffle(q, false);
    expect(playOrder(q).map((id) => title(q, id))).toEqual(mk(12).map((t) => t.title));
  });

  it('enqueue next/end, including while shuffled', () => {
    let q = setQueue(emptyQueue(), mk(3), 0);
    q = enqueue(q, [{ ...mk(1)[0]!, title: 'NEXT' }], 'next');
    expect(q.entries.map((e) => e.track.title)).toEqual(['T0', 'NEXT', 'T1', 'T2']);
    q = enqueue(q, [{ ...mk(1)[0]!, title: 'END' }], 'end');
    expect(upcoming(q).map((e) => e.track.title)).toEqual(['NEXT', 'T1', 'T2', 'END']);
    q = setShuffle(q, true);
    q = enqueue(q, [{ ...mk(1)[0]!, title: 'SH-NEXT' }], 'next');
    expect(title(q, playOrder(q)[1]!)).toBe('SH-NEXT');
    expect(new Set(playOrder(q)).size).toBe(q.entries.length);
  });

  it('removing the current entry advances; reordering works', () => {
    let q = setQueue(emptyQueue(), mk(4), 1);
    const cur = q.currentQid!;
    const r = removeEntry(q, cur);
    expect(r.removedCurrent).toBe(true);
    expect(title(r.state, r.state.currentQid)).toBe('T2');
    q = moveEntry(q, q.entries[3]!.qid, 0);
    expect(q.entries.map((e) => e.track.title)).toEqual(['T3', 'T0', 'T1', 'T2']);
    expect(currentEntry(q)?.track.title).toBe('T1');
  });

  it('replaceUpcoming keeps the playing track and swaps what follows', () => {
    let q = setQueue(emptyQueue(), mk(4), 1);
    q = replaceUpcoming(q, [{ ...mk(1)[0]!, title: 'X' }, { ...mk(1)[0]!, title: 'Y' }]);
    expect(q.entries.map((e) => e.track.title)).toEqual(['T0', 'T1', 'X', 'Y']);
    expect(currentEntry(q)?.track.title).toBe('T1');
    expect(upcoming(q).map((e) => e.track.title)).toEqual(['X', 'Y']);
  });

  it('handles an empty queue', () => {
    const q = emptyQueue();
    expect(nextQid(q, true)).toBeNull();
    expect(prevQid(q)).toBeNull();
    expect(currentEntry(q)).toBeNull();
  });
});
