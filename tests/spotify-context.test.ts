import { describe, expect, it } from 'vitest';
import { spotifyContextOf } from '@/lib/player/controller';
import { setQueue, emptyQueue } from '@/lib/player/queue';
import type { Track } from '@/lib/types';

const sp = (id: string) => ({ id: `spotify:${id}`, provider: 'spotify', providerTrackId: id, title: id, artists: ['a'], durationMs: 1000 }) as Track;
const local = (id: string) => ({ id: `demo:${id}`, provider: 'demo', title: id, artists: ['a'], durationMs: 1000 }) as Track;

describe('Spotify gets the whole queue', () => {
  it('sends the Spotify songs around the current one, in order, without non-Spotify songs', () => {
    const q = setQueue(emptyQueue(), [sp('a'), local('x'), sp('b'), sp('c')], 2);
    expect(spotifyContextOf(q, q.currentQid!)).toEqual(['a', 'b', 'c']);
  });
  it('keeps the current song unique and caps the list', () => {
    const q = setQueue(emptyQueue(), [sp('a'), sp('b'), sp('a'), sp('c')], 1);
    expect(spotifyContextOf(q, q.currentQid!)).toEqual(['a', 'b', 'a', 'c'].filter((x, i) => !(x === 'b' && i !== 1)));
    const big = setQueue(emptyQueue(), Array.from({ length: 150 }, (_, i) => sp(`t${i}`)), 50);
    const ctx = spotifyContextOf(big, big.currentQid!);
    expect(ctx).toHaveLength(100);
    expect(ctx[20]).toBe('t50');
  });
});
