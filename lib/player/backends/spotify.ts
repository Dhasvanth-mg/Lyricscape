// SpotifyBackend: controls and *follows* real Spotify playback through official APIs.
//  - Controls play/pause/seek/volume on whichever Spotify Connect device is active
//    (your phone, desktop app, speaker, or this tab's "Lyricscape" Web Playback device).
//  - Follows what is playing anywhere, so lyrics can run alongside any Spotify song.
//  - Never touches audio data. Position comes from API/SDK state + a PlaybackClock.

import type { Track } from '../../types';
import { PlaybackClock } from '../clock';
import { TelemetryAgeEstimator, telemetryAgeMs } from '../telemetry';
import { syncDiag } from '../syncDiag';
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
  private readonly telemetry = new TelemetryAgeEstimator();
  /** Commands (seek/play/pause/start) sent but not yet confirmed by Spotify. Telemetry read meanwhile is pre-command. */
  private commandsInFlight = 0;

  private async command<T>(fn: () => Promise<T>): Promise<T> {
    this.commandsInFlight++;
    try {
      return await fn();
    } finally {
      this.commandsInFlight--;
      this.clock.bump(); // anything requested before Spotify confirmed the command may describe the old state
    }
  }
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
  private browserSelected = false;
  private volume = 0.85;
  private muted = false;
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
      commandError: (message) => this.ev?.error(message, 'generic'),
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

  private apply(opts: {
    id: string | null;
    track: ApiTrack | null;
    positionMs: number;
    playing: boolean;
    durationMs: number;
    fromSdk: boolean;
    pushed?: boolean;
    /** local clock time (performance.now base) at which positionMs was true */
    validAt?: number;
    /** the clock epoch when this report was requested; a mismatch means a seek/pause/load happened since */
    epoch?: number;
  }) {
    const { id, track, positionMs, playing, durationMs } = opts;
    // The report describes a moment before the latest command: applying it would drag the clock (and the play/pause
    // state) back to the past. Drop it and look again shortly.
    if ((opts.epoch !== undefined && opts.epoch !== this.clock.epoch) || (!opts.fromSdk && this.commandsInFlight > 0)) {
      this.schedulePoll(400);
      return;
    }
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

    const result = this.clock.observe({ positionMs, playing, validAt: opts.validAt, epoch: opts.epoch, pushed: opts.fromSdk && opts.pushed !== false });
    if (result === 'stale') return;
    // A restored session may have queued this same song without starting it. Live telemetry confirms it is already loaded.
    if (id === this.expectedId) this.pendingTrack = null;
    this.durationMs = durationMs || this.durationMs;
    this.playing = playing;
    this.lastPos = positionMs;
    if (playing) this.lastPlayingAt = now;
    this.emit();
    this.scheduleEndCheck();
  }

  private onSdkState(s: SdkState | null, pushed = true) {
    if (!s || this.disposed || this.commandsInFlight > 0) return;
    if (!this.browserSelected && this.activeDeviceId && this.activeDeviceId !== this.sdk.deviceId) return;
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
    if (syncDiag.enabled()) syncDiag.sdk({ wall: Date.now(), positionMs: s.position, paused: s.paused, sdkTimestamp: (s as unknown as { timestamp?: number }).timestamp, clockPositionMs: this.clock.position() });
    this.apply({
      id: cur.id,
      track: { id: cur.id, name: cur.name, duration_ms: cur.duration_ms, artists: cur.artists, album: { name: cur.album.name, images: cur.album.images } },
      positionMs: s.position,
      playing: !s.paused,
      durationMs: s.duration || cur.duration_ms,
      fromSdk: true,
      pushed,
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
      const epoch = this.clock.epoch;
      // The browser SDK reports its own position, without a server timestamp or PC clock skew.
      if (this.browserSelected) {
        const local = await this.sdk.getState();
        if (this.disposed || epoch !== this.clock.epoch || this.commandsInFlight > 0) return this.schedulePoll(400);
        if (local) {
          this.onSdkState(local, false);
        } else if (this.playing) {
          this.playing = false;
          this.clock.setPlaying(false);
          this.emit();
        }
        this.schedulePoll(hidden ? 5000 : 1000);
        return;
      }
      const t0 = performance.now();
      const st = await getPlaybackState();
      const t1 = performance.now();
      if (this.disposed || epoch !== this.clock.epoch || this.commandsInFlight > 0) return this.schedulePoll(400);
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
        // how long before receipt was progress_ms true? The formula real use was calibrated against (lib/player/telemetry.ts).
        const wall = Date.now();
        const age = telemetryAgeMs(st.timestamp, wall);
        if (syncDiag.enabled()) {
          syncDiag.poll({ wall, perf: t1, rttMs: t1 - t0, timestamp: st.timestamp, progressMs: st.progress_ms ?? 0, playing: st.is_playing, trackId: st.item.id ?? "", appliedAgeMs: st.is_playing ? age : 0, shadowAgeMs: this.telemetry.ageAtReceipt(st.timestamp, wall, t1 - t0), positionBeforeMs: this.clock.position(), epoch, commandsInFlight: this.commandsInFlight });
        }
        this.apply({
          id: st.item.id,
          track: st.item,
          positionMs: st.progress_ms ?? 0,
          playing: st.is_playing,
          durationMs: st.item.duration_ms,
          fromSdk: false,
          validAt: t1 - (st.is_playing ? age : 0),
          epoch,
        });
        if (syncDiag.enabled()) syncDiag.patchLast(this.clock.position());
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
  async selectBrowser(volume = this.volume, muted = this.muted) {
    // Invoke activation before awaiting network work, while still in the click's event path.
    const activation = this.sdk.activate();
    const id = this.sdk.deviceId ?? await this.sdk.start();
    await activation;
    if (!id) throw new SpotifyApiError('Browser player unavailable. Check Premium and reconnect Spotify in Settings.', 'no-device', 404);
    this.clock.bump();
    await this.command(() => transferPlayback(id, this.playing));
    this.browserSelected = true;
    this.activeDeviceId = id;
    this.setVolume(volume, muted);
    this.schedulePoll(100);
  }

  followActiveDevice() {
    this.browserSelected = false;
    this.activeDeviceId = undefined;
    this.clock.bump();
    this.schedulePoll(100);
  }

  private async pickDevice(): Promise<string | undefined> {
    if (this.browserSelected) {
      const id = this.sdk.deviceId ?? await this.sdk.start();
      if (!id) throw new SpotifyApiError('The browser player is offline. Reconnect in Settings.', 'no-device', 404);
      return id;
    }
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
      await this.command(() => playTrackUri(track.providerTrackId!, device, startMs));
      this.pendingTrack = null;
      this.activeDeviceId = device;
      this.setVolume(this.volume, this.muted);
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
      await this.command(() => resumePlayback(this.activeDeviceId));
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
      await this.command(() => pausePlayback(this.activeDeviceId));
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
      await this.command(() => seekPlayback(positionMs, this.activeDeviceId));
      this.schedulePoll(1200);
    } catch (e) {
      this.fail(e);
    }
  }

  setVolume(volume: number, muted: boolean) {
    this.volume = volume;
    this.muted = muted;
    const v = muted ? 0 : volume;
    if (this.browserSelected || this.activeDeviceId === this.sdk.deviceId) this.sdk.setVolume(v);
    else if (this.activeDeviceId) {
      void setPlaybackVolume(v * 100, this.activeDeviceId).catch((e) => this.fail(e));
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
