'use client';

// PlayerController: the sole command entry point. State machine:
//   idle/ready -> loading -> playing <-> paused (+ buffering) -> ended/error/unavailable
// Drives exactly one backend at a time (local audio element, or Spotify).

import { create } from 'zustand';
import type { PlaybackCapabilities, PlayerStatus, RepeatMode, Track } from '../types';
import type { BackendErrorKind, BackendEvents, PlaybackBackend } from './backend';
import { LocalBackend } from './backends/local';
import { SpotifyBackend } from './backends/spotify';
import {
  currentEntry,
  emptyQueue,
  enqueue,
  jumpTo,
  moveEntry,
  nextQid,
  prevQid,
  removeEntry,
  replaceUpcoming,
  setQueue,
  setRepeat,
  setShuffle,
  type QueueState,
} from './queue';
import { bindController, providers, spotifyCapabilities } from './providers';
import { isConnected } from '../spotify/auth';

export type PlayerState = {
  status: PlayerStatus;
  track: Track | null;
  durationMs: number;
  /** Updated a few times per second; use getPositionMs() for smooth UI. */
  positionMs: number;
  volume: number;
  muted: boolean;
  queue: QueueState;
  error: { message: string; kind: BackendErrorKind } | null;
  notice: string | null;
  capabilities: PlaybackCapabilities;
  following: boolean;
  spotify: { connected: boolean; sdk: string; sdkDetail: string; output: 'active' | 'browser' };
};

const NO_CAPS: PlaybackCapabilities = {
  play: false, seek: false, queueRead: false, queueWrite: false, deviceTransfer: false,
  synchronizedVisuals: false, audioAnalysis: false, djMixing: false, videoExport: false, artworkCompositing: false,
};

export const usePlayer = create<PlayerState>(() => ({
  status: 'ready',
  track: null,
  durationMs: 0,
  positionMs: 0,
  volume: 0.85,
  muted: false,
  queue: emptyQueue(),
  error: null,
  notice: null,
  capabilities: NO_CAPS,
  following: false,
  spotify: { connected: false, sdk: 'idle', sdkDetail: '', output: 'active' },
}));

const SESSION_KEY = 'lyricscape.session.v1';
const set = usePlayer.setState;
const get = usePlayer.getState;

class PlayerController {
  private local: LocalBackend | null = null;
  private spotify: SpotifyBackend | null = null;
  private active: PlaybackBackend | null = null;
  private loadSeq = 0;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private tabId = Math.random().toString(36).slice(2);
  private channel: BroadcastChannel | null = null;
  private inited = false;

  // ---- lifecycle ------------------------------------------------------------------------
  init() {
    if (this.inited || typeof window === 'undefined') return;
    this.inited = true;
    bindController(this);
    this.restoreSession();
    this.syncSpotifyConnection();
    window.addEventListener('lyricscape:spotify-auth', () => this.syncSpotifyConnection());
    window.addEventListener('beforeunload', () => this.saveSessionNow());

    if ('BroadcastChannel' in window) {
      this.channel = new BroadcastChannel('lyricscape-player');
      this.channel.onmessage = (e: MessageEvent) => {
        // another tab started *local* playback: don't talk over it
        if (e.data?.type === 'playing' && e.data.tab !== this.tabId && get().status === 'playing' && this.active?.kind === 'local') {
          void this.pause();
          set({ notice: 'Paused: Lyricscape started playing in another tab.' });
        }
      };
    }
    this.setupMediaSession();
  }

  private backendFor(track: Track): PlaybackBackend {
    if (track.provider === 'spotify') {
      if (!this.spotify) {
        this.spotify = new SpotifyBackend();
        this.spotify.attach(this.eventsFor('spotify'));
        this.spotify.onSdkStatus((s, d) => set((st) => ({ spotify: { ...st.spotify, sdk: s, sdkDetail: d ?? '' } })));
      }
      return this.spotify;
    }
    if (!this.local) {
      this.local = new LocalBackend();
      this.local.attach(this.eventsFor('local'));
      this.local.setVolume(get().volume, get().muted);
    }
    return this.local;
  }

  getLocalBackend() {
    return this.local;
  }

  getSpotifyBackend() {
    return this.spotify;
  }

