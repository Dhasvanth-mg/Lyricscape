'use client';

// Resolves timed lyrics for ANY track (demo, imported, Spotify):
//   1. lyrics already saved on this machine (IndexedDB)  <- user-supplied / previously found
//   2. bundled lyrics (demo tracks)
//   3. optional online lookup (LRCLIB), only when the user enabled it or clicked "Find lyrics"
// Spotify provides no lyrics API; Lyricscape never scrapes lyrics pages.

import type { LyricDocument, Track } from '../types';
import { deleteLyrics, getLyrics, kvGet, kvSet, saveLyrics } from '../library/db';
import { fromPlainText, parseLyrics, toEnhancedLrc } from './parse';

export type LyricsResult =
  | { status: 'found'; doc: LyricDocument; source: string }
  | { status: 'missing' }
  | { status: 'error'; message: string };

const AUTO_KEY = 'autoFindLyrics';

export async function getAutoFind(): Promise<boolean> {
  return (await kvGet<boolean>(AUTO_KEY)) ?? false;
}
export async function setAutoFind(on: boolean) {
  await kvSet(AUTO_KEY, on);
  window.dispatchEvent(new CustomEvent('lyricscape:settings'));
}

export async function loadStoredLyrics(track: Track): Promise<LyricsResult> {
  const stored = await getLyrics(track.id);
  if (stored) {
    const doc = parseLyrics(stored.lrc, { durationMs: track.durationMs, licenseSource: stored.source });
    return { status: 'found', doc, source: stored.source };
  }
  if (track.lyricsUrl) {
    try {
      const res = await fetch(track.lyricsUrl);
      if (res.ok) {
        const doc = parseLyrics(await res.text(), { durationMs: track.durationMs, licenseSource: track.license ?? 'bundled' });
        return { status: 'found', doc, source: track.license ?? 'bundled' };
      }
    } catch {
      /* fall through */
    }
  }
  return { status: 'missing' };
}

export async function lookupOnline(track: Track): Promise<LyricsResult> {
  const params = new URLSearchParams({
    title: track.title,
    artist: track.artists[0] ?? '',
    duration: String(Math.round(track.durationMs / 1000)),
  });
  if (track.album) params.set('album', track.album);
  try {
    const res = await fetch(`/api/lyrics/lookup?${params}`);
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      return { status: 'error', message: body.message ?? `Lookup failed (${res.status})` };
    }
    const data = (await res.json()) as { found: boolean; synced?: string | null; plain?: string | null; source: string; instrumental?: boolean };
    if (!data.found || (!data.synced && !data.plain)) return { status: 'missing' };
    const doc = data.synced
      ? parseLyrics(data.synced, { durationMs: track.durationMs, licenseSource: data.source })
      : fromPlainText(data.plain ?? '', track.durationMs, data.source);
    await saveLyrics({
      trackId: track.id,
      lrc: data.synced ?? (data.plain ?? ''),
      source: `${data.source}${data.synced ? '' : ' (unsynced, auto-timed)'}`,
      synced: !!data.synced,
      savedAt: Date.now(),
    });
    return { status: 'found', doc, source: data.source };
  } catch {
    return { status: 'error', message: 'Could not reach the lyrics service. You can paste lyrics yourself.' };
  }
}

/** Full resolution used by the visualizer. */
export async function resolveLyrics(track: Track, opts: { allowOnline: boolean }): Promise<LyricsResult> {
  const stored = await loadStoredLyrics(track);
  if (stored.status === 'found') return stored;
  if (opts.allowOnline && track.provider !== 'demo') return lookupOnline(track);
  return stored;
}

/** Persist lyrics the user pasted/imported/edited. Input may be LRC, enhanced LRC, VTT, JSON or plain text. */
export async function saveUserLyrics(track: Track, text: string, source = 'user-supplied'): Promise<LyricDocument> {
  const doc = parseLyrics(text, { durationMs: track.durationMs, licenseSource: source });
  if (!doc.lines.length) throw new Error('No lyric lines found in that text.');
  await saveLyrics({
    trackId: track.id,
    lrc: doc.source === 'plain' ? text : toEnhancedLrc(doc),
    source,
    synced: doc.source !== 'plain',
    savedAt: Date.now(),
  });
  return doc;
}

export async function saveEditedDocument(track: Track, doc: LyricDocument, source = 'user-supplied (edited)') {
  await saveLyrics({ trackId: track.id, lrc: toEnhancedLrc(doc), source, synced: true, savedAt: Date.now() });
}

export async function removeLyrics(track: Track) {
  await deleteLyrics(track.id);
}
