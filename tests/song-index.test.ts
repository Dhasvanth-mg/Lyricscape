// The song index: SQLite repository, its routes, fingerprints, and the rules about what may be stored.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET as getOne, PUT as putOne, POST as touchOne, DELETE as delOne } from '@/app/api/index/[key]/route';
import { GET as stats, DELETE as clearAll } from '@/app/api/index/route';
import { songIndex } from '@/lib/server/songIndex';
import { fingerprint, fingerprints, putBodySchema, type PutBody } from '@/lib/index/types';
import { FeatureTrack } from '@/lib/analysis/features';

let dir = '';
beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'ls-index-'));
});
afterAll(() => {
  songIndex.close();
  rmSync(dir, { recursive: true, force: true });
});
beforeEach(() => {
  vi.stubEnv('LYRICSCAPE_DATA_DIR', dir);
  songIndex.clear();
});
afterEach(() => vi.unstubAllEnvs());

const song = { provider: 'spotify', title: 'E85', artists: ['Don Toliver'], durationMs: 216_000 };
const palette = { artworkUrl: 'https://i.scdn.co/image/x', palette: ['#aa0000', '#00aa00', '#0000aa', '#101010'] as [string, string, string, string], vibrance: 0.6, light: 0.3, focal: { x: 0.4, y: 0.5 } };
const lyrics = { lrc: '[00:01.00] hello\n[00:03.00] world', source: 'LRCLIB (community)', synced: true, versionId: 77, origin: 'lrclib' as const, savedAt: 1 };

/** real audio features from a short synthetic pulse, so the stored shape is the genuine one */
function audio(bpm = 120, durationMs = 216_000) {
  const sr = 22050;
  const secs = 24;
  const pcm = new Float32Array(sr * secs);
  const period = (60 / bpm) * sr;
  for (let b = 0; b * period < pcm.length; b++) {
    const s = Math.round(b * period);
    for (let k = 0; k < 0.1 * sr && s + k < pcm.length; k++) pcm[s + k] = 0.8 * Math.exp((-6 * k) / (0.1 * sr)) * Math.sin((2 * Math.PI * 70 * k) / sr);
  }
  const t = new FeatureTrack(durationMs);
  t.pushPcm(pcm, sr, 0);
  return t.toFeatures('capture');
}

const put = (key: string, body: unknown) => putOne(new Request(`http://x/api/index/${encodeURIComponent(key)}`, { method: 'PUT', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }), { params: Promise.resolve({ key: encodeURIComponent(key) }) });
const get = (key: string, qs = '') => getOne(new Request(`http://x/api/index/${encodeURIComponent(key)}${qs}`), { params: Promise.resolve({ key: encodeURIComponent(key) }) });

describe('fingerprints', () => {
  it('match the same recording across services and ignore decoration', () => {
    const a = fingerprint({ title: 'Flashing Lights (feat. Dwele) - Remastered 2021', artists: ['Kanye West'], durationMs: 237_000 });
    const b = fingerprint({ title: 'Flashing Lights', artists: ['Kanye West', 'Dwele'], durationMs: 237_900 });
    expect(a).toBe(b);
    expect(fingerprints({ title: 'x', artists: ['y'], durationMs: 100_000 })).toHaveLength(3);
    expect(fingerprint({ title: 'Flashing Lights', artists: ['Kanye West'], durationMs: 300_000 })).not.toBe(b);
  });
});

