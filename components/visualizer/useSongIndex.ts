'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Track } from '@/lib/types';
import type { IndexEntry } from '@/lib/index/types';
import { INDEX_EVENT, audioOf, entryFor } from '@/lib/index/client';
import { hasTempo, type AudioFeatures } from '@/lib/analysis/types';

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
  return { entry, ready, audio };
}

/**
 * The track with a beat grid from the index when it has none of its own. A grid the track already carries (the demo songs ship one)
 * is ground truth and wins. Only a trusted tempo is used (see hasTempo).
 */
export function withIndexedTempo(track: Track | null, audio: AudioFeatures | null): Track | null {
  if (!track || track.beatTimesMs?.length || !hasTempo(audio)) return track;
  return { ...track, bpm: audio.bpm, beatTimesMs: audio.beatTimesMs };
}
