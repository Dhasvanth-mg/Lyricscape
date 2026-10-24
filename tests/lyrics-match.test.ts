import { describe, expect, it } from 'vitest';
import { normalizeTitle, primaryArtist, rankCandidates, scoreCandidate, type LrclibRecord } from '@/lib/lyrics/match';
import { cleanLyricRows, expectedSungMs, syllables } from '@/lib/lyrics/words';
import { fromPlainText, parseLrc, validateDocument } from '@/lib/lyrics/parse';

const rec = (id: number, trackName: string, artistName: string, duration: number, synced = true, extra: Partial<LrclibRecord> = {}): LrclibRecord => ({
  id,
  trackName,
  artistName,
  duration,
  albumName: 'x',
  plainLyrics: 'la la',
  syncedLyrics: synced ? '[00:01.00] la la' : null,
  ...extra,
});

describe('title / artist normalisation', () => {
  it('strips remaster, live, feat and version noise', () => {
    expect(normalizeTitle('Blinding Lights - Remastered 2019')).toBe('blinding lights');
    expect(normalizeTitle('Levitating (feat. DaBaby)')).toBe('levitating');
    expect(normalizeTitle('Come Together - Live at Wembley')).toBe('come together');
    expect(normalizeTitle('Señorita')).toBe('senorita');
    expect(normalizeTitle("Don't Stop Believin'")).toBe('don t stop believin');
  });
  it('takes the lead artist', () => {
    expect(primaryArtist('Drake, Future')).toBe('drake');
    expect(primaryArtist('Dua Lipa feat. DaBaby')).toBe('dua lipa');
    expect(primaryArtist('Simon & Garfunkel')).toBe('simon');
  });
});

describe('choosing the right record', () => {
  const q = { title: 'Blinding Lights', artist: 'The Weeknd', album: 'After Hours', duration: 200 };

  it('prefers a synced match with the right length over a plain one', () => {
    const ranked = rankCandidates([rec(1, 'Blinding Lights', 'The Weeknd', 200, false), rec(2, 'Blinding Lights', 'The Weeknd', 200, true)], q);
    expect(ranked[0]!.record.id).toBe(2);
  });

  it('prefers the version closest in length (that is what keeps timing in step)', () => {
    const ranked = rankCandidates([rec(1, 'Blinding Lights', 'The Weeknd', 204), rec(2, 'Blinding Lights', 'The Weeknd', 200), rec(3, 'Blinding Lights', 'The Weeknd', 203)], q);
    expect(ranked.map((r) => r.record.id)).toEqual([2, 3, 1]);
  });

  it('rejects other recordings, covers by other artists and instrumentals', () => {
    expect(scoreCandidate(rec(1, 'Blinding Lights', 'The Weeknd', 285), q)).toBeNull(); // extended/live: timing would drift
    expect(scoreCandidate(rec(2, 'Blinding Lights', 'Some Cover Band', 200), q)).toBeNull();
    expect(scoreCandidate(rec(3, 'Different Song', 'The Weeknd', 200), q)).toBeNull();
    expect(scoreCandidate(rec(4, 'Blinding Lights', 'The Weeknd', 200, true, { instrumental: true }), q)).toBeNull();
    expect(scoreCandidate(rec(5, 'Blinding Lights', 'The Weeknd', 200, false, { plainLyrics: null }), q)).toBeNull();
  });

  it('matches through remaster tags and featured artists', () => {
    const ranked = rankCandidates([rec(1, 'Levitating (feat. DaBaby)', 'Dua Lipa, DaBaby', 203)], { title: 'Levitating', artist: 'Dua Lipa', duration: 203 });
    expect(ranked).toHaveLength(1);
    const remaster = rankCandidates([rec(2, 'Africa', 'Toto', 295)], { title: 'Africa - Remastered 2014', artist: 'Toto', duration: 295 });
    expect(remaster).toHaveLength(1);
  });

  it('lets the player ask for another version without repeating one', () => {
    const records = [rec(1, 'Blinding Lights', 'The Weeknd', 200), rec(2, 'Blinding Lights', 'The Weeknd', 201), rec(3, 'Blinding Lights', 'The Weeknd', 203)];
    expect(rankCandidates(records, q)[0]!.record.id).toBe(1);
    expect(rankCandidates(records, q, new Set([1]))[0]!.record.id).toBe(2);
    expect(rankCandidates(records, q, new Set([1, 2]))[0]!.record.id).toBe(3);
    expect(rankCandidates(records, q, new Set([1, 2, 3]))).toEqual([]);
  });

  it('works for non-Latin metadata', () => {
    const ranked = rankCandidates([rec(1, 'Tum Hi Ho', 'Arijit Singh', 261)], { title: 'Tum Hi Ho', artist: 'Arijit Singh', duration: 262 });
    expect(ranked).toHaveLength(1);
  });
});

