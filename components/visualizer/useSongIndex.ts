'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Track } from '@/lib/types';
import type { IndexEntry } from '@/lib/index/types';
import { INDEX_EVENT, audioOf, entryFor } from '@/lib/index/client';
import { resolveBeatGrid, type BeatGrid } from '@/lib/analysis/tempoSources';

/** What the song index remembers about the track, kept current while the indexer learns more (see lib/analysis/indexer.ts). */
export function useSongIndex(track: Track | null) {
  const [entry, setEntry] = useState<IndexEntry | null>(null);
  const [ready, setReady] = useState(false);
  const id = track?.id ?? null;

  useEffect(() => {
    let dead = false;
    setEntry(null);
    setReady(false);
    if (!track) return;
    void entryFor(track).then((e) => {
      if (dead) return;
      setEntry(e);
      setReady(true);
    });
    const onChange = (ev: Event) => {
      if ((ev as CustomEvent).detail?.trackId !== id) return;
      void entryFor(track).then((e) => !dead && setEntry(e));
    };
    window.addEventListener(INDEX_EVENT, onChange);
    return () => {
      dead = true;
      window.removeEventListener(INDEX_EVENT, onChange);
    };
    // the track object changes identity on every state tick in some views; its id is what matters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const audio = useMemo(() => audioOf(entry), [entry]);
  const tempo = entry?.features.tempo ?? null;
  const tap = entry?.features.tap ?? null;
  // the best beat grid we know for this song (tapped > heard > looked up and aligned by the lyrics > estimated from the lyrics)
  const grid = useMemo(() => (track ? resolveBeatGrid({ durationMs: track.durationMs || audio?.durationMs || 180_000, audio, tempo, tap }) : null), [track, audio, tempo, tap]);
  return { entry, ready, audio, tempo, tap, grid };
}

/**
 * The track with a beat grid from the index when it has none of its own. A grid the track already carries (the demo songs ship one)
 * is ground truth and wins.
 */
export function withIndexedTempo(track: Track | null, grid: BeatGrid | null): Track | null {
  if (!track || track.beatTimesMs?.length || !grid) return track;
  return { ...track, bpm: grid.bpm, beatTimesMs: grid.beatTimesMs };
}
