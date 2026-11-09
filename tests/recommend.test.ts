import { describe, expect, it } from 'vitest';
import type { Track } from '@/lib/types';
import { addPlay, quickPicks, recommend } from '@/lib/library/recommend';

const DAY = 86_400_000;
const NOW = 1_800_000_000_000;
const t = (id: string, artist: string, bpm?: number, genres?: string[]): Track => ({ id, provider: 'licensed', title: id.toUpperCase(), artists: [artist], durationMs: 1, bpm, genres });

describe('play history', () => {
  it('puts the latest play first, counts repeats and caps the list', () => {
    let h = addPlay([], t('a', 'x'), 1);
    h = addPlay(h, t('b', 'y'), 2);
    h = addPlay(h, t('a', 'x'), 3);
    expect(h.map((r) => [r.track.id, r.plays, r.lastPlayedAt])).toEqual([
      ['a', 2, 3],
      ['b', 1, 2],
    ]);
    expect(addPlay(h, t('c', 'z'), 4, 2).map((r) => r.track.id)).toEqual(['c', 'a']);
  });
});

describe('recommend', () => {
  const pool = [t('same-artist', 'Nova', 140), t('same-tempo', 'Other', 121), t('far', 'Else', 70), t('just-played', 'Nova', 120)];

  it('ranks the same artist and a close tempo above unrelated songs, and says why', () => {
    const history = addPlay([], t('just-played', 'Nova', 120), NOW - 60_000);
    const recs = recommend(pool, history, { now: NOW });
    expect(recs.map((r) => r.track.id).slice(0, 2)).toEqual(['same-artist', 'same-tempo']);
    expect(recs[0]!.reason).toBe('Same artist as JUST-PLAYED');
    expect(recs[1]!.reason).toBe('Close to your 120 BPM pace');
    expect(recs.at(-1)!.track.id).toBe('just-played');
  });

  it('follows genres when the history has them', () => {
    const history = addPlay([], t('h', 'Someone', undefined, ['synthwave']), NOW);
    const recs = recommend([t('p', 'A', undefined, ['Synthwave']), t('q', 'B', undefined, ['jazz'])], history, { now: NOW });
    expect(recs[0]!.track.id).toBe('p');
    expect(recs[0]!.reason).toBe('More Synthwave');
  });

  it('weights recent listening over old listening', () => {
    let history = addPlay([], t('old', 'Old Artist'), NOW - 30 * DAY);
    history = addPlay(history, t('old', 'Old Artist'), NOW - 30 * DAY);
    history = addPlay(history, t('new', 'New Artist'), NOW);
    const recs = recommend([t('by-old', 'Old Artist'), t('by-new', 'New Artist')], history, { now: NOW });
    expect(recs[0]!.track.id).toBe('by-new');
  });

  it('gives starting picks with no history, is deterministic and removes duplicates', () => {
    const p = [t('b', 'x'), t('a', 'y'), t('a', 'y')];
    const one = recommend(p, [], { now: NOW });
    expect(one.map((r) => r.track.id)).toEqual(['a', 'b']);
    expect(one[0]!.reason).toBe('From your files');
    expect(recommend(p, [], { now: NOW })).toEqual(one);
  });

  it('prefers songs whose lyrics are ready when all else is equal', () => {
    const recs = recommend([t('a', 'x'), t('b', 'y')], [], { now: NOW, withLyrics: new Set(['b']) });
    expect(recs[0]!.track.id).toBe('b');
    expect(recs[0]!.reason).toBe('Lyrics ready');
  });
});

describe('quickPicks', () => {
  it('lists recent favourites first, then fills from the pool without repeats', () => {
    let h = addPlay([], t('a', 'x'), NOW - DAY);
    h = addPlay(h, t('b', 'x'), NOW);
    const picks = quickPicks(h, [t('a', 'x'), t('c', 'x'), t('d', 'x')], NOW, 3);
    expect(picks.map((x) => x.id)).toEqual(['b', 'a', 'c']);
  });
});
