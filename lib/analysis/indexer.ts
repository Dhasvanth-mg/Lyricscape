'use client';

// The song indexer: watches what is playing and makes sure each song's derived data is learned once and remembered.
//   - a song the app holds the audio of (imported file, bundled song): analysed in the background, faster than real time
//   - a Spotify song: learned by listening while it plays, if the person has switched listening on (capture.ts); each play adds to what
//     is known (a skipped stretch is filled in next time), and once a tempo is trusted it is stored and used for the beat grid
//   - a song that already has a trusted tempo, or its own beat grid: left alone (this is the processing the index saves)
// Everything learned goes to the song index (lib/index/client.ts). The audio itself is never stored, sent anywhere or exported.

import { create } from 'zustand';
import { player, usePlayer } from '../player/controller';
import { INDEX_EVENT, audioOf, countPlay, entryFor, flushAll, saveFeature } from '../index/client';
import { useUi } from '../ui-store';
import type { Track } from '../types';
import { AudioCapture, CAPTURE_LATENCY_MS, ChunkClock, type CaptureMode } from './capture';
import { FeatureTrack } from './features';
import { analyseTrackFile, hasReadableAudio } from './local';
import { coverage, hasTempo, type AudioFeatures } from './types';

export type IndexerPhase = 'off' | 'idle' | 'analysing' | 'listening' | 'done' | 'error';
export type IndexerState = {
  phase: IndexerPhase;
  trackId: string | null;
  /** plain words for the Settings card and the mini status */
  message: string;
  /** 0..1 */
  progress: number;
  bpm: number | null;
  capture: 'off' | 'asking' | 'on' | 'error';
  captureMode: CaptureMode;
  captureSupported: boolean;
};

export const useIndexer = create<IndexerState>(() => ({ phase: 'off', trackId: null, message: 'Not started', progress: 0, bpm: null, capture: 'off', captureMode: 'tab', captureSupported: false }));
const set = (p: Partial<IndexerState>) => useIndexer.setState(p);

const capture = typeof window !== 'undefined' ? new AudioCapture() : null;
const clock = new ChunkClock();

type Session = { track: Track; ft: FeatureTrack; heardAtSave: number; lastEmitBeats: number; startedAt: number; silentSince: number | null; peak: number };
let session: Session | null = null;
let fileJob: AbortController | null = null;
let started = false;
let currentId: string | null = null;

const announce = (track: Track) => window.dispatchEvent(new CustomEvent(INDEX_EVENT, { detail: { trackId: track.id } }));

function save(track: Track, f: AudioFeatures) {
  saveFeature(track, 'audio', f);
  announce(track);
}

async function onTrack(track: Track | null) {
  endSession();
  fileJob?.abort();
  fileJob = null;
  currentId = track?.id ?? null;
  if (!track) return set({ phase: 'idle', trackId: null, message: 'Nothing playing', progress: 0, bpm: null });
  set({ trackId: track.id, progress: 0 });
  const entry = await entryFor(track);
  if (currentId !== track.id) return;
  countPlay(track);

  if (track.beatTimesMs?.length) return set({ phase: 'done', message: 'This song brings its own beat grid.', bpm: track.bpm ?? null });
  const have = audioOf(entry);
  if (hasTempo(have) && (coverage(have) >= 0.9 || have.source === 'file')) return set({ phase: 'done', message: `Already indexed: ${Math.round(have.bpm)} BPM.`, bpm: have.bpm, progress: 1 });

  if (hasReadableAudio(track)) {
    if (!useUi.getState().indexLocal) return set({ phase: 'idle', message: 'Indexing of local songs is off.', bpm: null });
    fileJob = new AbortController();
    set({ phase: 'analysing', message: 'Learning this song’s tempo…' });
    const f = await analyseTrackFile(track, { signal: fileJob.signal, onProgress: (p) => currentId === track.id && set({ progress: p }) });
    if (currentId !== track.id) return;
    if (!f) return set({ phase: 'error', message: 'Could not read this song’s audio.' });
    save(track, f);
    return set({ phase: 'done', progress: 1, bpm: f.bpm, message: hasTempo(f) ? `Learned: ${Math.round(f.bpm!)} BPM.` : 'No steady beat found in this song.' });
  }

  // heard-while-playing songs (Spotify)
  if (capture?.status === 'on') beginSession(track, have);
  else set({ phase: 'idle', bpm: have?.bpm ?? null, message: have ? `Partly learned (${Math.round(coverage(have) * 100)}%). Turn on listening in Settings to finish it.` : 'Turn on listening in Settings to learn this song’s tempo.' });
}

function beginSession(track: Track, have: AudioFeatures | null) {
  let ft = new FeatureTrack(track.durationMs || have?.durationMs || 180_000);
  if (have && Math.abs(have.durationMs - ft.durationMs) <= 3000) {
    // add to what an earlier play already heard
    const prev = FeatureTrack.fromFeatures(have);
    ft = new FeatureTrack(have.durationMs);
    ft.merge(prev);
  }
  clock.reset();
  session = { track, ft, heardAtSave: ft.heardMs(), lastEmitBeats: have?.beatTimesMs.length ?? 0, startedAt: performance.now(), silentSince: null, peak: 0 };
  set({ phase: 'listening', message: 'Listening…', progress: coverage({ covered: ft.coveredRuns(), durationMs: ft.durationMs }), bpm: have?.bpm ?? null });
}

