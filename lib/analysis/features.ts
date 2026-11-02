// Streaming feature extraction: feed it the sound of a song in any size of pieces, each tagged with where in the song it starts,
// and it fills in onset strength (spectral flux), loudness and brightness at fixed steps along the song's own timeline.
// It works the same on a decoded file (all at once, faster than real time) and on a live capture (heard while it plays, with gaps
// if the listener skipped around). What comes out is numbers; the audio is never kept.

import { FFT } from './fft';
import { analyseTempo } from './tempo';
import { AUDIO_FEATURES_VERSION, ENERGY_STEP_MS, ONSET_HOP_MS, type AudioFeatures } from './types';

export const toBase64 = (u8: Uint8Array): string => {
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return btoa(s);
};
export const fromBase64 = (b64: string): Uint8Array => {
  const s = atob(b64);
  const u8 = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
  return u8;
};

/** onset values are stored as bytes: this maps the (log-compressed) flux range to 0..255 and back */
const FLUX_SCALE = 40;

export class FeatureTrack {
  readonly durationMs: number;
  readonly onset: Float32Array;
  readonly heard: Uint8Array;
  readonly energy: Uint8Array;
  /** slow running level of the sound (RMS), for the gain stage below */
  private level = 0;
  private silentFrames = 0;
  private loudSum = 0;
  private loudN = 0;
  private centroidSum = 0;
  private centroidN = 0;

  // streaming state
  private sr = 0;
  private fft: FFT | null = null;
  private frame = 0;
  private win: Float32Array | null = null;
  private re: Float32Array | null = null;
  private im: Float32Array | null = null;
  private prevLog: Float32Array | null = null;
  private buf = new Float32Array(0);
  private bufLen = 0;
  private bufStartMs = 0;

  constructor(durationMs: number) {
    this.durationMs = Math.max(1000, Math.round(durationMs));
    const n = Math.ceil(this.durationMs / ONSET_HOP_MS) + 4;
    this.onset = new Float32Array(n);
    this.heard = new Uint8Array(n);
    this.energy = new Uint8Array(Math.ceil(this.durationMs / ENERGY_STEP_MS) + 2);
  }

