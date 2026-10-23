import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyzeAudio, type Analysis } from '@/lib/recap/analyze';
import { decodeWav } from '@/lib/recap/wav';
import { PlanError, planRecap, regenerateRange, type PlanAsset } from '@/lib/recap/plan';
import { normalizeTimeline, recapTimelineSchema, snapToBeat, validateTimeline } from '@/lib/recap/timeline';
import { assessQuality, dedupe, dHash, hamming, laplacianVariance, resizeGray, type GrayImage } from '@/lib/recap/mediaScore';

const load = (id: string): Analysis => {
  const a = decodeWav(readFileSync(join(process.cwd(), `public/demo/${id}.wav`)));
  return analyzeAudio(a.samples, a.sampleRate);
};
const analyses = { 'neon-static': load('neon-static'), 'paper-planets': load('paper-planets'), 'glass-hours': load('glass-hours') };

const mkAssets = (n: number, over: Partial<PlanAsset> = {}): PlanAsset[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `a${String(i).padStart(2, '0')}`,
    mediaType: 'image' as const,
    takenAtMs: 1000 * i,
    uploaderId: `u${i % 4}`,
    uploaderName: `U${i % 4}`,
    quality: 0.3 + ((i * 37) % 70) / 100,
    pinned: false,
    ...over,
  }));
const audio = { source: { kind: 'demo' as const, id: 'neon-static' }, license: 'CC0' };

