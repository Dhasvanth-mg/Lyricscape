// Spotify Web Playback SDK wrapper: registers this browser tab as a Spotify Connect
// device ("Lyricscape"). Requires Premium; failures are surfaced, never faked.

import { getAccessToken } from './auth';

export type SdkTrack = { id: string | null; uri: string; name: string; duration_ms: number; artists: { name: string; uri?: string }[]; album: { name: string; images: { url: string; width?: number }[] } };
export type SdkState = {
  paused: boolean;
  position: number;
  duration: number;
  loading: boolean;
  track_window: { current_track: SdkTrack; previous_tracks: SdkTrack[]; next_tracks: SdkTrack[] };
};

type Listener = (payload: never) => void;
type SdkPlayer = {
  connect(): Promise<boolean>;
  disconnect(): void;
  addListener(event: string, cb: Listener): boolean;
  getCurrentState(): Promise<SdkState | null>;
  setVolume(v: number): Promise<void>;
  activateElement(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  seek(ms: number): Promise<void>;
};

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady?: () => void;
    Spotify?: { Player: new (opts: { name: string; getOAuthToken: (cb: (t: string) => void) => void; volume?: number }) => SdkPlayer };
  }
}

export type SdkStatus = 'idle' | 'loading' | 'ready' | 'error' | 'unsupported';

export type SdkEvents = {
  state?: (s: SdkState | null) => void;
  status?: (s: SdkStatus, detail?: string) => void;
  autoplayFailed?: () => void;
  commandError?: (message: string) => void;
};

let scriptPromise: Promise<void> | null = null;
function loadScript(): Promise<void> {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    if (window.Spotify) return resolve();
    window.onSpotifyWebPlaybackSDKReady = () => resolve();
    const s = document.createElement('script');
    s.src = 'https://sdk.scdn.co/spotify-player.js';
    s.async = true;
    s.onerror = () => {
      scriptPromise = null;
      reject(new Error('Could not load the Spotify Web Playback SDK (offline or blocked).'));
    };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export class SpotifySdk {
  deviceId: string | null = null;
  status: SdkStatus = 'idle';
  detail = '';
  private player: SdkPlayer | null = null;
  private starting: Promise<string | null> | null = null;
  private volume = 0.85;

  constructor(private events: SdkEvents = {}) {}

  private setStatus(s: SdkStatus, detail = '') {
    this.status = s;
    this.detail = detail;
    this.events.status?.(s, detail);
  }

  /** Create + connect the player once. Resolves with the device id, or null when unavailable. */
  start(): Promise<string | null> {
    this.starting ??= this.doStart();
    return this.starting;
  }

  private async doStart(): Promise<string | null> {
    this.setStatus('loading');
    try {
      await loadScript();
    } catch (e) {
      this.setStatus('error', (e as Error).message);
      this.starting = null;
      return null;
    }
    if (!window.Spotify) {
      this.setStatus('unsupported', 'Web Playback SDK unavailable in this browser.');
      return null;
    }
    const player = new window.Spotify.Player({
      name: 'Lyricscape',
      volume: this.volume,
      getOAuthToken: (cb) => {
        getAccessToken()
          .then(cb)
          .catch(() => this.setStatus('error', 'Spotify session expired. Reconnect in Settings.'));
      },
    });
    this.player = player;

    const ready = new Promise<string | null>((resolve) => {
      const timeout = setTimeout(() => {
        this.setStatus('error', 'Spotify device did not become ready (Premium required for in-browser playback).');
        resolve(null);
      }, 12000);
      player.addListener('ready', (({ device_id }: { device_id: string }) => {
        clearTimeout(timeout);
        this.deviceId = device_id;
        this.setStatus('ready');
        resolve(device_id);
      }) as Listener);
      player.addListener('not_ready', (() => {
        this.deviceId = null;
        this.setStatus('error', 'Browser device went offline.');
      }) as Listener);
      player.addListener('initialization_error', (({ message }: { message: string }) => {
        clearTimeout(timeout);
        this.setStatus('unsupported', message);
        resolve(null);
      }) as Listener);
      player.addListener('authentication_error', (({ message }: { message: string }) => {
        clearTimeout(timeout);
        this.setStatus('error', `Spotify authentication failed: ${message}`);
        resolve(null);
      }) as Listener);
      player.addListener('account_error', (({ message }: { message: string }) => {
        clearTimeout(timeout);
        this.setStatus('error', `Premium required for in-browser playback (${message}). You can still follow playback on other devices.`);
        resolve(null);
      }) as Listener);
      player.addListener('playback_error', (({ message }: { message: string }) => {
        this.setStatus('error', `Playback error: ${message}`);
      }) as Listener);
      player.addListener('autoplay_failed', (() => this.events.autoplayFailed?.()) as Listener);
      player.addListener('player_state_changed', ((s: SdkState | null) => this.events.state?.(s)) as Listener);
    });

    const ok = await player.connect();
    if (!ok) {
      this.setStatus('error', 'Could not connect the browser player.');
      return null;
    }
    return ready;
  }

  /** Must be called from a user gesture on browsers that block autoplay. */
  async activate() {
    try {
      await this.player?.activateElement();
    } catch {
      /* ignored: older SDK builds */
    }
  }

  setVolume(v: number) {
    this.volume = Math.min(1, Math.max(0, v));
    void this.player?.setVolume(this.volume).catch(() => this.events.commandError?.('Could not change Spotify volume. Try again.'));
  }

  getState() {
    return this.player?.getCurrentState() ?? Promise.resolve(null);
  }

  dispose() {
    this.player?.disconnect();
    this.player = null;
    this.deviceId = null;
    this.starting = null;
    this.setStatus('idle');
  }
}
