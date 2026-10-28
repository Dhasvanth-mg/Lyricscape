import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SdkEvents, SdkState } from '@/lib/spotify/sdk';
import { SpotifyBackend } from '@/lib/player/backends/spotify';

const mocks = vi.hoisted(() => ({
  devices: vi.fn(), transfer: vi.fn(), play: vi.fn(), pause: vi.fn(), resume: vi.fn(), seek: vi.fn(),
  state: vi.fn(), localState: vi.fn(), volume: vi.fn(), remoteVolume: vi.fn(), activate: vi.fn(),
  sdkEvents: null as SdkEvents | null,
}));

vi.mock('@/lib/spotify/api', async (original) => ({
  ...await original<typeof import('@/lib/spotify/api')>(),
  getDevices: mocks.devices, transferPlayback: mocks.transfer, playTrackUri: mocks.play,
  pausePlayback: mocks.pause, resumePlayback: mocks.resume, seekPlayback: mocks.seek,
  getPlaybackState: mocks.state, setPlaybackVolume: mocks.remoteVolume, rateLimitedUntil: () => 0,
}));
vi.mock('@/lib/spotify/sdk', () => ({
  SpotifySdk: class {
    deviceId: string | null = 'browser';
    constructor(events: SdkEvents) { mocks.sdkEvents = events; }
    start = async () => this.deviceId;
    activate = mocks.activate;
    setVolume = mocks.volume;
    getState = mocks.localState;
    dispose() {}
  },
}));

const track = { id: 'spotify:song', provider: 'spotify' as const, providerTrackId: 'song', title: 'Test', artists: ['Artist'], durationMs: 200_000 };
const local = (position = 40_000, paused = false): SdkState => ({
  position, paused, duration: 200_000, loading: false,
  track_window: { current_track: { id: 'song', uri: 'spotify:track:song', name: 'Test', duration_ms: 200_000, artists: [{ name: 'Artist' }], album: { name: 'Album', images: [] } }, previous_tracks: [], next_tracks: [] },
});