describe('planner: beat-aware timeline', () => {
  for (const [id, analysis] of Object.entries(analyses)) {
    describe(id, () => {
      const tl = planRecap({ assets: mkAssets(60), analysis, audio, preset: 'quick', aspect: '9:16', targetMs: 30_000, seed: 3 });
      const beats = new Set(tl.audio.beatTimesMs);

      it('is a schema-valid timeline of the requested length (within a bar)', () => {
        expect(recapTimelineSchema.safeParse(tl).success).toBe(true);
        const bar = (60000 / analysis.bpm) * 4;
        expect(Math.abs(tl.durationMs - 30_000)).toBeLessThanOrEqual(bar / 2 + 1);
      });

      it('puts every cut on a beat of the soundtrack', () => {
        for (const c of tl.clips) {
          expect(beats.has(c.timelineStartMs)).toBe(true);
          expect(beats.has(c.timelineStartMs + c.durationMs)).toBe(true);
        }
      });

      it('tiles the timeline with no gaps or overlaps and ends with the music', () => {
        let t = 0;
        for (const c of tl.clips) {
          expect(c.timelineStartMs).toBe(t);
          t += c.durationMs;
        }
        expect(t).toBe(tl.durationMs);
        expect(tl.audio.sourceOutMs - tl.audio.sourceInMs).toBe(tl.durationMs);
      });

      it('takes the soundtrack window from whole bars of the real song', () => {
        expect(analysis.barStartsMs).toContain(tl.audio.sourceInMs);
        expect(tl.audio.sourceOutMs).toBeLessThanOrEqual(analysis.contentEndMs + 5);
        expect(tl.audio.license).toBe('CC0');
      });

      it('keeps media in chronological order', () => {
        const order = tl.clips.map((c) => c.assetId);
        const times = order.map((x) => Number(x.slice(1)) * 1000);
        expect(times).toEqual([...times].sort((a, b) => a - b));
      });
    });
  }

  it('is deterministic for a given seed and varies with another', () => {
    const a = analyses['neon-static'];
    const one = planRecap({ assets: mkAssets(12), analysis: a, audio, preset: 'quick', aspect: '1:1', targetMs: 30_000, seed: 5 });
    const two = planRecap({ assets: mkAssets(12), analysis: a, audio, preset: 'quick', aspect: '1:1', targetMs: 30_000, seed: 5 });
    const three = planRecap({ assets: mkAssets(12), analysis: a, audio, preset: 'quick', aspect: '1:1', targetMs: 30_000, seed: 6 });
    expect(JSON.stringify(one)).toBe(JSON.stringify(two));
    expect(JSON.stringify(one)).not.toBe(JSON.stringify(three));
  });

  it('always includes pinned memories and contributors are represented fairly', () => {
    const assets = mkAssets(60);
    assets[41]!.pinned = true;
    assets[7]!.pinned = true;
    const tl = planRecap({ assets, analysis: analyses['glass-hours'], audio, preset: 'quick', aspect: '9:16', targetMs: 30_000 });
    const used = new Set(tl.clips.map((c) => c.assetId));
    expect(used.has('a41') && used.has('a07')).toBe(true);
    expect(tl.clips.find((c) => c.assetId === 'a41')!.pinned).toBe(true);
    const contributors = new Set(tl.clips.map((c) => c.contributor));
    expect(contributors.size).toBe(4);
    expect(tl.notes.some((n) => /left out/.test(n))).toBe(true);
    expect(new Set(tl.clips.map((c) => c.assetId)).size).toBe(tl.clips.length); // no repeats when there is plenty of media
  });

  it('repeats media when there is too little and says so; videos use different moments', () => {
    const vids = mkAssets(2, { mediaType: 'video', durationMs: 20_000 });
    const tl = planRecap({ assets: vids, analysis: analyses['neon-static'], audio, preset: 'quick', aspect: '9:16', targetMs: 30_000 });
    expect(tl.notes.some((n) => /repeat/.test(n))).toBe(true);
    const a0 = tl.clips.filter((c) => c.assetId === 'a00');
    expect(a0.length).toBeGreaterThan(2);
    expect(new Set(a0.map((c) => c.sourceInMs)).size).toBeGreaterThan(1);
    for (const c of tl.clips) expect(c.sourceOutMs).toBeLessThanOrEqual(20_000);
  });

  it('presets set sensible lengths and shorten when the song is too short', () => {
    const a = analyses['paper-planets'];
    const hi = planRecap({ assets: mkAssets(30), analysis: a, audio, preset: 'highlight', aspect: '16:9' });
    expect(hi.durationMs).toBeLessThanOrEqual(a.contentEndMs);
    expect(hi.notes.some((n) => /shortened/.test(n))).toBe(true); // 120s asked, ~50s song
    const quick = planRecap({ assets: mkAssets(30), analysis: a, audio, preset: 'quick', aspect: '9:16' });
    expect(quick.durationMs).toBeGreaterThanOrEqual(25_000);
  });

  it('fails with clear errors for no media, no beat, or unknown aspect', () => {
    expect(() => planRecap({ assets: [], analysis: analyses['neon-static'], audio, preset: 'quick', aspect: '9:16' })).toThrowError(PlanError);
    const silent = analyzeAudio(new Float32Array(44100 * 10), 44100);
    expect(() => planRecap({ assets: mkAssets(3), analysis: silent, audio, preset: 'quick', aspect: '9:16' })).toThrow(/beat/i);
    expect(() => planRecap({ assets: mkAssets(3), analysis: analyses['neon-static'], audio, preset: 'quick', aspect: '4:3' as never })).toThrow();
  });

  it('adds a title caption', () => {
    const tl = planRecap({ assets: mkAssets(8), analysis: analyses['neon-static'], audio, preset: 'quick', aspect: '9:16', title: 'Sam’s Birthday' });
    expect(tl.captions[0]).toMatchObject({ text: 'Sam’s Birthday', startMs: 300 });
  });
});

