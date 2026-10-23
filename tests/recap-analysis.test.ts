import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyzeAudio, ANALYSIS_VERSION } from '@/lib/recap/analyze';
import { decodeWav } from '@/lib/recap/wav';
import { fft } from '@/lib/recap/dsp';

const catalog = JSON.parse(readFileSync(join(process.cwd(), 'public/demo/catalog.json'), 'utf8')) as { id: string; bpm: number; beatTimesMs: number[]; durationMs: number }[];
const load = (id: string) => decodeWav(readFileSync(join(process.cwd(), `public/demo/${id}.wav`)));

describe('FFT + WAV', () => {
  it('finds the frequency of a sine wave', () => {
    const n = 1024;
    const re = new Float64Array(n);
    const im = new Float64Array(n);
    const bin = 37;
    for (let i = 0; i < n; i++) re[i] = Math.sin((2 * Math.PI * bin * i) / n);
    fft(re, im);
    let best = 0;
    for (let k = 1; k < n / 2; k++) if (Math.hypot(re[k]!, im[k]!) > Math.hypot(re[best]!, im[best]!)) best = k;
    expect(best).toBe(bin);
  });

  it('decodes the demo WAV files', () => {
    const a = load('neon-static');
    expect(a.sampleRate).toBe(44100);
    expect(Math.abs(a.durationMs - catalog[0]!.durationMs)).toBeLessThan(5);
    expect(() => decodeWav(new Uint8Array(100))).toThrow();
  });
});

describe('music analysis against ground truth (synthesized demo songs)', () => {
  for (const t of catalog) {
    describe(t.id, () => {
      const audio = load(t.id);
      const a = analyzeAudio(audio.samples, audio.sampleRate);

      it('estimates the tempo within 1%', () => {
        expect(Math.abs(a.bpm - t.bpm) / t.bpm).toBeLessThan(0.01);
        expect(a.analysisVersion).toBe(ANALYSIS_VERSION);
        expect(a.tempoConfidence).toBeGreaterThan(0.5);
      });

      it('places beats within 25 ms of the true beat grid', () => {
        const lastTruth = t.beatTimesMs[t.beatTimesMs.length - 1]!;
        const errs = a.beatTimesMs.filter((b) => b > 600 && b < lastTruth - 600).map((b) => Math.min(...t.beatTimesMs.map((g) => Math.abs(g - b))));
        expect(errs.length).toBeGreaterThan(40);
        expect(Math.max(...errs)).toBeLessThanOrEqual(25);
      });

      it('finds the bar line (downbeat) and 4-beat bars', () => {
        const bar = (60000 / t.bpm) * 4;
        // every detected bar start must land on a true bar line (multiples of 4 beats from 0)
        for (const ms of a.barStartsMs.slice(1, -1)) {
          const k = Math.round(ms / bar);
          expect(Math.abs(ms - k * bar)).toBeLessThan(30);
        }
      });

      it('segments the song into labelled sections that tile it', () => {
        expect(a.sections.length).toBeGreaterThanOrEqual(2);
        expect(a.sections[0]!.label).toBe('intro');
        for (let i = 1; i < a.sections.length; i++) expect(a.sections[i]!.startMs).toBe(a.sections[i - 1]!.endMs);
      });

      it('proposes non-overlapping highlight windows that start and end on bar lines', () => {
        expect(a.highlights.length).toBeGreaterThan(0);
        for (const h of a.highlights) {
          expect(a.barStartsMs).toContain(h.startMs);
          expect(h.endMs).toBeGreaterThan(h.startMs);
          expect(h.score).toBeGreaterThan(0);
        }
        for (let i = 0; i < a.highlights.length; i++) {
          for (let j = i + 1; j < a.highlights.length; j++) {
            const x = a.highlights[i]!;
            const y = a.highlights[j]!;
            expect(x.startMs < y.endMs && x.endMs > y.startMs).toBe(false);
          }
        }
        // the best highlight skips the two-bar quiet intro the songs start with
        expect(a.highlights[0]!.startMs).toBeGreaterThanOrEqual(a.barStartsMs[2]!);
      });

      it('reports loudness and content bounds', () => {
        expect(a.rmsDb).toBeLessThan(0);
        expect(a.peakDb).toBeLessThanOrEqual(0.1);
        expect(a.contentEndMs).toBeGreaterThan(a.contentStartMs);
      });
    });
  }
});

describe('edge cases', () => {
  it('returns an empty analysis for silence and very short clips instead of throwing', () => {
    const silence = analyzeAudio(new Float32Array(44100 * 5), 44100);
    expect(silence.beatTimesMs).toEqual([]);
    expect(silence.bpm).toBe(0);
    const tiny = analyzeAudio(new Float32Array(500).fill(0.1), 44100);
    expect(tiny.beatTimesMs).toEqual([]);
  });

  it('aligns beats to an impulse train (latency calibration) at a different sample rate', () => {
    const sr = 32000;
    const bpm = 100;
    const period = 60 / bpm;
    const x = new Float32Array(sr * 24);
    const truth: number[] = [];
    for (let t = 0.5; t < 23; t += period) {
      truth.push(Math.round(t * 1000));
      const s = Math.round(t * sr);
      for (let i = 0; i < 400; i++) x[s + i] = (Math.sin(i * 0.35) * Math.exp(-i / 60)) * 0.9;
    }
    const a = analyzeAudio(x, sr);
    expect(Math.abs(a.bpm - bpm)).toBeLessThan(1);
    const errs = a.beatTimesMs.slice(2, -2).map((b) => Math.min(...truth.map((g) => Math.abs(g - b))));
    expect(Math.max(...errs)).toBeLessThanOrEqual(30);
  });

  it('does not invent a confident tempo for noise', () => {
    let s = 1;
    const noise = new Float32Array(22050 * 20).map(() => ((s = (s * 16807) % 2147483647) / 2147483647 - 0.5) * 0.4);
    const a = analyzeAudio(noise, 22050);
    expect(a.tempoConfidence).toBeLessThan(0.75);
  });
});
