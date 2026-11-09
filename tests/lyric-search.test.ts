// Lyric search over the song index, and saved lines.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET as search } from '@/app/api/lyrics/search/route';
import { DELETE as unsave, GET as listSaved, POST as save } from '@/app/api/saved-lines/route';
import { songIndex } from '@/lib/server/songIndex';
import { ftsQuery, HIT_CLOSE, HIT_OPEN, queryTerms, searchableLines, snippetParts } from '@/lib/lyrics/search';

let dir = '';
beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'ls-search-'));
});
afterAll(() => {
  songIndex.close();
  rmSync(dir, { recursive: true, force: true });
});
beforeEach(() => {
  vi.stubEnv('LYRICSCAPE_DATA_DIR', dir);
  songIndex.clear();
  for (const l of songIndex.savedLines()) songIndex.unsaveLine(l.id);
});
afterEach(() => vi.unstubAllEnvs());

const lyr = (lrc: string) => ({ lrc, source: 'user', synced: true, origin: 'user' as const, savedAt: 1 });
const putSong = (key: string, title: string, lrc: string) => songIndex.put(key, { song: { provider: 'spotify', title, artists: ['Someone'], durationMs: 200_000 }, features: { lyrics: lyr(lrc) } });
const q = async (s: string) => (await (await search(new Request(`http://x/api/lyrics/search?q=${encodeURIComponent(s)}`))).json()) as { available: boolean; hits: { key: string; title: string; ms: number | null; text: string; snippet: string }[] };

describe('lyric search (pure parts)', () => {
  it('turns lyrics into searchable lines with start times', () => {
    expect(searchableLines('[00:01.00] hello there\n[00:03.50] <00:03.50>big <00:04.00>world')).toEqual([
      { idx: 0, ms: 1000, text: 'hello there' },
      { idx: 1, ms: 3500, text: 'big world' },
    ]);
    expect(searchableLines('just words\nno times', false).map((l) => l.ms)).toEqual([null, null]);
  });
  it('quotes every word so nothing is read as query syntax', () => {
    expect(ftsQuery('love "you" OR me*')).toBe('"love"* "you"* "OR"* "me"*');
    expect(ftsQuery('  !!  ')).toBeNull();
    expect(queryTerms('கண்ணே அன்பு')).toEqual(['கண்ணே', 'அன்பு']);
  });
  it('splits snippets into matched and plain parts', () => {
    expect(snippetParts(`a ${HIT_OPEN}b${HIT_CLOSE} c`)).toEqual([
      { text: 'a ', hit: false },
      { text: 'b', hit: true },
      { text: ' c', hit: false },
    ]);
  });
});

describe('lyric search (index)', () => {
  it('finds lines by word prefix across songs, with the song and the time', async () => {
    putSong('spotify:track:a', 'Neon Static', '[00:01.00] the city lights are calling\n[00:05.00] hold me closer');
    putSong('spotify:track:b', 'Paper Planets', '[00:02.00] city of paper\n[00:06.00] calling all planets');
    const r = await q('city call');
    expect(r.available).toBe(true);
    expect(r.hits).toHaveLength(1);
    expect(r.hits[0]).toMatchObject({ key: 'spotify:track:a', title: 'Neon Static', ms: 1000, text: 'the city lights are calling' });
    expect(r.hits[0]!.snippet).toContain(`${HIT_OPEN}city${HIT_CLOSE}`);
    expect((await q('city')).hits.map((h) => h.key).sort()).toEqual(['spotify:track:a', 'spotify:track:b']);
  });
  it('keeps Tamil and Hindi words whole and folds accents', async () => {
    putSong('t:1', 'Song', '[00:01.00] கண்ணே அன்பு\n[00:02.00] तेरा दिल\n[00:03.00] café au lait');
    expect((await q('அன்')).hits.map((h) => h.text)).toEqual(['கண்ணே அன்பு']);
    expect((await q('दिल')).hits.map((h) => h.text)).toEqual(['तेरा दिल']);
    expect((await q('cafe')).hits.map((h) => h.text)).toEqual(['café au lait']);
  });
  it('replaces a song\'s lines when its lyrics change, and forgets them with the lyrics', async () => {
    putSong('k', 'S', '[00:01.00] old words');
    putSong('k', 'S', '[00:01.00] new words');
    expect((await q('old')).hits).toHaveLength(0);
    expect((await q('new')).hits).toHaveLength(1);
    songIndex.removeFeature('k', 'lyrics');
    expect((await q('new')).hits).toHaveLength(0);
  });
  it('does not treat query text as syntax', async () => {
    putSong('k', 'S', '[00:01.00] near the end');
    expect((await q('NEAR(end')).hits).toHaveLength(1); // read as the words "near" and "end", not an FTS operator
    expect((await q('"end')).hits).toHaveLength(1);
  });
});

describe('saved lines', () => {
  const body = { key: 'spotify:track:a', title: 'Neon Static', artists: ['Someone'], idx: 3, ms: 12_000, text: 'hold me closer' };
  const post = (b: unknown) => save(new Request('http://x/api/saved-lines', { method: 'POST', body: JSON.stringify(b), headers: { 'Content-Type': 'application/json' } }));
  it('saves, lists, de-duplicates and removes', async () => {
    const a = (await (await post(body)).json()) as { line: { id: string } };
    const b = (await (await post(body)).json()) as { line: { id: string } };
    expect(b.line.id).toBe(a.line.id);
    const list = (await (await listSaved(new Request('http://x/api/saved-lines'))).json()) as { lines: { id: string; text: string }[] };
    expect(list.lines.map((l) => l.text)).toEqual(['hold me closer']);
    const del = await unsave(new Request(`http://x/api/saved-lines?id=${a.line.id}`, { method: 'DELETE' }));
    expect(((await del.json()) as { removed: boolean }).removed).toBe(true);
    expect(songIndex.savedLines()).toHaveLength(0);
  });
  it('rejects bad input and survives clearing the index', async () => {
    expect((await post({ ...body, text: '' })).status).toBe(400);
    await post(body);
    songIndex.clear();
    expect(songIndex.savedLines()).toHaveLength(1);
  });
});