  private setup(sampleRate: number) {
    if (this.sr === sampleRate && this.fft) return;
    this.sr = sampleRate;
    this.frame = 1 << Math.max(8, Math.round(Math.log2(sampleRate * 0.046)));
    this.fft = new FFT(this.frame);
    this.win = new Float32Array(this.frame);
    for (let i = 0; i < this.frame; i++) this.win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (this.frame - 1));
    this.re = new Float32Array(this.frame);
    this.im = new Float32Array(this.frame);
    this.prevLog = null;
    this.bufLen = 0;
  }

  /**
   * Add mono samples that begin at `startMs` of the song. Pieces may be any size. If this piece does not continue the previous one
   * (a seek, or a gap in the capture) the analysis restarts there; what was heard before is kept.
   */
  pushPcm(samples: Float32Array, sampleRate: number, startMs: number): void {
    this.setup(sampleRate);
    const expected = this.bufStartMs + (this.bufLen * 1000) / sampleRate;
    if (this.bufLen > 0 && Math.abs(startMs - expected) > 80) {
      this.bufLen = 0;
      this.prevLog = null;
    }
    if (this.bufLen === 0) this.bufStartMs = startMs;
    if (this.buf.length < this.bufLen + samples.length) {
      const next = new Float32Array(Math.max(this.bufLen + samples.length, this.buf.length * 2, this.frame * 4));
      next.set(this.buf.subarray(0, this.bufLen));
      this.buf = next;
    }
    this.buf.set(samples, this.bufLen);
    this.bufLen += samples.length;

    const N = this.frame;
    const hop = N >> 1;
    const sr = this.sr;
    const lowBin = Math.max(1, Math.floor((30 * N) / sr));
    const highBin = Math.min(N / 2 - 1, Math.ceil((8000 * N) / sr));
    const nBins = highBin - lowBin + 1;
    // the beat is mostly felt in the low end: weigh flux in three bands (bass, mids, highs) instead of letting the many high bins dominate
    const bassEnd = Math.min(highBin, Math.floor((200 * N) / sr)) - lowBin;
    const midEnd = Math.min(highBin, Math.floor((2000 * N) / sr)) - lowBin;
    let pos = 0;
    while (pos + N <= this.bufLen) {
      const re = this.re!;
      const im = this.im!;
      const win = this.win!;
      let e = 0;
      for (let i = 0; i < N; i++) {
        const v = this.buf[pos + i]!;
        e += v * v;
        re[i] = v * win[i]!;
        im[i] = 0;
      }
      const rms = Math.sqrt(e / N);
      // A gain stage: a capture can arrive very quiet (a low tab or system volume), and quiet sound has less contrast in the log spectrum.
      // Scale each frame so the running level sits near a fixed point (never reducing, at most 150x), so the beat does not depend on the volume.
      this.level = this.level === 0 ? rms : rms > this.level ? 0.5 * this.level + 0.5 * rms : this.level * 0.9993 + rms * 0.0007;
      const gain = this.level > 1e-4 ? Math.min(150, Math.max(1, 0.1 / this.level)) : 1;
      if (gain !== 1) for (let i = 0; i < N; i++) re[i] = re[i]! * gain;
      const centerMs = this.bufStartMs + ((pos + N / 2) * 1000) / sr;
      const bin = Math.round(centerMs / ONSET_HOP_MS);
      // A short stretch of digital silence is part of the music (a gated kick, a break); a long one says nothing about the song (a capture of a
      // tab that is not playing it): after 1.5 s it is left unheard.
      if (rms <= 1e-4) {
        this.prevLog = null;
        this.silentFrames++;
        if (this.silentFrames * ((N >> 1) * 1000 / sr) < 1500 && bin >= 0 && bin < this.onset.length && !this.heard[bin]) this.heard[bin] = 1;
      } else this.silentFrames = 0;
      if (rms > 1e-4 && bin >= 0 && bin < this.onset.length) {
        let flux = 0;
        if (rms > 1e-4) {
          this.fft!.transform(re, im);
          const cur = new Float32Array(nBins);
          let csum = 0;
          let msum = 0;
          for (let k = 0; k < nBins; k++) {
            const kk = lowBin + k;
            const mag = Math.hypot(re[kk]!, im[kk]!) / (N * 0.25);
            const l = Math.log1p(500 * mag);
            cur[k] = l;
            csum += mag * kk;
            msum += mag;
          }
          if (this.prevLog) {
            let fb = 0;
            let fm = 0;
            let fh = 0;
            for (let k = 0; k < nBins; k++) {
              const d = cur[k]! - this.prevLog[k]!;
              if (d <= 0) continue;
              if (k <= bassEnd) fb += d;
              else if (k <= midEnd) fm += d;
              else fh += d;
            }
            const nb = Math.max(1, bassEnd + 1);
            const nm = Math.max(1, midEnd - bassEnd);
            const nh = Math.max(1, nBins - 1 - midEnd);
            flux = 0.55 * (fb / nb) + 0.3 * (fm / nm) + 0.15 * (fh / nh);
          }
          this.prevLog = cur;
          if (msum > 1e-6) {
            this.centroidSum += Math.min(1, ((csum / msum) * sr) / N / 8000);
            this.centroidN++;
          }
        } else this.prevLog = null;
        if (flux > this.onset[bin]! || !this.heard[bin]) this.onset[bin] = flux;
        this.heard[bin] = 1;
      }
      const eb = Math.round(centerMs / ENERGY_STEP_MS);
      if (eb >= 0 && eb < this.energy.length) {
        const db = rms > 1e-6 ? 20 * Math.log10(rms) : -120;
        const u = Math.max(0, Math.min(255, Math.round(((db + 60) / 60) * 255)));
        if (u > this.energy[eb]!) this.energy[eb] = u;
        if (db > -90) {
          this.loudSum += db;
          this.loudN++;
        }
      }
      pos += hop;
    }
    if (pos > 0) {
      this.buf.copyWithin(0, pos, this.bufLen);
      this.bufLen -= pos;
      this.bufStartMs += (pos * 1000) / sr;
    }
  }

  /** Fold in what another pass heard (a later play, or a file analysis of the same recording). */
  merge(other: FeatureTrack): boolean {
    if (Math.abs(other.durationMs - this.durationMs) > 3000) return false;
    const n = Math.min(this.onset.length, other.onset.length);
    for (let i = 0; i < n; i++) {
      if (!other.heard[i]) continue;
      this.onset[i] = this.heard[i] ? Math.max(this.onset[i]!, other.onset[i]!) : other.onset[i]!;
      this.heard[i] = 1;
    }
    const m = Math.min(this.energy.length, other.energy.length);
    for (let i = 0; i < m; i++) if (other.energy[i]! > this.energy[i]!) this.energy[i] = other.energy[i]!;
    if (other.loudN) {
      this.loudSum += other.loudSum;
      this.loudN += other.loudN;
    }
    if (other.centroidN) {
      this.centroidSum += other.centroidSum;
      this.centroidN += other.centroidN;
    }
    return true;
  }

  /** Heard stretches as [startMs, endMs], bridging gaps of up to three steps (the frame grid is not perfectly regular). */
  coveredRuns(): [number, number][] {
    const out: [number, number][] = [];
    let start = -1;
    let last = -1;
    for (let i = 0; i < this.heard.length; i++) {
      if (!this.heard[i]) continue;
      if (start < 0) start = last = i;
      else if (i - last <= 3) last = i;
      else {
        out.push([Math.round(start * ONSET_HOP_MS), Math.round((last + 1) * ONSET_HOP_MS)]);
        start = last = i;
      }
    }
    if (start >= 0) out.push([Math.round(start * ONSET_HOP_MS), Math.round((last + 1) * ONSET_HOP_MS)]);
    return out;
  }

  heardMs(): number {
    return this.coveredRuns().reduce((a, [s, e]) => a + (e - s), 0);
  }

  toFeatures(source: AudioFeatures['source'], now = Date.now()): AudioFeatures {
    // fill one-step holes so the tempo pass sees continuous stretches
    const heard = this.heard.slice();
    for (let i = 1; i < heard.length - 1; i++) if (!heard[i] && heard[i - 1] && heard[i + 1]) heard[i] = 1;
    const t = analyseTempo(this.onset, heard);
    const onsetBytes = new Uint8Array(this.onset.length);
    for (let i = 0; i < onsetBytes.length; i++) onsetBytes[i] = this.heard[i] ? Math.max(0, Math.min(255, Math.round(this.onset[i]! * FLUX_SCALE * 6))) : 0;
    return {
      version: AUDIO_FEATURES_VERSION,
      source,
      durationMs: this.durationMs,
      onset: toBase64(onsetBytes),
      covered: this.coveredRuns(),
      energy: toBase64(this.energy),
      bpm: t.bpm,
      bpmConfidence: Math.round(t.confidence * 1000) / 1000,
      beatTimesMs: t.beatTimesMs,
      loudnessDb: this.loudN ? Math.round((this.loudSum / this.loudN) * 10) / 10 : null,
      brightness: this.centroidN ? Math.round((this.centroidSum / this.centroidN) * 1000) / 1000 : null,
      analyzedAt: now,
    };
  }

  /** Rebuild a track from stored features so a later play can add to it. */
  static fromFeatures(f: AudioFeatures): FeatureTrack {
    const t = new FeatureTrack(f.durationMs);
    const on = fromBase64(f.onset);
    const n = Math.min(on.length, t.onset.length);
    for (let i = 0; i < n; i++) t.onset[i] = on[i]! / (FLUX_SCALE * 6);
    for (const [a, b] of f.covered) {
      const i0 = Math.max(0, Math.round(a / ONSET_HOP_MS));
      const i1 = Math.min(t.heard.length, Math.round(b / ONSET_HOP_MS));
      for (let i = i0; i < i1; i++) t.heard[i] = 1;
    }
    const en = fromBase64(f.energy);
    t.energy.set(en.subarray(0, Math.min(en.length, t.energy.length)));
    return t;
  }
}

/** Analyse mono PCM that starts at 0 (a decoded file). Yields to the event loop between pieces so a page stays responsive. */
export async function analysePcm(mono: Float32Array, sampleRate: number, opts: { durationMs?: number; onProgress?: (p: number) => void; yieldFn?: () => Promise<void>; source?: AudioFeatures['source'] } = {}): Promise<AudioFeatures> {
  const durationMs = opts.durationMs ?? (mono.length * 1000) / sampleRate;
  const track = new FeatureTrack(durationMs);
  const piece = Math.round(sampleRate * 2);
  for (let i = 0; i < mono.length; i += piece) {
    track.pushPcm(mono.subarray(i, Math.min(mono.length, i + piece)), sampleRate, (i * 1000) / sampleRate);
    if (opts.yieldFn) {
      opts.onProgress?.(Math.min(1, (i + piece) / mono.length));
      await opts.yieldFn();
    }
  }
  return track.toFeatures(opts.source ?? 'file');
}
