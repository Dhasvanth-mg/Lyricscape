'use client';

// Browser side of the tempo lookup (app/api/tempo/lookup). A failure or a song without a tempo online is just "no answer".

import { INDEX_EVENT } from '../index/client';
import type { Track } from '../types';

export async function lookupTempoOnline(track: Track): Promise<{ bpm: number; source: string } | null> {
  try {
    const q = new URLSearchParams({ title: track.title, artist: track.artists[0] ?? '', duration: String((track.durationMs || 0) / 1000) });
    if (!track.artists[0] || !track.title) return null;
    const res = await fetch(`/api/tempo/lookup?${q}`);
    if (!res.ok) return null;
    const j = (await res.json()) as { found: boolean; bpm?: number; source?: string };
    return j.found && j.bpm ? { bpm: j.bpm, source: j.source ?? 'deezer' } : null;
  } catch {
    return null;
  }
}

/** tell the stage that the index learned something about this song */
export const announceIndex = (trackId: string) => window.dispatchEvent(new CustomEvent(INDEX_EVENT, { detail: { trackId } }));
