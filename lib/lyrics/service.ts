'use client';

// Resolves timed lyrics for ANY track (demo, imported, Spotify):
//   1. lyrics already saved on this machine (IndexedDB)  <- user-supplied / previously found
//   2. bundled lyrics (demo tracks)
//   3. optional online lookup (LRCLIB), only when the user enabled it or clicked "Find lyrics"
// Spotify provides no lyrics API; Lyricscape never scrapes lyrics pages.

import type { LyricDocument, MatchInfo, Track } from '../types';
import { deleteLyrics, getLyrics, kvGet, kvSet, saveLyrics } from '../library/db';
import { fromPlainText, parseLyrics, toEnhancedLrc } from './parse';
import { parseLyricsfile } from './lyricsfile';
import type { StoredLyrics } from '../library/db';

export type LyricsOrigin = NonNullable<StoredLyrics['origin']>;
/** Origins that belong to the user: a lookup must never replace them. A record with no origin predates the field. */
export const originOf = (r: Pick<StoredLyrics, 'origin' | 'versionId'>): LyricsOrigin => r.origin ?? (r.versionId != null ? 'lrclib' : 'user');
export const isUserOwned = (r: Pick<StoredLyrics, 'origin' | 'versionId'>): boolean => {
  const o = originOf(r);
  return o !== 'lrclib' && o !== 'lyricsfile';
};

export type LyricsResult =
  | { status: 'found'; doc: LyricDocument; source: string; versionId?: number; otherVersions?: number; origin?: StoredLyrics['origin'] }
  | { status: 'missing' }
  | { status: 'error'; message: string };

const AUTO_KEY = 'autoFindLyrics';

export async function getAutoFind(): Promise<boolean> {
  return (await kvGet<boolean>(AUTO_KEY)) ?? true;
}
export async function setAutoFind(on: boolean) {
  await kvSet(AUTO_KEY, on);
  window.dispatchEvent(new CustomEvent('lyricscape:settings'));
}

export async function loadStoredLyrics(track: Track): Promise<LyricsResult> {
  const stored = await getLyrics(track.id);
  if (stored) {
    const doc = parseLyrics(stored.lrc, { durationMs: track.durationMs, licenseSource: stored.source });
    if (doc.timing) {
      if (stored.origin === 'edited') doc.timing.source = 'edited';
      else if (stored.origin === 'auto-aligned') doc.timing.source = 'auto-aligned';
      else if (stored.origin === 'lyricsfile') doc.timing.source = 'lyricsfile';
      if (stored.match) doc.timing.match = stored.match;
    }
    return { status: 'found', doc, source: stored.source, versionId: stored.versionId, origin: stored.origin };
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

export async function lookupOnline(track: Track, exclude: number[] = [], tried: number[] = []): Promise<LyricsResult> {
  // Never replace lyrics the user pasted, hand-timed or aligned: a lookup is only for tracks without them, or for swapping
  // one looked-up version for another.
  const existing = await getLyrics(track.id);
  if (existing && isUserOwned(existing)) return loadStoredLyrics(track);
  const params = new URLSearchParams({
    title: track.title,
    artist: track.artists.join(', '),
    duration: String(Math.round(track.durationMs / 1000)),
  });
  if (track.album) params.set('album', track.album);
  if (exclude.length) params.set('exclude', exclude.join(','));
  try {
    const res = await fetch(`/api/lyrics/lookup?${params}`);
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      return { status: 'error', message: body.message ?? `Lookup failed (${res.status})` };
    }
    const data = (await res.json()) as {
      found: boolean;
      id?: number;
      otherVersions?: number;
      synced?: string | null;
      plain?: string | null;
      hasWordSync?: boolean;
      lyricsfile?: string | null;
      match?: MatchInfo;
      source: string;
      instrumental?: boolean;
    };
    if (!data.found || (!data.synced && !data.plain)) return { status: 'missing' };

    // best timing first: real word times (Lyricsfile) > line timestamps (LRC) > plain text (not synced)
    let doc: LyricDocument | null = null;
    let origin: LyricsOrigin = 'lrclib';
    let lrc = data.synced ?? data.plain ?? '';
    if (data.hasWordSync && data.lyricsfile) {
      try {
        const lf = parseLyricsfile(data.lyricsfile, data.source);
        if (lf.lines.some((l) => l.wordTiming === 'authored')) {
          doc = lf;
          origin = 'lyricsfile';
          lrc = toEnhancedLrc(lf); // authored words keep their stamps; line-synced lines are saved as plain line cues
        }
      } catch {
        /* malformed YAML: fall back to the LRC below */
      }
    }
    if (!doc) {
      doc = data.synced
        ? parseLyrics(data.synced, { durationMs: track.durationMs, licenseSource: data.source })
        : fromPlainText(data.plain ?? '', track.durationMs, data.source);
    }
    if (doc.timing && data.match) doc.timing.match = data.match;
    await saveLyrics({
      trackId: track.id,
      lrc,
      source: `${data.source}${data.synced || origin === 'lyricsfile' ? '' : ' (not synced)'}`,
      synced: !!data.synced || origin === 'lyricsfile',
      savedAt: Date.now(),
      versionId: data.id,
      tried: [...new Set([...tried, ...(data.id != null ? [data.id] : [])])],
      origin,
      match: data.match,
    });
    return { status: 'found', doc, source: data.source, versionId: data.id, otherVersions: data.otherVersions, origin };
  } catch {
    return { status: 'error', message: 'Could not reach the lyrics service. You can paste lyrics yourself.' };
  }
}

/**
 * LRCLIB often holds several versions of a song with slightly different timing. If the lyrics drift against your
 * copy, this swaps to the next best one (cycling back to the best match once they are all tried).
 */
export async function lookupAnotherVersion(track: Track): Promise<LyricsResult> {
  const stored = await getLyrics(track.id);
  if (stored && isUserOwned(stored)) return { status: 'error', message: 'These lyrics are yours (pasted, edited or aligned). Remove them first to look up another version.' };
  const tried = stored?.tried ?? (stored?.versionId != null ? [stored.versionId] : []);
  const next = await lookupOnline(track, tried, tried);
  if (next.status === 'found') return next;
  if (next.status === 'missing' && tried.length > 1) return lookupOnline(track, [], []);
  return next.status === 'missing' ? { status: 'error', message: 'No other versions of this song were found.' } : next;
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
    origin: 'user',
  });
  return doc;
}

export async function saveEditedDocument(track: Track, doc: LyricDocument, source = 'user-supplied (edited)') {
  // a reviewed-and-saved aligner result stays marked as auto-aligned: a person looked at it, a person did not time it
  const aligned = doc.timing?.source === 'auto-aligned';
  await saveLyrics({ trackId: track.id, lrc: toEnhancedLrc(doc), source: aligned ? 'auto-aligned (reviewed)' : source, synced: true, savedAt: Date.now(), origin: aligned ? 'auto-aligned' : 'edited' });
}

export async function removeLyrics(track: Track) {
  await deleteLyrics(track.id);
}
