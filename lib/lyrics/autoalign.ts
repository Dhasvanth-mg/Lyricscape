'use client';

// Client side of the optional local aligner (tools/aligner): send audio you hold + the lyric text, get word times
// back, and turn them into a document that is clearly "auto-aligned, review me". Never used for Spotify (no audio).

import type { LyricDocument, TimedLine, TimedWord, Track } from '../types';
import { getLocalTrack } from '../library/db';

export type AlignerStatus = { available: boolean; reason?: string; separation?: boolean; device?: string; languages?: string[] };

export async function alignerStatus(): Promise<AlignerStatus> {
  try {
    const res = await fetch('/api/lyrics/align', { cache: 'no-store' });
    return (await res.json()) as AlignerStatus;
  } catch {
    return { available: false, reason: 'Could not reach the app server.' };
  }
}

/** Can this track's audio be read by us? (Local files and bundled demo songs: yes. Spotify: never.) */
export const hasReadableAudio = (t: Track): boolean => !!t.audioUrl && t.provider !== 'spotify';

async function audioBlob(track: Track): Promise<Blob> {
  const url = track.audioUrl;
  if (!url) throw new Error('This track has no audio file the app can read (Spotify audio is not accessible).');
  if (url.startsWith('idb:')) {
    const stored = await getLocalTrack(url.slice(4));
    if (!stored) throw new Error('The imported file is no longer in your library.');
    return stored.blob;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not read the audio (${res.status}).`);
  return res.blob();
}

export type AlignResponse = {
  model: { name: string; separated: boolean };
  seconds: number;
  lines: { text: string; start_ms: number | null; end_ms: number | null; confidence: number; words: { text: string; start_ms: number | null; end_ms: number | null; confidence: number; flags: string[] }[] }[];
  summary: { words: number; median_confidence: number; low_confidence_words: number; warnings: string[] };
};

/** Words below this posterior are highlighted for review (calibrated in docs/lyric-sync-report.md). */
export const LOW_CONFIDENCE = 0.35;

/** Pure: aligner JSON -> lyric document. Times are kept as given (never rounded into false precision beyond 1 ms). */
export function documentFromAlignment(resp: AlignResponse): LyricDocument {
  const lines: TimedLine[] = [];
  let last = 0;
  for (const l of resp.lines) {
    const words: TimedWord[] = l.words.map((w) => {
      const startMs = Math.max(last, Math.round(w.start_ms ?? last));
      const endMs = Math.max(startMs, Math.round(w.end_ms ?? startMs));
      last = startMs;
      return { text: w.text, startMs, endMs, confidence: w.confidence };
    });
    if (!words.length) continue;
    // a word never runs into the next one
    for (let i = 0; i < words.length - 1; i++) words[i]!.endMs = Math.min(words[i]!.endMs, words[i + 1]!.startMs);
    lines.push({ startMs: words[0]!.startMs, endMs: Math.max(words.at(-1)!.endMs, words[0]!.startMs), words, wordTiming: 'authored', endSource: 'estimated' });
  }
  return {
    source: 'enhanced-lrc',
    licenseSource: 'auto-aligned (local aligner)',
    lines,
    timing: { source: 'auto-aligned', confidence: resp.summary.median_confidence, notes: [...resp.summary.warnings, `${resp.summary.low_confidence_words} of ${resp.summary.words} words are low confidence`] },
  };
}

export async function alignWithLocalAligner(track: Track, doc: LyricDocument, opts: { separate?: boolean } = {}): Promise<LyricDocument> {
  const form = new FormData();
  form.set('audio', await audioBlob(track), 'audio');
  form.set('lyrics', doc.lines.map((l) => l.words.map((w) => w.text).join(' ')).join('\n'));
  form.set('separate', String(opts.separate ?? true));
  const res = await fetch('/api/lyrics/align', { method: 'POST', body: form });
  const body = (await res.json().catch(() => ({}))) as AlignResponse & { message?: string };
  if (!res.ok) throw new Error(body.message ?? `Alignment failed (${res.status})`);
  return documentFromAlignment(body);
}