  private eventsFor(kind: 'local' | 'spotify'): BackendEvents {
    return {
      state: (s) => {
        if (this.active?.kind !== kind) return;
        const cur = get();
        let status: PlayerStatus = cur.status;
        if (cur.status !== 'loading' || s.playing || s.positionMs > 0) {
          if (cur.status === 'error' || cur.status === 'unavailable') status = cur.status;
          else status = s.buffering ? 'buffering' : s.playing ? 'playing' : 'paused';
        }
        set({ status, positionMs: s.positionMs, durationMs: s.durationMs || cur.durationMs });
        if (s.playing && kind === 'local') this.channel?.postMessage({ type: 'playing', tab: this.tabId });
        this.scheduleSave();
        this.updateMediaSessionPosition();
      },
      ended: () => void this.onEnded(),
      error: (message, kind) => {
        if (kind === 'autoplay') set({ status: 'paused', notice: message });
        else if (kind === 'rate') set({ notice: message });
        else if (kind === 'unavailable') set({ status: 'unavailable', error: { message, kind } });
        else set({ status: kind === 'device' || kind === 'premium' || kind === 'auth' ? 'paused' : 'error', error: { message, kind } });
      },
      external: (t) => {
        if (!t) return set({ notice: 'Spotify is playing something that is not a song (ad or podcast).' });
        this.followExternal(t);
      },
    };
  }

  // ---- spotify connection -----------------------------------------------------------------
  syncSpotifyConnection() {
    const connected = isConnected();
    set((s) => ({ spotify: { ...s.spotify, connected } }));
    if (connected) {
      this.ensureSpotifyFollowing();
    } else if (this.spotify) {
      if (this.active === this.spotify) this.active = null;
      this.spotify.dispose();
      this.spotify = null;
      set((s) => ({ spotify: { ...s.spotify, output: 'active' } }));
      if (get().track?.provider === 'spotify') set({ following: false, status: 'paused' });
    }
    if (get().track?.provider === 'spotify') set({ capabilities: spotifyCapabilities(connected, null) });
  }

  /** Start following whatever Spotify is playing (works with any device). */
  ensureSpotifyFollowing() {
    if (!isConnected()) return;
    const b = this.backendFor({ provider: 'spotify' } as Track) as SpotifyBackend;
    b.start({ webPlayer: true });
  }

  async playOnBrowser() {
    if (!isConnected()) throw new Error('Connect Spotify in Settings first.');
    const b = this.backendFor({ provider: 'spotify' } as Track) as SpotifyBackend;
    await b.selectBrowser(get().volume, get().muted);
    set((s) => ({ spotify: { ...s.spotify, output: 'browser' }, following: false, error: null }));
  }

  followSpotifyDevice() {
    this.spotify?.followActiveDevice();
    set((s) => ({ spotify: { ...s.spotify, output: 'active' }, following: s.track?.provider === 'spotify' }));
  }

  private followExternal(t: Track) {
    let q = get().queue;
    const existing = q.entries.find((e) => e.track.id === t.id);
    if (existing) q = jumpTo(q, existing.qid);
    else {
      q = enqueue(q, [t], 'next');
      const added = q.entries.find((e) => e.track.id === t.id)!;
      q = jumpTo(q, added.qid);
    }
    this.active = this.spotify;
    // stop local audio if it was playing: Spotify now owns playback
    if (this.local && !this.local.audio.paused) void this.local.pause();
    set({
      queue: q,
      track: t,
      durationMs: t.durationMs,
      positionMs: this.spotify?.positionMs() ?? 0,
      following: get().spotify.output !== 'browser',
      error: null,
      capabilities: spotifyCapabilities(true, null),
    });
    this.updateMediaSession();
    this.scheduleSave();
  }

  // ---- commands ----------------------------------------------------------------------------
  currentTrack() {
    return get().track;
  }
  queueTracks() {
    return get().queue.entries.map((e) => e.track);
  }
  getPositionMs() {
    return this.active?.positionMs() ?? get().positionMs;
  }
  /** Automatic output latency of the active backend (0 when it does not report one). */
  getOutputLatencyMs() {
    return this.active?.outputLatencyMs?.() ?? 0;
  }

