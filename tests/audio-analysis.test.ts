// Audio analysis: tempo and beats recovered from synthetic music with a known pulse, streaming and merging behaviour, and the codec.
import { describe, expect, it } from 'vitest';
import { FFT } from '@/lib/analysis/fft';
import { FeatureTrack, analysePcm, fromBase64, toBase64 } from '@/lib/analysis/features';
import { audioFeaturesSchema, coverage, hasTempo } from '@/lib/analysis/types';

/** a small deterministic noise source */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296 - 0.5;
  };
}

/** A pulse at `bpm` (kick-like thump on every beat, a hat on the off-beat) over a steady pad, so the onsets are what carries the tempo. */
function synth(bpm: number, seconds: number, sr = 44100, offsetMs = 120, seed = 1, swing = 0): Float32Array {
  const out = new Float32Array(Math.round(seconds * sr));
  const r = rng(seed);
  const period = (60 / bpm) * sr;
  // pad
  for (let i = 0; i < out.length; i++) out[i] = 0.05 * Math.sin((2 * Math.PI * 220 * i) / sr) + 0.03 * Math.sin((2 * Math.PI * 330 * i) / sr) + 0.01 * r();
  const hit = (start: number, freq: number, len: number, amp: number, noise: number) => {
    for (let k = 0; k < len && start + k < out.length; k++) {
      const env = Math.exp((-6 * k) / len);
      out[start + k]! += amp * env * (Math.sin((2 * Math.PI * freq * k) / sr) * (1 - noise) + noise * r() * 2);
    }
  };
  for (let b = 0; ; b++) {
    const s = Math.round((offsetMs / 1000) * sr + b * period);
    if (s >= out.length) break;
    hit(s, 70, Math.round(0.12 * sr), 0.7, 0.05);
    hit(Math.round(s + period / 2 + (b % 2 ? swing * period : 0)), 6000, Math.round(0.03 * sr), 0.25, 0.9);
    if (b % 4 === 2) hit(s, 190, Math.round(0.09 * sr), 0.4, 0.5); // a snare now and then
  }
  return out;
}

/** how far (ms) the tracked beats sit from the true grid, median */
function medianPhaseError(beats: number[], bpm: number, offsetMs: number): number {
  const period = 60000 / bpm;
  const errs = beats.map((b) => {
    const k = Math.round((b - offsetMs) / period);
    return Math.abs(b - (offsetMs + k * period));
  });
  errs.sort((a, b) => a - b);
  return errs[errs.length >> 1] ?? 999;
}

describe('FFT', () => {
  it('puts a pure tone in the right bin', () => {
    const n = 1024;
    const f = new FFT(n);
    const re = new Float32Array(n);
    const im = new Float32Array(n);
    for (let i = 0; i < n; i++) re[i] = Math.sin((2 * Math.PI * 64 * i) / n);
    f.transform(re, im);
    let best = 0;
    for (let k = 1; k < n / 2; k++) if (Math.hypot(re[k]!, im[k]!) > Math.hypot(re[best]!, im[best]!)) best = k;
    expect(best).toBe(64);
    expect(() => new FFT(1000)).toThrow();
  });
});