describe('editing: regenerate a section, validate and normalise', () => {
  const assets = mkAssets(40);
  const a = analyses['glass-hours'];
  const tl = planRecap({ assets, analysis: a, audio, preset: 'quick', aspect: '9:16', targetMs: 30_000, seed: 1 });
  const refs = new Map(assets.map((x) => [x.id, { id: x.id, mediaType: x.mediaType, durationMs: x.durationMs }]));

  it('a fresh plan validates cleanly', () => {
    expect(validateTimeline(tl, refs)).toEqual([]);
  });

  it('regenerates only the chosen range and leaves pinned clips alone', () => {
    const pinnedId = tl.clips[2]!.id;
    const marked = { ...tl, clips: tl.clips.map((c) => (c.id === pinnedId ? { ...c, pinned: true } : c)) };
    const from = marked.clips[0]!.timelineStartMs;
    const to = marked.clips[4]!.timelineStartMs;
    const next = regenerateRange(marked, assets, from, to, 99);
    expect(next.clips.slice(4)).toEqual(marked.clips.slice(4));
    expect(next.clips[2]).toEqual(marked.clips[2]);
    expect(next.clips.slice(0, 4).filter((c) => !c.pinned).some((c, i) => c.assetId !== marked.clips[[0, 1, 3][i]!]!.assetId)).toBe(true);
    for (let i = 0; i < next.clips.length; i++) {
      expect(next.clips[i]!.timelineStartMs).toBe(marked.clips[i]!.timelineStartMs);
      expect(next.clips[i]!.durationMs).toBe(marked.clips[i]!.durationMs);
    }
  });

  it('flags bad edits: unknown media, overlaps, runaway durations, short soundtrack, bad video ranges', () => {
    const bad = { ...tl, clips: tl.clips.map((c, i) => (i === 0 ? { ...c, assetId: 'ghost' } : i === 1 ? { ...c, timelineStartMs: 100 } : c)) };
    const problems = validateTimeline(bad, refs);
    expect(problems.some((p) => /not available/.test(p))).toBe(true);
    expect(problems.some((p) => /overlaps/.test(p))).toBe(true);
    expect(validateTimeline({ ...tl, audio: { ...tl.audio, sourceOutMs: tl.audio.sourceInMs + 1000 } }, refs).some((p) => /shorter/.test(p))).toBe(true);
    const vref = new Map([['a00', { id: 'a00', mediaType: 'video' as const, durationMs: 1000 }]]);
    const v = { ...tl, clips: [{ ...tl.clips[0]!, assetId: 'a00', mediaType: 'video' as const, sourceInMs: 0, sourceOutMs: 5000, durationMs: tl.durationMs }] };
    expect(validateTimeline(v, vref).some((p) => /past the end of the video/.test(p))).toBe(true);
  });

  it('rejects structurally invalid timelines at the schema level', () => {
    expect(recapTimelineSchema.safeParse({ ...tl, clips: [] }).success).toBe(false);
    expect(recapTimelineSchema.safeParse({ ...tl, aspect: '2:1' }).success).toBe(false);
    expect(recapTimelineSchema.safeParse({ ...tl, audio: { ...tl.audio, source: { kind: 'upload', mediaId: 'x' } } }).success).toBe(false); // rights attestation required
    expect(recapTimelineSchema.safeParse({ ...tl, clips: [{ ...tl.clips[0]!, durationMs: 10 }] }).success).toBe(false);
  });

  it('normalising re-packs edited durations back to back; snapToBeat aligns to the grid', () => {
    const edited = { ...tl, clips: tl.clips.map((c, i) => (i === 1 ? { ...c, durationMs: c.durationMs + 400 } : c)) };
    const norm = normalizeTimeline(edited);
    let t = 0;
    for (const c of norm.clips) {
      expect(c.timelineStartMs).toBe(t);
      t += c.durationMs;
    }
    expect(norm.durationMs).toBe(t);
    const beat = tl.audio.beatTimesMs[7]!;
    expect(snapToBeat(tl, beat + 70)).toBe(beat);
    expect(snapToBeat(tl, beat + 700, 100)).toBe(beat + 700); // too far from any beat: left alone
  });
});

// ---------------------------------------------------------------------------
// Media scoring
// ---------------------------------------------------------------------------
const gray = (w: number, h: number, f: (x: number, y: number) => number): GrayImage => {
  const data = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data[y * w + x] = Math.max(0, Math.min(255, Math.round(f(x, y))));
  return { w, h, data };
};
const checker = (w = 128, h = 128, s = 8) => gray(w, h, (x, y) => (((x / s) | 0) + ((y / s) | 0)) % 2 ? 220 : 40);
const blur = (img: GrayImage, r = 3): GrayImage =>
  gray(img.w, img.h, (x, y) => {
    let s = 0;
    let n = 0;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const xx = Math.min(img.w - 1, Math.max(0, x + dx));
      const yy = Math.min(img.h - 1, Math.max(0, y + dy));
      s += img.data[yy * img.w + xx]!;
      n++;
    }
    return s / n;
  });

