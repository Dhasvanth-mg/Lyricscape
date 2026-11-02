'use client';

// Listening to what this tab is playing (the Spotify Web Playback SDK plays in this tab), so its tempo can be learned.
// The browser asks the person to share THIS tab with its audio; nothing is recorded or kept: the sound goes through a tiny
// processor that hands blocks of samples to the analyser, which keeps numbers (see features.ts) and throws the samples away.
// Needs a Chromium browser (Chrome, Edge, Brave) and a click: it cannot start by itself.

const WORKLET = `
class Tap extends AudioWorkletProcessor {
  constructor() { super(); this.buf = new Float32Array(4096); this.n = 0; }
  process(inputs) {
    const ch = inputs[0];
    if (!ch || !ch[0]) return true;
    const L = ch[0];
    const R = ch[1] || L;
    for (let i = 0; i < L.length; i++) {
      this.buf[this.n++] = (L[i] + R[i]) * 0.5;
      if (this.n === this.buf.length) { this.port.postMessage(this.buf.slice(0)); this.n = 0; }
    }
    return true;
  }
}
registerProcessor('ls-tap', Tap);
`;

export type CaptureStatus = 'off' | 'asking' | 'on' | 'error';

export class AudioCapture {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private node: AudioWorkletNode | null = null;
  status: CaptureStatus = 'off';
  sampleRate = 0;
  /** told about every block: mono samples at `sampleRate` */
  onBlock: (samples: Float32Array, sampleRate: number) => void = () => undefined;
  /** told when sharing stops (the person ended it, or the tab closed) */
  onEnd: () => void = () => undefined;

  static supported(): boolean {
    return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia && typeof AudioWorkletNode !== 'undefined';
  }

  /** Must be called from a click. Resolves when listening has begun; throws with a readable message otherwise. */
  async start(): Promise<void> {
    if (this.status === 'on') return;
    if (!AudioCapture.supported()) throw new Error('This browser cannot share tab audio. Use Chrome, Edge or Brave.');
    this.status = 'asking';
    try {
      const opts = { video: true, audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, preferCurrentTab: true, selfBrowserSurface: 'include', systemAudio: 'exclude' } as DisplayMediaStreamOptions;
      const stream = await navigator.mediaDevices.getDisplayMedia(opts);
      const audio = stream.getAudioTracks();
      if (!audio.length) {
        stream.getTracks().forEach((t) => t.stop());
        throw new Error('No audio was shared. Choose this tab and tick "Share tab audio".');
      }
      // the picture is not wanted: switch it off and ask for the smallest, slowest one the browser will give
      for (const v of stream.getVideoTracks()) {
        v.enabled = false;
        void v.applyConstraints({ width: 2, height: 2, frameRate: 1 }).catch(() => undefined);
      }
      const ctx = new AudioContext();
      await ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' })));
      const src = ctx.createMediaStreamSource(new MediaStream(audio));
      const node = new AudioWorkletNode(ctx, 'ls-tap', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
      node.port.onmessage = (e: MessageEvent<Float32Array>) => this.onBlock(e.data, ctx.sampleRate);
      // a worklet is only run if it is connected to the output; a gain of zero keeps it silent (no second copy of the music)
      const mute = ctx.createGain();
      mute.gain.value = 0;
      src.connect(node);
      node.connect(mute);
      mute.connect(ctx.destination);
      for (const t of stream.getTracks()) t.addEventListener('ended', () => this.stop(), { once: true });
      this.ctx = ctx;
      this.stream = stream;
      this.node = node;
      this.sampleRate = ctx.sampleRate;
      this.status = 'on';
    } catch (e) {
      this.status = 'error';
      this.cleanup();
      throw e instanceof Error ? e : new Error('Could not start listening.');
    }
  }

  stop(): void {
    const was = this.status;
    this.cleanup();
    this.status = 'off';
    if (was === 'on') this.onEnd();
  }

  private cleanup() {
    try {
      this.node?.disconnect();
    } catch {
      /* already gone */
    }
    this.stream?.getTracks().forEach((t) => t.stop());
    void this.ctx?.close().catch(() => undefined);
    this.node = null;
    this.stream = null;
    this.ctx = null;
  }
}

/**
 * Where in the song each block of samples is. The playback position is read when a block arrives, which jitters by some
 * milliseconds; the sample count does not. So the offset between "samples heard so far" and "song position" is estimated as the median
 * of recent readings, and a block is placed by its sample count. A seek shows up as readings that suddenly disagree.
 */
export class ChunkClock {
  private est: number[] = [];
  private samples = 0;
  private odd = 0;
  /** place a block: returns the song time (ms) of its first sample, or null if it should be dropped (the position is not moving) */
  place(len: number, sampleRate: number, positionMs: number): number | null {
    this.samples += len;
    const reading = positionMs - (1000 * this.samples) / sampleRate;
    if (this.est.length >= 5) {
      const med = median(this.est);
      if (Math.abs(reading - med) > 300) {
        // not where it was: a seek, or playback was paused/resumed. Wait for three readings that agree with each other before trusting a new offset.
        if (++this.odd >= 3) {
          this.est = [reading];
          this.odd = 0;
        }
        return null;
      }
      this.odd = 0;
    }
    this.est.push(reading);
    if (this.est.length > 25) this.est.shift();
    if (this.est.length < 3) return null; // too few readings yet to trust
    return median(this.est) + (1000 * (this.samples - len)) / sampleRate;
  }
  reset() {
    this.est = [];
    this.odd = 0;
  }
}

const median = (a: number[]) => {
  const s = [...a].sort((x, y) => x - y);
  return s[s.length >> 1]!;
};
