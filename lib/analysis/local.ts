'use client';

// Analyse a song whose audio this app holds (an imported file or a bundled/licensed track): decode it, run the analyser faster than
// real time, keep only the numbers. This is the cheap, complete path. (Spotify audio is learned by listening: capture.ts.)

import { getLocalTrack } from '../library/db';
import type { Track } from '../types';
import { analysePcm } from './features';
import type { AudioFeatures } from './types';

/** Does this track have audio the app can read directly? (Spotify tracks do not.) */
export const hasReadableAudio = (t: Track): boolean => !!t.audioUrl && t.provider !== 'spotify';

const yieldToUi = () =>
  new Promise<void>((res) => {
    const ch = new MessageChannel();
    ch.port1.onmessage = () => {
      ch.port1.close();
      res();
    };
    ch.port2.postMessage(0);
  });

async function bytesOf(track: Track): Promise<ArrayBuffer | null> {
  const url = track.audioUrl;
  if (!url) return null;
  if (url.startsWith('idb:')) {
    const stored = await getLocalTrack(url.slice(4));
    return stored ? await stored.blob.arrayBuffer() : null;
  }
  const res = await fetch(url);
  return res.ok ? await res.arrayBuffer() : null;
}

export async function analyseTrackFile(track: Track, opts: { onProgress?: (p: number) => void; signal?: AbortSignal } = {}): Promise<AudioFeatures | null> {
  const bytes = await bytesOf(track);
  if (!bytes || opts.signal?.aborted) return null;
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  try {
    const buf = await ctx.decodeAudioData(bytes);
    if (opts.signal?.aborted) return null;
    const n = buf.length;
    const mono = new Float32Array(n);
    const chans = buf.numberOfChannels;
    for (let c = 0; c < chans; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < n; i++) mono[i]! += d[i]! / chans;
    }
    return await analysePcm(mono, buf.sampleRate, {
      durationMs: Math.round(buf.duration * 1000),
      source: 'file',
      onProgress: opts.onProgress,
      yieldFn: async () => {
        await yieldToUi();
        if (opts.signal?.aborted) throw new DOMException('cancelled', 'AbortError');
      },
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return null;
    return null; // an undecodable file just stays unindexed
  } finally {
    void ctx.close().catch(() => undefined);
  }
}
