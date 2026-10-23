'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { LyricDocument, Track } from '@/lib/types';
import { getAutoFind, loadStoredLyrics, lookupOnline, type LyricsResult } from '@/lib/lyrics/service';

export type LyricsState = {
  status: 'idle' | 'loading' | 'found' | 'missing' | 'error';
  doc: LyricDocument | null;
  source: string | null;
  message: string | null;
  searching: boolean;
};

const INITIAL: LyricsState = { status: 'idle', doc: null, source: null, message: null, searching: false };

/** Lyrics for the given track from local storage, bundled files, and (opt-in / on demand) LRCLIB. */
export function useLyrics(track: Track | null) {
  const [state, setState] = useState<LyricsState>(INITIAL);
  const seq = useRef(0);
  const trackRef = useRef(track);
  useEffect(() => {
    trackRef.current = track;
  }, [track]);

  const apply = useCallback((r: LyricsResult) => {
    setState(
      r.status === 'found'
        ? { status: 'found', doc: r.doc, source: r.source, message: null, searching: false }
        : r.status === 'error'
          ? { status: 'error', doc: null, source: null, message: r.message, searching: false }
          : { status: 'missing', doc: null, source: null, message: null, searching: false },
    );
  }, []);

  const load = useCallback(async () => {
    const t = trackRef.current;
    const my = ++seq.current;
    if (!t) return setState(INITIAL);
    setState({ ...INITIAL, status: 'loading' });
    const stored = await loadStoredLyrics(t);
    if (my !== seq.current) return;
    if (stored.status === 'found') return apply(stored);
    if (t.provider !== 'demo' && (await getAutoFind())) {
      setState((s) => ({ ...s, searching: true }));
      const online = await lookupOnline(t);
      if (my !== seq.current) return;
      return apply(online);
    }
    apply(stored);
  }, [apply]);

  const findOnline = useCallback(async () => {
    const t = trackRef.current;
    if (!t) return;
    const my = ++seq.current;
    setState((s) => ({ ...s, searching: true, message: null }));
    const r = await lookupOnline(t);
    if (my !== seq.current) return;
    apply(r);
  }, [apply]);

  useEffect(() => {
    void load();
  }, [track?.id, load]);

  useEffect(() => {
    const onChange = (e: Event) => {
      if ((e as CustomEvent).detail === trackRef.current?.id) void load();
    };
    window.addEventListener('lyricscape:lyrics', onChange);
    return () => window.removeEventListener('lyricscape:lyrics', onChange);
  }, [load]);

  return { ...state, reload: load, findOnline };
}