  private async loadCurrent(autoplay: boolean, startMs = 0) {
    const entry = currentEntry(get().queue);
    if (!entry) return;
    const track = entry.track;
    const seq = ++this.loadSeq;
    const backend = this.backendFor(track);
    if (this.active && this.active !== backend) await this.active.pause().catch(() => undefined);
    this.active = backend;
    if (backend.kind === 'spotify') this.ensureSpotifyFollowing();
    set({
      track,
      status: 'loading',
      error: null,
      notice: null,
      positionMs: startMs,
      durationMs: track.durationMs,
      following: false,
      capabilities: track.provider === 'spotify' ? spotifyCapabilities(isConnected(), null) : providers[track.provider].capabilities(),
    });
    backend.setVolume(get().volume, get().muted);
    this.updateMediaSession();
    await backend.load(track, { autoplay, startMs });
    if (seq !== this.loadSeq) return;
    if (!autoplay && get().status === 'loading') set({ status: 'paused' });
    this.scheduleSave();
  }

  /** Replace the queue with `tracks` and start `startIndex`. */
  async playQueue(tracks: Track[], startIndex = 0) {
    if (tracks.length === 0) return;
    set({ queue: setQueue(get().queue, tracks, startIndex) });
    await this.loadCurrent(true);
  }

  /** Play one track now. Keeps existing queue if the track is already in it. */
  async playTrack(track: Track, context?: Track[]) {
    if (context?.length) {
      const idx = Math.max(0, context.findIndex((t) => t.id === track.id));
      return this.playQueue(context, idx);
    }
    const q = get().queue;
    const existing = q.entries.find((e) => e.track.id === track.id);
    if (existing) set({ queue: jumpTo(q, existing.qid) });
    else set({ queue: setQueue(q, [track], 0) });
    await this.loadCurrent(true);
  }

  addToQueue(tracks: Track[], where: 'end' | 'next' = 'end') {
    const wasEmpty = get().queue.entries.length === 0;
    set({ queue: enqueue(get().queue, tracks, where), notice: `${tracks.length === 1 ? tracks[0]!.title : tracks.length + ' tracks'} added to queue` });
    if (wasEmpty) void this.loadCurrent(false);
    this.scheduleSave();
  }

  removeFromQueue(qid: string) {
    const { state, removedCurrent } = removeEntry(get().queue, qid);
    set({ queue: state });
    if (removedCurrent) {
      if (state.currentQid) void this.loadCurrent(get().status === 'playing');
      else {
        void this.active?.pause();
        set({ track: null, status: 'ready', positionMs: 0 });
      }
    }
    this.scheduleSave();
  }

  /** Party playback: keep what is playing, replace what follows with the live party queue. */
  setUpcoming(tracks: Track[]) {
    set({ queue: replaceUpcoming(get().queue, tracks) });
    this.scheduleSave();
  }

  moveInQueue(qid: string, toIndex: number) {
    set({ queue: moveEntry(get().queue, qid, toIndex) });
    this.scheduleSave();
  }

  clearQueue() {
    void this.active?.pause();
    this.loadSeq++;
    set({ queue: emptyQueue(), track: null, status: 'ready', positionMs: 0, durationMs: 0, error: null });
    this.scheduleSave();
  }

  async jumpToQid(qid: string) {
    set({ queue: jumpTo(get().queue, qid) });
    await this.loadCurrent(true);
  }

  async play() {
    const s = get();
    if (!s.track) {
      if (s.queue.entries.length) return this.loadCurrent(true);
      return;
    }
    if (s.status === 'error' || s.status === 'unavailable') return this.loadCurrent(true, s.positionMs);
    if (!this.active) return this.loadCurrent(true, s.positionMs);
    set({ error: null, notice: null });
    await this.active.play();
  }

  async pause() {
    await this.active?.pause();
  }

  async toggle() {
    const st = get().status;
    if (st === 'playing' || st === 'buffering' || st === 'loading') await this.pause();
    else await this.play();
  }

  async seek(ms: number) {
    const dur = get().durationMs;
    const target = Math.max(0, dur ? Math.min(ms, dur - 50) : ms);
    set({ positionMs: target });
    await this.active?.seek(target);
  }

  async next(auto = false) {
    const q = get().queue;
    const id = nextQid(q, auto);
    if (!id) {
      // end of queue
      await this.active?.pause();
      set({ status: 'paused', positionMs: 0 });
      await this.active?.seek(0);
      return;
    }
    set({ queue: jumpTo(q, id) });
    await this.loadCurrent(true);
  }

  async previous() {
    // classic behaviour: restart if more than 3s in, else go back
    if (this.getPositionMs() > 3000) return this.seek(0);
    const id = prevQid(get().queue);
    if (!id) return this.seek(0);
    set({ queue: jumpTo(get().queue, id) });
    await this.loadCurrent(true);
  }