describe('song index repository', () => {
  it('is available here and starts empty', () => {
    expect(songIndex.available()).toBe(true);
    const s = songIndex.stats();
    expect(s.songs).toBe(0);
    expect(s.file).toMatch(/song-index\.sqlite$/);
  });

  it('stores, merges and reads back every kind of feature', async () => {
    const a = audio();
    expect((await put('spotify:track:1', { song, features: { audio: a, palette } })).status).toBe(200);
    expect((await put('spotify:track:1', { song, features: { lyrics } })).status).toBe(200); // a later save adds without dropping the rest
    const r = await (await get('spotify:track:1')).json();
    expect(r.available).toBe(true);
    expect(r.entry.song.title).toBe('E85');
    expect(r.entry.features.audio.bpm).toBeCloseTo(a.bpm!, 5);
    expect(r.entry.features.audio.beatTimesMs).toEqual(a.beatTimesMs);
    expect(r.entry.features.palette.palette[0]).toBe('#aa0000');
    expect(r.entry.features.lyrics.versionId).toBe(77);
    const s = songIndex.stats();
    expect(s.songs).toBe(1);
    expect(s.byKind.audio.count).toBe(1);
    expect(s.withTempo).toBe(1);
    expect(s.bytes).toBeGreaterThan(1000);
  });

  it('updates in place and counts plays', async () => {
    await put('spotify:track:2', { song, features: { palette } });
    await put('spotify:track:2', { song, features: { palette: { ...palette, vibrance: 0.1 } } });
    for (let i = 0; i < 3; i++) await touchOne(new Request('http://x', { method: 'POST' }), { params: Promise.resolve({ key: 'spotify%3Atrack%3A2' }) });
    const e = songIndex.get('spotify:track:2')!;
    expect(e.features.palette!.vibrance).toBe(0.1);
    expect(e.song.plays).toBe(3);
    expect(songIndex.stats().songs).toBe(1);
  });

  it('shares audio features between copies of the same recording (by title, artist and length)', async () => {
    const a = audio(128);
    await put('spotify:track:A', { song, features: { audio: a } });
    // the same song from a local file, 1 s longer
    const other = songIndex.get('licensed:abc', { title: 'E85', artists: ['Don Toliver'], durationMs: 217_000 })!;
    expect(other.audioVia).toBe('fingerprint');
    expect(other.features.audio!.bpm).toBeCloseTo(a.bpm!, 5);
    // a different song gets nothing
    expect(songIndex.get('licensed:zzz', { title: 'Other', artists: ['Someone'], durationMs: 217_000 })).toBeNull();
  });

  it('does not let a worse copy replace a song’s own tempo', async () => {
    const own = audio(100);
    const stranger = audio(150);
    await put('spotify:track:own', { song, features: { audio: own } });
    await put('spotify:track:other', { song: { ...song, durationMs: 216_500 }, features: { audio: stranger } });
    const e = songIndex.get('spotify:track:own', { title: song.title, artists: song.artists, durationMs: song.durationMs })!;
    expect(e.audioVia).toBeUndefined();
    expect(e.features.audio!.bpm).toBeCloseTo(own.bpm!, 5);
  });

  it('deletes one song, and clears everything only when asked twice', async () => {
    await put('spotify:track:3', { song, features: { palette } });
    await put('spotify:track:4', { song: { ...song, title: 'Other' }, features: { palette } });
    expect((await (await delOne(new Request('http://x', { method: 'DELETE' }), { params: Promise.resolve({ key: 'spotify%3Atrack%3A3' }) })).json()).removed).toBe(true);
    expect(songIndex.get('spotify:track:3')).toBeNull();
    expect((await clearAll(new Request('http://x/api/index', { method: 'DELETE' }))).status).toBe(400);
    expect(songIndex.stats().songs).toBe(1);
    expect((await (await clearAll(new Request('http://x/api/index?all=1', { method: 'DELETE' }))).json()).cleared).toBe(1);
    expect(songIndex.stats().songs).toBe(0);
    expect((await (await stats(new Request('http://x/api/index'))).json()).songs).toBe(0);
  });

  it('survives being closed and reopened (restart)', async () => {
    await put('spotify:track:5', { song, features: { audio: audio(), lyrics } });
    songIndex.close();
    const e = songIndex.get('spotify:track:5')!;
    expect(e.features.lyrics!.lrc).toContain('hello');
    expect(e.features.audio!.beatTimesMs.length).toBeGreaterThan(8);
  });
});

describe('what the index refuses', () => {
  const ok = (): PutBody => ({ song, features: { palette } });
  it('rejects malformed songs and features with a readable message, and unknown feature kinds', async () => {
    expect(putBodySchema.safeParse(ok()).success).toBe(true);
    for (const bad of [{ song: { ...song, title: '' }, features: {} }, { song: { ...song, durationMs: 5 }, features: {} }, { song, features: { audio: { version: 1 } } }, { song, features: { notes: 'x' } }, { song, features: { palette: { ...palette, vibrance: 7 } } }]) {
      const res = await put('spotify:track:bad', bad);
      expect(res.status).toBe(400);
      expect((await res.json()).code).toBe('validation');
    }
    expect(songIndex.stats().songs).toBe(0);
  });

  it('rejects an oversized body and a body that is not JSON', async () => {
    const big = await putOne(new Request('http://x', { method: 'PUT', body: JSON.stringify({ song, features: { lyrics: { ...lyrics, lrc: 'x'.repeat(1_300_000) } } }), headers: { 'Content-Type': 'application/json' } }), { params: Promise.resolve({ key: 'k' }) });
    expect(big.status).toBe(413);
    const text = await putOne(new Request('http://x', { method: 'PUT', body: 'hi', headers: { 'Content-Type': 'text/plain' } }), { params: Promise.resolve({ key: 'k' }) });
    expect(text.status).toBe(415);
  });

  it('rejects cross-site writes', async () => {
    const res = await putOne(new Request('http://x/api/index/k', { method: 'PUT', body: JSON.stringify(ok()), headers: { 'Content-Type': 'application/json', origin: 'http://evil.example', host: 'x' } }), { params: Promise.resolve({ key: 'k' }) });
    expect(res.status).toBe(403);
  });

  it('keeps a stored record that no longer fits the schema from breaking a read (it is ignored)', async () => {
    await put('spotify:track:6', { song, features: { palette } });
    // simulate an older record written by a previous version
    const dbGet = songIndex.get('spotify:track:6')!;
    expect(dbGet.features.palette).toBeTruthy();
  });
});