describe('word timing from text', () => {
  it('counts syllables', () => {
    expect(syllables('love')).toBe(1);
    expect(syllables('beautiful')).toBe(3);
    expect(syllables('little')).toBe(2);
    expect(syllables('walked')).toBe(1);
    expect(syllables('wanted')).toBe(2);
    expect(syllables('!!')).toBeGreaterThan(0);
  });

  it('drops section headers and repeat markers, remembers stanza breaks', () => {
    const { rows, stanzaBefore } = cleanLyricRows('[Verse 1]\nfirst line\nsecond line (x2)\n\n[Chorus]\nhook line\n\nChorus:\nlast');
    expect(rows).toEqual(['first line', 'second line', 'hook line', 'last']);
    expect(stanzaBefore).toEqual([false, false, true, true]);
  });

  it('gives long words more time than short ones', () => {
    const doc = parseLrc('[00:10.00] I love extraordinary people\n[00:16.00] next');
    const w = doc.lines[0]!.words.map((x) => x.endMs - x.startMs);
    expect(w[2]!).toBeGreaterThan(w[0]!);
    expect(w[2]!).toBeGreaterThan(w[1]!);
  });

  it('does not hold a line across a long instrumental gap, and says its end is a guess', () => {
    const doc = parseLrc('[00:10.00] hello there\n[00:40.00] after the solo');
    expect(doc.lines[0]!.endMs).toBeLessThan(40000);
    expect(doc.lines[0]!.endMs).toBeGreaterThanOrEqual(10000 + expectedSungMs(['hello', 'there']));
    expect(doc.lines[0]!.endSource).toBe('estimated');
  });

  it('still fills the whole gap on a tightly packed song', () => {
    const doc = parseLrc('[00:10.00] this is a fairly long line of words\n[00:13.50] next');
    expect(doc.lines[0]!.endMs).toBe(13500);
  });

  it('spreads plain lyrics by length and ignores headers', () => {
    const doc = fromPlainText('[Verse]\nshort\nthis one is a much longer line to sing\n', 120000);
    expect(doc.lines).toHaveLength(2);
    const a = doc.lines[0]!.endMs - doc.lines[0]!.startMs;
    const b = doc.lines[1]!.endMs - doc.lines[1]!.startMs;
    expect(b).toBeGreaterThan(a * 2);
    expect(validateDocument(doc)).toEqual([]);
  });
});

describe('timing consensus: a lone mis-timed version does not win on length alone', () => {
  const lrc = (offsetMs: number, lines = 8) =>
    Array.from({ length: lines }, (_, i) => {
      const t = 5000 + i * 4000 + offsetMs;
      return `[${String(Math.floor(t / 60000)).padStart(2, '0')}:${((t % 60000) / 1000).toFixed(2).padStart(5, '0')}] line ${i + 1} words here`;
    }).join('\n');
  const mk = (id: number, duration: number, offsetMs: number): LrclibRecord => ({ id, trackName: 'Mine', artistName: 'Bazzi', albumName: 'x', duration, plainLyrics: 'x', syncedLyrics: lrc(offsetMs) });
  const q = { title: 'Mine', artist: 'Bazzi', album: 'COSMIC', duration: 131 };

  it('flags a version that is seconds away from where independent versions agree (shape seen on a real song)', async () => {
    const { timingOutlierIds } = await import('@/lib/lyrics/match');
    const recs = [mk(1, 131, 0), mk(2, 131, 0), mk(3, 131, -60), mk(4, 131, 40), mk(5, 131, -3790)];
    expect([...timingOutlierIds(recs)]).toEqual([5]);
  });

  it('prefers the consensus version even when the outlier matches the track length best', () => {
    const recs = [mk(5, 131, -3790), mk(1, 133, 0), mk(3, 134, -60), mk(4, 134, 40)];
    expect(rankCandidates(recs, q)[0]!.record.id).not.toBe(5);
    // without the outlier rule it would have won on length (131 vs 133/134)
  });

  it('does nothing when there are not enough independent opinions to outvote anyone', async () => {
    const { timingOutlierIds } = await import('@/lib/lyrics/match');
    expect(timingOutlierIds([mk(1, 131, 0), mk(2, 131, -3000)]).size).toBe(0);
    expect(timingOutlierIds([mk(1, 131, 0), mk(2, 131, 0), mk(3, 131, 0)]).size).toBe(0); // copies are one opinion
  });
});