  private async onEnded() {
    await this.next(true);
  }

  setVolume(v: number) {
    if (!Number.isFinite(v)) return;
    v = Math.max(0, Math.min(1, v));
    set({ volume: v, muted: v === 0 ? true : false });
    this.active?.setVolume(v, v === 0);
    if (this.local !== this.active) this.local?.setVolume(v, v === 0);
    if (this.spotify !== this.active && get().spotify.output === 'browser') this.spotify?.setVolume(v, v === 0);
    this.scheduleSave();
  }

  toggleMute() {
    const muted = !get().muted;
    set({ muted });
    this.local?.setVolume(get().volume, muted);
    this.spotify?.setVolume(get().volume, muted);
    this.scheduleSave();
  }

  setRepeat(mode: RepeatMode) {
    set({ queue: setRepeat(get().queue, mode) });
    this.scheduleSave();
  }
  cycleRepeat() {
    const order: RepeatMode[] = ['off', 'all', 'one'];
    this.setRepeat(order[(order.indexOf(get().queue.repeat) + 1) % 3]!);
  }
  toggleShuffle() {
    set({ queue: setShuffle(get().queue, !get().queue.shuffle) });
    this.scheduleSave();
  }

  dismissNotice() {
    set({ notice: null });
  }
  dismissError() {
    set({ error: null });
  }

  // ---- persistence (restore session after reload) ---------------------------------------------
  private scheduleSave() {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.saveSessionNow();
    }, 1000);
  }

  private saveSessionNow() {
    try {
      const s = get();
      localStorage.setItem(
        SESSION_KEY,
        JSON.stringify({ queue: s.queue, positionMs: this.getPositionMs(), volume: s.volume, muted: s.muted }),
      );
    } catch {
      /* storage may be blocked */
    }
  }

  private restoreSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as { queue?: QueueState; positionMs?: number; volume?: number; muted?: boolean };
      if (typeof data.volume === 'number') set({ volume: data.volume, muted: !!data.muted });
      if (data.queue?.entries?.length) {
        set({ queue: data.queue });
        const entry = currentEntry(data.queue);
        if (entry) {
          this.active = this.backendFor(entry.track);
          set({
            track: entry.track,
            status: 'paused',
            durationMs: entry.track.durationMs,
            positionMs: data.positionMs ?? 0,
            capabilities:
              entry.track.provider === 'spotify' ? spotifyCapabilities(isConnected(), null) : providers[entry.track.provider].capabilities(),
          });
          // prepare (not play) so pressing play resumes at the saved position
          void this.active.load(entry.track, { autoplay: false, startMs: data.positionMs ?? 0 });
        }
      }
    } catch {
      /* corrupt session: start clean */
    }
  }

  // ---- Media Session ------------------------------------------------------------------------------
  private setupMediaSession() {
    if (!('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ['play', () => void this.play()],
      ['pause', () => void this.pause()],
      ['previoustrack', () => void this.previous()],
      ['nexttrack', () => void this.next()],
      ['seekto', (d) => void this.seek((d.seekTime ?? 0) * 1000)],
      ['seekforward', () => void this.seek(this.getPositionMs() + 10000)],
      ['seekbackward', () => void this.seek(this.getPositionMs() - 10000)],
    ];
    for (const [a, h] of handlers) {
      try {
        ms.setActionHandler(a, h);
      } catch {
        /* unsupported action */
      }
    }
    usePlayer.subscribe((s, prev) => {
      if (s.status !== prev.status) ms.playbackState = s.status === 'playing' ? 'playing' : s.track ? 'paused' : 'none';
    });
  }

  private updateMediaSession() {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    const t = get().track;
    if (!t) {
      navigator.mediaSession.metadata = null;
      return;
    }
    navigator.mediaSession.metadata = new MediaMetadata({
      title: t.title,
      artist: t.artists.join(', '),
      album: t.album ?? '',
      artwork: t.artworkUrl ? [{ src: t.artworkUrl, sizes: '512x512' }] : [],
    });
  }

  private updateMediaSessionPosition() {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    const s = get();
    if (!s.durationMs) return;
    try {
      navigator.mediaSession.setPositionState({
        duration: s.durationMs / 1000,
        position: Math.min(s.durationMs, s.positionMs) / 1000,
        playbackRate: 1,
      });
    } catch {
      /* invalid state while loading */
    }
  }
}

export const player = new PlayerController();