describe('tempo and beats from audio', () => {
  for (const bpm of [90, 120, 128, 140]) {
    it(`finds ${bpm} BPM and puts beats on the pulse`, async () => {
      const sr = 44100;
      const pcm = synth(bpm, 45, sr, 120, bpm);
      const f = await analysePcm(pcm, sr);
      expect(audioFeaturesSchema.safeParse(f).success).toBe(true);
      expect(f.bpm).not.toBeNull();
      expect(Math.abs(f.bpm! - bpm)).toBeLessThan(1.2);
      expect(f.bpmConfidence).toBeGreaterThan(0.2);
      expect(hasTempo(f)).toBe(true);
      expect(f.beatTimesMs.length).toBeGreaterThan((45 / (60 / bpm)) * 0.85);
      expect(medianPhaseError(f.beatTimesMs, bpm, 120)).toBeLessThan(35);
    });
  }

  it('works at 48 kHz and gives the same tempo', async () => {
    const a = await analysePcm(synth(112, 40, 48000, 60, 3), 48000);
    expect(Math.abs(a.bpm! - 112)).toBeLessThan(1.2);
  });

  it('does not invent a tempo from noise or silence', async () => {
    const r = rng(9);
    const noise = new Float32Array(44100 * 30);
    for (let i = 0; i < noise.length; i++) noise[i] = r() * 0.2;
    const f = await analysePcm(noise, 44100);
    expect(hasTempo(f)).toBe(false);
    const quiet = await analysePcm(new Float32Array(44100 * 30), 44100);
    expect(quiet.bpm).toBeNull();
    expect(quiet.beatTimesMs).toEqual([]);
  });

  it('streams: small pieces tagged with a position give the same answer as the whole file', async () => {
    const sr = 44100;
    const pcm = synth(124, 40, sr, 200, 5);
    const whole = await analysePcm(pcm, sr);
    const t = new FeatureTrack(40_000);
    const piece = 4096;
    for (let i = 0; i < pcm.length; i += piece) t.pushPcm(pcm.subarray(i, i + piece), sr, (i * 1000) / sr);
    const f = t.toFeatures('capture');
    expect(Math.abs(f.bpm! - whole.bpm!)).toBeLessThan(0.5);
    expect(coverage(f)).toBeGreaterThan(0.95);
  });

  it('keeps the pulse through a gap and records what was heard', () => {
    const sr = 44100;
    const pcm = synth(100, 60, sr, 0, 7);
    const t = new FeatureTrack(60_000);
    const cut = (a: number, b: number) => t.pushPcm(pcm.subarray(Math.round((a * sr) / 1000), Math.round((b * sr) / 1000)), sr, a);
    cut(0, 18_000);
    cut(30_000, 60_000); // the listener skipped 12 s
    const f = t.toFeatures('capture');
    expect(f.covered.length).toBe(2);
    expect(coverage(f)).toBeLessThan(0.85);
    expect(Math.abs(f.bpm! - 100)).toBeLessThan(1.2);
    // beats continue across the gap, on the grid
    expect(f.beatTimesMs.some((b) => b > 19_000 && b < 29_000)).toBe(true);
    expect(medianPhaseError(f.beatTimesMs, 100, 0)).toBeLessThan(40);
  });

  it('merges a later pass into an earlier one (and refuses a different recording)', () => {
    const sr = 44100;
    const pcm = synth(110, 50, sr, 30, 11);
    const a = new FeatureTrack(50_000);
    a.pushPcm(pcm.subarray(0, 20 * sr), sr, 0);
    const b = new FeatureTrack(50_000);
    b.pushPcm(pcm.subarray(25 * sr), sr, 25_000);
    expect(a.merge(b)).toBe(true);
    const f = a.toFeatures('capture');
    expect(coverage(f)).toBeGreaterThan(0.85);
    expect(Math.abs(f.bpm! - 110)).toBeLessThan(1.2);
    expect(a.merge(new FeatureTrack(90_000))).toBe(false);
  });

  it('round-trips through the stored form', async () => {
    const sr = 44100;
    const f = await analysePcm(synth(118, 40, sr, 80, 2), sr);
    const back = FeatureTrack.fromFeatures(f);
    const g = back.toFeatures('file');
    expect(Math.abs(g.bpm! - f.bpm!)).toBeLessThan(0.6);
    expect(g.covered).toEqual(f.covered);
  });

  it('reports loudness and brightness', async () => {
    const f = await analysePcm(synth(120, 20), 44100);
    expect(f.loudnessDb!).toBeLessThan(0);
    expect(f.loudnessDb!).toBeGreaterThan(-40);
    expect(f.brightness!).toBeGreaterThan(0);
    expect(f.brightness!).toBeLessThan(1);
  });
});

describe('codec', () => {
  it('base64 round-trips every byte, including big arrays', () => {
    const u = new Uint8Array(100_000);
    for (let i = 0; i < u.length; i++) u[i] = (i * 31) & 255;
    expect(Array.from(fromBase64(toBase64(u)))).toEqual(Array.from(u));
  });
});