function endSession() {
  const s = session;
  session = null;
  if (!s) return;
  if (s.ft.heardMs() > s.heardAtSave + 2000) {
    const f = s.ft.toFeatures('capture');
    save(s.track, f);
  }
  void flushAll();
}

function onBlock(samples: Float32Array, sampleRate: number) {
  const s = session;
  if (!s) return;
  const st = usePlayer.getState();
  if (st.status !== 'playing' || st.track?.id !== s.track.id) return;
  const start = clock.place(samples.length, sampleRate, player.getPositionMs());
  if (start === null) return;
  const before = s.ft.heardMs();
  let pk = 0;
  for (let i = 0; i < samples.length; i += 16) pk = Math.max(pk, Math.abs(samples[i]!));
  s.peak = Math.max(pk, s.peak * 0.995); // the recent loudest sample: tells a quiet capture from a clear one
  s.ft.pushPcm(samples, sampleRate, start - CAPTURE_LATENCY_MS);
  const heard = s.ft.heardMs();
  // nothing but silence for a while: this tab is not the one playing the song
  const now = performance.now();
  if (heard <= before + 1) {
    s.silentSince ??= now;
    if (now - s.silentSince > 8000) set({ message: capture?.mode === 'system' ? 'No sound heard from this computer. Is the song playing on this computer, with its volume up?' : 'No sound heard from this tab. Is the song playing in Lyricscape’s own player (not another device)? Listening to the whole computer’s sound can hear other apps too.' });
  } else s.silentSince = null;
  if (heard - s.heardAtSave >= 12_000) {
    const f = s.ft.toFeatures('capture');
    s.heardAtSave = heard;
    // a first trusted tempo, or a grid that changed, is worth telling the stage about; the rest is just stored
    const grew = f.beatTimesMs.length - s.lastEmitBeats;
    save(s.track, f);
    if (hasTempo(f) && grew > 0) s.lastEmitBeats = f.beatTimesMs.length;
    set({ progress: coverage(f), bpm: f.bpm, message: hasTempo(f) ? `Learning: ${Math.round(f.bpm!)} BPM so far (${Math.round(coverage(f) * 100)}% heard).` : heard >= 30_000 ? `Heard ${Math.round(heard / 1000)} s but no steady beat yet (confidence ${f.bpmConfidence.toFixed(2)}). Sound level ${s.peak < 0.03 ? 'very low' : s.peak < 0.1 ? 'low' : 'fine'}${s.peak < 0.1 ? ': raise the volume of this tab or of Spotify' : ''}. Keep it playing.` : 'Listening…' });
  }
}

/** Begin watching playback. Safe to call more than once. */
export function startIndexer(): () => void {
  if (started || typeof window === 'undefined') return () => undefined;
  started = true;
  set({ phase: 'idle', message: 'Waiting for a song', captureSupported: AudioCapture.supported() });
  let lastId: string | null = null;
  const unsub = usePlayer.subscribe((st) => {
    const id = st.track?.id ?? null;
    if (id !== lastId) {
      lastId = id;
      void onTrack(st.track);
    }
  });
  if (capture) {
    capture.onBlock = onBlock;
    capture.onEnd = () => {
      endSession();
      set({ capture: 'off', message: 'Listening stopped.', phase: 'idle' });
    };
  }
  // development only: lets a browser test drive the indexer and read what it did
  if (process.env.NODE_ENV !== 'production') (window as unknown as { __lsIndex?: unknown }).__lsIndex = { player, usePlayer, useIndexer, analyseTrackFile, AudioCapture, ChunkClock, FeatureTrack };
  const onHide = () => void flushAll();
  window.addEventListener('pagehide', onHide);
  return () => {
    started = false;
    unsub();
    window.removeEventListener('pagehide', onHide);
    endSession();
  };
}

/** Switch listening on (call from a click). The browser asks the person to share this tab with its audio. */
export async function enableListening(mode: CaptureMode = 'tab'): Promise<void> {
  if (!capture) return;
  set({ capture: 'asking', captureMode: mode, message: mode === 'tab' ? 'Choose this tab and tick “Share tab audio”…' : 'Choose “Entire screen” and tick “Also share system audio”…' });
  try {
    await capture.start(mode);
    set({ capture: 'on', message: mode === 'tab' ? 'Listening to this tab.' : 'Listening to this computer’s sound: play only the song.' });
    const st = usePlayer.getState();
    if (st.track && st.track.provider === 'spotify' && !hasReadableAudio(st.track)) {
      const e = await entryFor(st.track);
      beginSession(st.track, audioOf(e));
    }
  } catch (e) {
    set({ capture: 'error', message: e instanceof Error ? e.message : 'Could not start listening.' });
  }
}

export function disableListening(): void {
  capture?.stop();
  set({ capture: 'off', message: 'Listening is off.' });
}
