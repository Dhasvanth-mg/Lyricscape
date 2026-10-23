// SpotifyBackend: controls and *follows* real Spotify playback through official APIs.
//  - Controls play/pause/seek/volume on whichever Spotify Connect device is active
//    (your phone, desktop app, speaker, or this tab's "Lyricscape" Web Playback device).
//  - Follows what is playing anywhere, so lyrics can run alongside any Spotify song.
//  - Never touches audio data. Position comes from API/SDK state + a PlaybackClock.

import type { Track } from '../../types';
import { PlaybackClock } from '../clock';
import {
  SpotifyApiError,
  getDevices,
  getPlaybackState,
  mapTrack,
  pausePlayback,
  playTrackUri,
  rateLimitedUntil,
  resumePlayback,
  seekPlayback,
  setPlaybackVolume,
  transferPlayback,
  type ApiTrack,
  type SpotifyDevice,
} from '../../spotify/api';
import { SpotifySdk, type SdkState, type SdkStatus } from '../../spotify/sdk';
import type { BackendEvents, BackendErrorKind, LoadOptions, PlaybackBackend } from '../backend';

const kindMap = (k: SpotifyApiError['kind']): BackendErrorKind =>
  k === 'auth' ? 'auth' : k === 'premium' ? 'premium' : k === 'no-device' ? 'device' : k === 'rate-limit' ? 'rate' : k === 'network' ? 'network' : 'generic';

export class SpotifyBackend implements PlaybackBackend {
  readonly kind = 'spotify' as const;
  readonly clock = new PlaybackClock();
  readonly sdk: SpotifySdk;
  private ev: BackendEvents | null = null;
  private expectedId: string | null = null;
  private pendingTrack: Track | null = null;
  private durationMs = 0;
  private playing = false;
  private lastPos = 0;
  private lastPlayingAt = 0;
  private loadedAt = 0;
  private activeDeviceId: string | undefined;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private endTimer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;
  private failures = 0;
  private sdkListeners = new Set<(s: SdkStatus, detail?: string) => void>();

  constructor() {
    this.sdk = new SpotifySdk({
      state: (s) => this.onSdkState(s),
      status: (s, d) => this.sdkListeners.forEach((l) => l(s, d)),
      autoplayFailed: () => this.ev?.error('Browser blocked autoplay. Press play.', 'autoplay'),
    });
  }

  onSdkStatus(cb: (s: SdkStatus, detail?: string) => void) {
    this.sdkListeners.add(cb);
    return () => this.sdkListeners.delete(cb);
  }

  attach(events: BackendEvents) {
    this.ev = events;
  }

  /** Begin following playback (call after connecting). Also spins up the in-browser device. */
  start(opts: { webPlayer: boolean } = { webPlayer: true }) {
    this.disposed = false;
    if (opts.webPlayer) void this.sdk.start();
    this.schedulePoll(50);
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', this.onVisibility);
  }

  private onVisibility = () => {
    if (document.visibilityState === 'visible') this.schedulePoll(100);
  };

  // ---- state ingestion ------------------------------------------------------------------
  private emit(buffering = false) {
    this.ev?.state({ playing: this.playing, buffering, positionMs: this.clock.position(), durationMs: this.durationMs });
  }

  private apply(opts: { id: string | null; track: ApiTrack | null; positionMs: number; playing: boolean; durationMs: number; fromSdk: boolean }) {
    const { id, track, positionMs, playing, durationMs } = opts;
    const now = Date.now();
    const wasPlaying = this.playing;
    const prevPos = this.lastPos;
    const prevDur = this.durationMs;

    // external change (user used another app/device) -> adopt as the current track
    if (id && id !== this.expectedId) {
      const justLoaded = now - this.loadedAt < 3500 && this.expectedId; // stale state from the previous track
      if (!justLoaded) {
        this.expectedId = id;
        this.pendingTrack = null;
        const mapped = track ? mapTrack(track) : null;
        this.clock.reset(positionMs, playing);
        this.durationMs = durationMs;
        this.playing = playing;
        this.lastPos = positionMs;
        this.ev?.external?.(mapped);
        this.emit();
        this.scheduleEndCheck();
        return;
      }
      return;
    }

    // ended: stopped at ~0 right after having been near the end of the same track
    const nearEnd = prevDur > 0 && prevPos >= prevDur - 6000;
    if (!playing && positionMs < 800 && wasPlaying && nearEnd && id === this.expectedId) {
      this.playing = false;
      this.clock.reset(0, false);
      this.lastPos = 0;
      this.ev?.ended();
      return;
    }

    this.durationMs = durationMs || this.durationMs;
    this.playing = playing;
    this.lastPos = positionMs;
    if (playing) this.lastPlayingAt = now;
    this.clock.sync(positionMs, playing);
    this.emit();
    this.scheduleEndCheck();
  }

  private onSdkState(s: SdkState | null) {
    if (!s) return;
    const cur = s.track_window.current_track;
    if (!cur?.id) return;
    const endedByPrev = s.paused && s.position === 0 && s.track_window.previous_tracks.some((t) => t.id === cur.id);
    if (endedByPrev && cur.id === this.expectedId) {
      this.playing = false;
      this.clock.reset(0, false);
      this.ev?.ended();
      return;
    }
    this.activeDeviceId = this.sdk.deviceId ?? this.activeDeviceId;
    this.apply({
      id: cur.id,
      track: { id: cur.id, name: cur.name, duration_ms: cur.duration_ms, artists: cur.artists, album: { name: cur.album.name, images: cur.album.images } },
      positionMs: s.position,
      playing: !s.paused,
      durationMs: s.duration || cur.duration_ms,
      fromSdk: true,
    });
  }