describe('Spotify browser output and its lyric clock', () => {
  let b: SpotifyBackend;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetAllMocks();
    mocks.devices.mockResolvedValue([{ id: 'phone', is_active: true, name: 'Phone', type: 'Smartphone' }]);
    mocks.transfer.mockResolvedValue(undefined);
    mocks.play.mockResolvedValue(undefined);
    mocks.pause.mockResolvedValue(undefined);
    mocks.resume.mockResolvedValue(undefined);
    mocks.seek.mockResolvedValue(undefined);
    mocks.remoteVolume.mockResolvedValue(undefined);
    mocks.activate.mockResolvedValue(undefined);
    mocks.localState.mockResolvedValue(local());
    b = new SpotifyBackend();
    b.attach({ state: vi.fn(), error: vi.fn(), ended: vi.fn(), external: vi.fn() });
  });
  afterEach(() => { b.dispose(); vi.useRealTimers(); });

  it('explicitly transfers to the browser and keeps new tracks there even when a phone is active', async () => {
    await b.selectBrowser();
    expect(mocks.activate).toHaveBeenCalledOnce();
    expect(mocks.transfer).toHaveBeenCalledWith('browser', false);
    await b.load(track, { autoplay: true });
    expect(mocks.play).toHaveBeenCalledWith('song', 'browser', 0);
    expect(mocks.devices).not.toHaveBeenCalled();
    await b.pause();
    await b.play();
    await b.seek(50_000);
    expect(mocks.pause).toHaveBeenCalledWith('browser');
    expect(mocks.resume).toHaveBeenCalledWith('browser');
    expect(mocks.seek).toHaveBeenCalledWith(50_000, 'browser');
  });

  it('keeps following the active device when browser transfer fails', async () => {
    mocks.transfer.mockRejectedValueOnce(new Error('Transfer refused'));
    await expect(b.selectBrowser()).rejects.toThrow('Transfer refused');
    await b.load(track, { autoplay: true });
    expect(mocks.play).toHaveBeenCalledWith('song', 'phone', 0);
  });

  it('refuses browser playback when the SDK has no device', async () => {
    b.sdk.deviceId = null;
    await expect(b.selectBrowser()).rejects.toThrow(/Browser player unavailable/);
    expect(mocks.transfer).not.toHaveBeenCalled();
  });

  it('can return to following the active Spotify device', async () => {
    await b.selectBrowser();
    b.followActiveDevice();
    await b.load(track, { autoplay: true });
    expect(mocks.play).toHaveBeenCalledWith('song', 'phone', 0);
  });

  it('restores volume on the browser and sends mute only to the selected output', async () => {
    b.setVolume(0.35, false);
    await b.selectBrowser();
    expect(mocks.volume).toHaveBeenLastCalledWith(0.35);
    b.setVolume(0.35, true);
    expect(mocks.volume).toHaveBeenLastCalledWith(0);
    expect(mocks.remoteVolume).not.toHaveBeenCalled();
    b.followActiveDevice();
    await b.load(track, { autoplay: true });
    mocks.volume.mockClear();
    b.setVolume(0.6, false);
    expect(mocks.remoteVolume).toHaveBeenLastCalledWith(60, 'phone');
    expect(mocks.volume).not.toHaveBeenCalled();
  });

  it('does not change the previous device volume when selecting browser output', async () => {
    await b.load(track, { autoplay: true });
    mocks.remoteVolume.mockClear();
    await b.selectBrowser(0.4, false);
    expect(mocks.remoteVolume).not.toHaveBeenCalled();
    expect(mocks.volume).toHaveBeenLastCalledWith(0.4);
  });

  it('uses local SDK position without adding server timestamp age, even with a skewed PC clock', async () => {
    await b.selectBrowser();
    await b.load(track, { autoplay: true });
    vi.setSystemTime(Date.now() + 60_000);
    await vi.advanceTimersByTimeAsync(900);
    expect(b.positionMs()).toBe(40_000);
    expect(mocks.state).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(100);
    expect(b.positionMs()).toBe(40_100);
  });

  it('does not replace a browser seek with an old SDK request', async () => {
    await b.selectBrowser();
    await b.load(track, { autoplay: true });
    let release!: (s: SdkState) => void;
    mocks.localState.mockImplementationOnce(() => new Promise<SdkState>((resolve) => { release = resolve; }));
    await vi.advanceTimersByTimeAsync(900);
    await b.seek(100_000);
    release(local(5000));
    await Promise.resolve();
    await Promise.resolve();
    expect(b.positionMs()).toBe(100_000);
  });

  it('does not let an empty remote poll undo a newer play command', async () => {
    await b.load(track, { autoplay: true });
    let release!: (s: null) => void;
    mocks.state.mockImplementationOnce(() => new Promise<null>((resolve) => { release = resolve; }));
    await vi.advanceTimersByTimeAsync(900);
    await b.play();
    release(null);
    await Promise.resolve();
    await Promise.resolve();
    expect(b.clock.isPlaying()).toBe(true);
  });

  it('freezes the lyric clock when this browser no longer has playback', async () => {
    await b.selectBrowser();
    await b.load(track, { autoplay: true });
    mocks.localState.mockResolvedValue(null);
    await vi.advanceTimersByTimeAsync(900);
    expect(b.clock.isPlaying()).toBe(false);
    const held = b.positionMs();
    await vi.advanceTimersByTimeAsync(3000);
    expect(b.positionMs()).toBe(held);
    expect(mocks.state).not.toHaveBeenCalled();
  });

  it('resumes the confirmed live track after session restore instead of restarting its saved position', async () => {
    await b.selectBrowser();
    await b.load(track, { autoplay: false, startMs: 1000 });
    await vi.advanceTimersByTimeAsync(100);
    await b.pause();
    await b.play();
    expect(mocks.resume).toHaveBeenCalledWith('browser');
    expect(mocks.play).not.toHaveBeenCalled();
  });

  it('automatically uses SDK time when the active device is this browser, without applying API age first', async () => {
    const states = vi.fn();
    b.attach({ state: states, error: vi.fn(), ended: vi.fn(), external: vi.fn() });
    mocks.state.mockResolvedValue({ device: { id: 'browser' }, item: local().track_window.current_track, progress_ms: 40_000, is_playing: true, timestamp: Date.now() - 2000 });
    b.start({ webPlayer: false });
    await vi.advanceTimersByTimeAsync(50);
    expect(b.positionMs()).toBe(40_000);
    expect(states).toHaveBeenLastCalledWith(expect.objectContaining({ positionSource: 'sdk' }));
    await vi.advanceTimersByTimeAsync(1000);
    expect(mocks.state).toHaveBeenCalledOnce();
    expect(b.positionMs()).toBe(40_000);
  });

  it('returns to remote reports when automatically detected browser playback moves to a phone', async () => {
    const states = vi.fn();
    b.attach({ state: states, error: vi.fn(), ended: vi.fn(), external: vi.fn() });
    mocks.state.mockResolvedValueOnce({ device: { id: 'browser' }, item: local().track_window.current_track, progress_ms: 40_000, is_playing: true, timestamp: Date.now() });
    b.start({ webPlayer: false });
    await vi.advanceTimersByTimeAsync(50);
    mocks.localState.mockResolvedValue(null);
    await vi.advanceTimersByTimeAsync(1000);
    mocks.state.mockResolvedValueOnce({ device: { id: 'phone' }, item: local().track_window.current_track, progress_ms: 60_000, is_playing: true, timestamp: Date.now() + 1000 });
    await vi.advanceTimersByTimeAsync(1000);
    expect(b.positionMs()).toBe(60_000);
    expect(states).toHaveBeenLastCalledWith(expect.objectContaining({ positionSource: 'api' }));
  });
});
