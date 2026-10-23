'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { LyricDocument, Track } from '@/lib/types';
import { getAutoFind, loadStoredLyrics, lookupAnotherVersion, lookupOnline, type LyricsResult } from '@/lib/lyrics/service';

export type LyricsState = {
  status: 'idle' | 'loading' | 'found' | 'missing' | 'error';
  doc: LyricDocument | null;
  source: string | null;
  message: string | null;
  searching: boolean;
  /** set when the lyrics came from LRCLIB, so another recorded version can be tried */
  versionId: number | null;
};

const INITIAL: LyricsState = { status: 'idle', doc: null, source: null, message: null, searching: false, versionId: null };

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
        ? { status: 'found', doc: r.doc, source: r.source, message: null, searching: false, versionId: r.versionId ?? null }
        : r.status === 'error'
          ? { status: 'error', doc: null, source: null, message: r.message, searching: false, versionId: null }
          : { status: 'missing', doc: null, source: null, message: null, searching: false, versionId: null },
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

  /** Swap to the next-best recorded version (different edit / timing) of the same song. */
  const anotherVersion = useCallback(async () => {
    const t = trackRef.current;
    if (!t) return;
    const my = ++seq.current;
    setState((s) => ({ ...s, searching: true, message: null }));
    const r = await lookupAnotherVersion(t);
    if (my !== seq.current) return;
    if (r.status === 'found') apply(r);
    else setState((s) => ({ ...s, searching: false, message: r.status === 'error' ? r.message : 'No other versions found.' }));
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

  return { ...state, reload: load, findOnline, anotherVersion };
}
