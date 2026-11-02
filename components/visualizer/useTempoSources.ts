'use client';

import { useEffect, useMemo, useRef } from 'react';
import type { LyricDocument, Track } from '@/lib/types';
import type { TempoFeature } from '@/lib/index/types';
import { saveFeature } from '@/lib/index/client';
import { MIN_LYRIC_CONFIDENCE, estimateTempoFromLyrics } from '@/lib/analysis/lyricTempo';
import { announceIndex, lookupTempoOnline } from '@/lib/analysis/tempoClient';
import { hasTempo } from '@/lib/analysis/types';
import { useUi } from '@/lib/ui-store';
import type { useSongIndex } from './useSongIndex';

/** A short fingerprint of the lyric timing, so a different lyric version is worked out again. */
export const lyricsKey = (doc: LyricDocument | null): string | null => {
  if (!doc || doc.lines.length < 4) return null;
  const f = doc.lines[0]!;
  const l = doc.lines[doc.lines.length - 1]!;
  return `${doc.lines.length}:${f.startMs}:${l.startMs}`;
};

const tried = new Set<string>();

/**
 * For a song with no beat grid of its own, no trusted tempo heard in its audio and no tapped beat: look its tempo up online (if allowed),
 * find the phase in the lyric timing, or, with no lookup, estimate both from the lyrics. Saves the result in the song index, where the
 * stage picks it up. Runs once per song and lyric version; says nothing when it cannot tell.
 */
export function useTempoSources(track: Track | null, doc: LyricDocument | null, idx: ReturnType<typeof useSongIndex>) {
  const online = useUi((s) => s.onlineTempo);
  const key = useMemo(() => lyricsKey(doc), [doc]);
  const idxRef = useRef(idx);
  useEffect(() => {
    idxRef.current = idx;
  }, [idx]);
  const docRef = useRef(doc);
  useEffect(() => {
    docRef.current = doc;
  }, [doc]);

  const id = track?.id ?? null;
  const ready = idx.ready;
  useEffect(() => {
    if (!track || !ready || !key || track.beatTimesMs?.length) return;
    const cur = idxRef.current;
    const tempo = cur.entry?.features.tempo ?? null;
    if (cur.entry?.features.tap || hasTempo(cur.audio)) return;
    if (tempo && tempo.lyricsKey === key && (tempo.phaseMs !== null || !online)) return; // already worked out for these lyrics
    const attempt = `${track.id}|${key}|${online ? 1 : 0}`;
    if (tried.has(attempt)) return;
    let dead = false;
    const timer = setTimeout(async () => {
      tried.add(attempt);
      let bpm = tempo && (tempo.source === 'lookup' || tempo.source === 'lookup+lyrics') ? tempo.bpm : null;
      if (bpm === null && online) bpm = (await lookupTempoOnline(track))?.bpm ?? null;
      const d = docRef.current;
      if (dead || !d) return;
      const now = Date.now();
      let feature: TempoFeature | null = null;
      if (bpm) {
        const est = estimateTempoFromLyrics(d, { fixedBpm: bpm });
        feature = est && est.confidence >= MIN_LYRIC_CONFIDENCE ? { source: 'lookup+lyrics', bpm: est.bpm, phaseMs: est.phaseMs, confidence: est.confidence, lyricsKey: key, savedAt: now } : { source: 'lookup', bpm, phaseMs: null, confidence: 0.3, lyricsKey: key, savedAt: now };
      } else {
        const est = estimateTempoFromLyrics(d);
        if (est && est.confidence >= MIN_LYRIC_CONFIDENCE) feature = { source: 'lyrics', bpm: est.bpm, phaseMs: est.phaseMs, confidence: est.confidence, lyricsKey: key, savedAt: now };
      }
      if (feature && !dead) {
        saveFeature(track, 'tempo', feature);
        announceIndex(track.id);
      }
    }, 600);
    return () => {
      dead = true;
      clearTimeout(timer);
    };
    // the track object changes identity often; its id, the lyric version and the switch are what matter
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, ready, key, online]);
}