  private schedulePoll(ms: number) {
    if (this.disposed) return;
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.pollTimer = setTimeout(() => void this.poll(), ms);
  }

  private scheduleEndCheck() {
    if (this.endTimer) clearTimeout(this.endTimer);
    if (!this.playing || !this.durationMs) return;
    const remaining = this.durationMs - this.clock.position();
    if (remaining > 0 && remaining < 120_000) this.endTimer = setTimeout(() => void this.poll(), remaining + 500);
  }

  private async poll() {
    if (this.disposed) return;
    const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
    let next = hidden ? 10_000 : this.playing ? 3500 : 7000;
    try {
      const st = await getPlaybackState();
      this.failures = 0;
      if (!st || !st.item) {
        // nothing playing anywhere
        if (this.playing) {
          this.playing = false;
          this.clock.setPlaying(false);
          this.emit();
        }
      } else if (st.currently_playing_type && st.currently_playing_type !== 'track') {
        this.ev?.external?.(null);
      } else {
        this.activeDeviceId = st.device?.id ?? this.activeDeviceId;
        const age = st.is_playing ? Math.min(2000, Math.max(0, Date.now() - st.timestamp)) : 0;
        this.apply({
          id: st.item.id,
          track: st.item,
          positionMs: (st.progress_ms ?? 0) + (Number.isFinite(age) ? age : 0),
          playing: st.is_playing,
          durationMs: st.item.duration_ms,
          fromSdk: false,
        });
      }
    } catch (e) {
      this.failures++;
      if (e instanceof SpotifyApiError) {
        if (e.kind === 'rate-limit') next = Math.max(next, (e.retryAfterMs ?? 5000) + 500);
        else if (e.kind === 'auth') {
          this.ev?.error(e.message, 'auth');
          return; // stop polling until reconnect
        } else if (this.failures === 1 || this.failures % 5 === 0) this.ev?.error(e.message, kindMap(e.kind));
      }
      next = Math.min(30_000, next * Math.min(4, this.failures));
    }
    this.schedulePoll(Math.max(next, rateLimitedUntil() - Date.now() + 200));
  }

  // ---- commands --------------------------------------------------------------------------
  private async pickDevice(): Promise<string | undefined> {
    const devices: SpotifyDevice[] = await getDevices();
    const active = devices.find((d) => d.is_active && d.id && !d.is_restricted);
    if (active?.id) return active.id;
    const sdkId = this.sdk.deviceId ?? (await this.sdk.start());
    if (sdkId) {
      await this.sdk.activate();
      await transferPlayback(sdkId, false).catch(() => undefined);
      return sdkId;
    }
    const first = devices.find((d) => d.id && !d.is_restricted);
    if (first?.id) return first.id;
    throw new SpotifyApiError('No Spotify device available. Open Spotify on your phone/desktop, or use Premium for the in-browser player.', 'no-device', 404);
  }

  async load(track: Track, opts: LoadOptions) {
    if (!track.providerTrackId) return;
    this.expectedId = track.providerTrackId;
    this.durationMs = track.durationMs;
    this.loadedAt = Date.now();
    this.clock.reset(opts.startMs ?? 0, false);
    this.playing = false;
    if (!opts.autoplay) {
      // Spotify cannot "cue" a track without starting it: remember it and start on play().
      this.pendingTrack = track;
      this.emit();
      return;
    }
    await this.startTrack(track, opts.startMs ?? 0);
  }

  private async startTrack(track: Track, startMs: number) {
    try {
      await this.sdk.activate();
      const device = await this.pickDevice();
      await playTrackUri(track.providerTrackId!, device, startMs);
      this.pendingTrack = null;
      this.activeDeviceId = device;
      this.loadedAt = Date.now();
      this.playing = true;
      this.clock.reset(startMs, true);
      this.emit(true);
      this.schedulePoll(900);
    } catch (e) {
      this.fail(e);
    }
  }

  private fail(e: unknown) {
    if (e instanceof SpotifyApiError) this.ev?.error(e.message, kindMap(e.kind));
    else this.ev?.error((e as Error).message || 'Spotify command failed', 'generic' as never);
  }

  async play() {
    try {
      if (this.pendingTrack) return this.startTrack(this.pendingTrack, this.clock.position());
      await this.sdk.activate();
      await resumePlayback(this.activeDeviceId);
      this.playing = true;
      this.clock.setPlaying(true);
      this.emit();
      this.schedulePoll(800);
    } catch (e) {
      this.fail(e);
    }
  }

  async pause() {
    try {
      await pausePlayback(this.activeDeviceId);
      this.playing = false;
      this.clock.setPlaying(false);
      this.emit();
      this.schedulePoll(800);
    } catch (e) {
      this.fail(e);
    }
  }

  async seek(positionMs: number) {
    this.clock.reset(positionMs, this.playing);
    this.lastPos = positionMs;
    this.emit();
    if (this.pendingTrack) return;
    try {
      await seekPlayback(positionMs, this.activeDeviceId);
      this.schedulePoll(1200);
    } catch (e) {
      this.fail(e);
    }
  }

  setVolume(volume: number, muted: boolean) {
    const v = muted ? 0 : volume;
    this.sdk.setVolume(v);
    if (this.activeDeviceId && this.activeDeviceId !== this.sdk.deviceId) {
      void setPlaybackVolume(v * 100, this.activeDeviceId).catch(() => undefined);
    }
  }

  positionMs() {
    return this.clock.position();
  }

  stop() {
    this.disposed = true;
    if (this.pollTimer) clearTimeout(this.pollTimer);
    if (this.endTimer) clearTimeout(this.endTimer);
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.onVisibility);
  }

  dispose() {
    this.stop();
    this.sdk.dispose();
  }
}
