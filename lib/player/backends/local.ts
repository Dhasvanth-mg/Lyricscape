// LocalBackend: HTMLAudioElement playback for demo + user-imported (licensed) audio.
// This is the source that has real PCM access, so analysis / DJ / export work here.

import type { Track } from '../../types';
import { getLocalTrack } from '../../library/db';
import type { BackendEvents, LoadOptions, PlaybackBackend } from '../backend';

const MEDIA_ERRORS: Record<number, string> = {
  1: 'Playback was aborted.',
  2: 'A network error interrupted the audio.',
  3: 'The audio file could not be decoded (corrupt or unsupported).',
  4: 'This audio format is not supported by your browser, or the file is missing.',
};

export class LocalBackend implements PlaybackBackend {
  readonly kind = 'local' as const;
  readonly audio: HTMLAudioElement;
  private ev: BackendEvents | null = null;
  private objectUrl: string | null = null;
  private loadToken = 0;
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private lastTick = 0;

  constructor() {
    const a = new Audio();
    a.preload = 'auto';
    a.crossOrigin = 'anonymous';
    this.audio = a;
    const emit = () => this.emitState();
    a.addEventListener('playing', emit);
    a.addEventListener('pause', emit);
    a.addEventListener('waiting', emit);
    a.addEventListener('canplay', emit);
    a.addEventListener('seeked', emit);
    a.addEventListener('durationchange', emit);
    a.addEventListener('timeupdate', () => {
      const now = performance.now();
      if (now - this.lastTick > 250) {
        this.lastTick = now;
        emit();
      }
    });
    a.addEventListener('ended', () => this.ev?.ended());
    a.addEventListener('error', () => {
      if (!a.src) return;
      const code = a.error?.code ?? 0;
      this.ev?.error(MEDIA_ERRORS[code] ?? 'Audio playback failed.', code === 2 ? 'network' : 'decode');
    });
  }

  attach(events: BackendEvents) {
    this.ev = events;
  }

  private emitState() {
    const a = this.audio;
    this.ev?.state({
      playing: !a.paused && !a.ended,
      buffering: !a.paused && a.readyState < 3,
      positionMs: a.currentTime * 1000,
      durationMs: Number.isFinite(a.duration) ? a.duration * 1000 : 0,
    });
  }

  private async resolveUrl(track: Track): Promise<string> {
    const url = track.audioUrl;
    if (!url) throw new Error('This track has no playable audio source.');
    if (!url.startsWith('idb:')) return url;
    const stored = await getLocalTrack(url.slice(4));
    if (!stored) throw new Error('The imported file is no longer in your library.');
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = URL.createObjectURL(stored.blob);
    return this.objectUrl;
  }

  async load(track: Track, opts: LoadOptions) {
    const token = ++this.loadToken;
    const a = this.audio;
    a.pause();
    let src: string;
    try {
      src = await this.resolveUrl(track);
    } catch (e) {
      if (token === this.loadToken) this.ev?.error((e as Error).message, 'unavailable');
      return;
    }
    if (token !== this.loadToken) return; // superseded by a newer load (rapid skipping)
    a.src = src;
    a.currentTime = 0;
    a.load();
    if (opts.startMs) {
      const seekWhenReady = () => {
        a.currentTime = (opts.startMs ?? 0) / 1000;
      };
      a.addEventListener('loadedmetadata', seekWhenReady, { once: true });
    }
    this.emitState();
    if (opts.autoplay) await this.play(token);
  }

  async play(token = this.loadToken) {
    try {
      await this.ensureContext();
      await this.audio.play();
    } catch (e) {
      if (token !== this.loadToken) return;
      const err = e as DOMException;
      if (err.name === 'NotAllowedError') this.ev?.error('Your browser blocked autoplay. Press play to start.', 'autoplay');
      else if (err.name !== 'AbortError') this.ev?.error(err.message || 'Could not start playback.', 'generic' as never);
    }
  }

  async pause() {
    this.audio.pause();
  }

  async seek(positionMs: number) {
    const a = this.audio;
    const dur = Number.isFinite(a.duration) ? a.duration : Infinity;
    a.currentTime = Math.max(0, Math.min(positionMs / 1000, dur - 0.01));
    this.emitState();
  }

  setVolume(volume: number, muted: boolean) {
    this.audio.volume = Math.min(1, Math.max(0, volume));
    this.audio.muted = muted;
  }

  positionMs() {
    return this.audio.currentTime * 1000;
  }

  /** The element's clock runs ahead of what you hear by the audio stack's latency (the graph is routed through ctx). */
  outputLatencyMs() {
    const c = this.ctx;
    if (!c) return 0;
    const ms = ((c.baseLatency || 0) + ((c as AudioContext & { outputLatency?: number }).outputLatency || 0)) * 1000;
    return Number.isFinite(ms) ? Math.min(500, Math.max(0, ms)) : 0;
  }

  /** Lazily create the Web Audio graph (needed for bass/waveform visualisation of local audio). */
  private async ensureContext() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      return;
    }
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      const src = ctx.createMediaElementSource(this.audio);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.7;
      src.connect(analyser);
      analyser.connect(ctx.destination);
      this.ctx = ctx;
      this.analyser = analyser;
    } catch {
      /* analysis is optional; playback still works through the element */
    }
  }

  /** Live bass energy 0..1 from the analyser (local audio only). */
  bassLevel(): number {
    const an = this.analyser;
    if (!an) return 0;
    const buf = new Uint8Array(an.frequencyBinCount);
    an.getByteFrequencyData(buf);
    let sum = 0;
    const n = Math.max(1, Math.floor(buf.length * 0.06));
    for (let i = 0; i < n; i++) sum += buf[i]!;
    return sum / n / 255;
  }

  getAnalyser() {
    return this.analyser;
  }

  dispose() {
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load();
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    void this.ctx?.close();
  }
}