describe('media quality scoring', () => {
  it('rates a blurred copy much lower than the sharp original', () => {
    const sharp = checker();
    const soft = blur(sharp, 4);
    const mush = blur(sharp, 8);
    expect(laplacianVariance(sharp)).toBeGreaterThan(laplacianVariance(soft) * 20);
    expect(assessQuality(soft).blurry).toBe(false); // moderately soft is still usable: the threshold is conservative
    expect(assessQuality(sharp).blurry).toBe(false);
    expect(assessQuality(mush).blurry).toBe(true);
    expect(assessQuality(sharp).score).toBeGreaterThan(assessQuality(soft).score);
    expect(assessQuality(soft).score).toBeGreaterThan(assessQuality(mush).score);
  });

  it('flags under- and over-exposed frames', () => {
    const dark = gray(64, 64, (x) => 5 + (x % 3));
    const bright = gray(64, 64, (x) => 250 - (x % 3));
    expect(assessQuality(dark).tooDark).toBe(true);
    expect(assessQuality(bright).tooBright).toBe(true);
    expect(assessQuality(checker()).tooDark || assessQuality(checker()).tooBright).toBe(false);
  });

  it('scores are independent of thumbnail resolution (normalised to 128px)', () => {
    const a = assessQuality(checker(128, 128, 8));
    const b = assessQuality(checker(512, 512, 32));
    expect(Math.abs(a.sharpness - b.sharpness) / a.sharpness).toBeLessThan(0.5);
  });

  it('perceptual hashes match for the same picture at different sizes/brightness and differ for different pictures', () => {
    const scene = (w: number, h: number) => gray(w, h, (x, y) => 40 + 180 * Math.exp(-(((x / w - 0.35) ** 2 + (y / h - 0.5) ** 2) * 18)));
    const a = dHash(scene(160, 120));
    const bigger = dHash(scene(640, 480));
    const brighter = dHash({ ...scene(160, 120), data: scene(160, 120).data.map((v) => Math.min(255, v + 25)) });
    const other = dHash(gray(160, 120, (x, y) => 40 + 180 * Math.exp(-(((x / 160 - 0.75) ** 2 + (y / 120 - 0.3) ** 2) * 18))));
    expect(hamming(a, bigger)).toBeLessThanOrEqual(6);
    expect(hamming(a, brighter)).toBeLessThanOrEqual(6);
    expect(hamming(a, other)).toBeGreaterThan(6);
    expect(a).toMatch(/^[0-9a-f]{16}$/);
    expect(resizeGray(checker(), 9, 8).data).toHaveLength(72);
  });

  it('dedupe keeps the best of each near-duplicate group, but never drops a pinned one', () => {
    const items = [
      { id: 'a', hash: '0000000000000000', score: 0.5 },
      { id: 'b', hash: '0000000000000001', score: 0.9 }, // near-duplicate of a, better
      { id: 'c', hash: 'ffffffffffffffff', score: 0.4 },
      { id: 'd', hash: 'ffffffffffffff0f', score: 0.2, pinned: true }, // near-duplicate of c but pinned: pinned wins
    ];
    const r = dedupe(items);
    expect(r.kept.sort()).toEqual(['b', 'd']);
    expect(r.dropped).toEqual(expect.arrayContaining([{ id: 'a', duplicateOf: 'b' }, { id: 'c', duplicateOf: 'd' }]));
    // two pinned near-duplicates are both kept: the host asked for them
    expect(dedupe([{ id: 'p', hash: '0', score: 0.1, pinned: true }, { id: 'q', hash: '0', score: 0.9, pinned: true }].map((x) => ({ ...x, hash: '0000000000000000' }))).kept.sort()).toEqual(['p', 'q']);
  });
});
