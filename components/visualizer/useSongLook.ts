'use client';

// Everything about how ONE song looks: its identity (from evidence), the art direction chosen for it, the listener's own
// adjustments and corrections, and the saved themes. Heavy work (tags, AI) happens off the render path and is cached; the
// result is a single resolved Look the renderer reads. Nothing here touches playback or lyric timing.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LyricDocument, Track } from '@/lib/types';
import { kvGet, kvSet } from '@/lib/library/db';
import { buildIdentity, describeIdentity } from '@/lib/identity/build';
import { interpretSong, tagsForTrack } from '@/lib/identity/client';
import { applyCorrection, type CorrectionId, type Corrections } from '@/lib/identity/corrections';
import type { AiProfile } from '@/lib/identity/ai';
import type { GenreTag } from '@/lib/identity/types';
import { resolveLook, mergeTweaks } from '@/lib/theme/resolve';
import { useStudio } from '@/lib/theme/store';
import type { CoverInfo, Pick, SongLook, Tweaks } from '@/lib/theme/types';
import { STYLE_IDS, type StyleId } from '@/lib/kinetic/types';
import { useUi } from '@/lib/ui-store';

export type AiState = 'off' | 'loading' | 'used' | 'unavailable';

export function useSongLook(a: { track: Track | null; doc: LyricDocument | null; cover: CoverInfo | null; fallbackStyle: StyleId }) {
  const { track, doc, cover, fallbackStyle } = a;
  // The player may hand over a new object for the same song; what is loaded and stored belongs to the song's id, not the object.
  const trackId = track?.id ?? null;
  const trackRef = useRef(track);
  useEffect(() => {
    trackRef.current = track;
  });
  const ui = useUi();
  const saved = useStudio((s) => s.saved);
  const familyDefaults = useStudio((s) => s.familyDefaults);
  const hydrated = useStudio((s) => s.hydrated);
  const hydrate = useStudio((s) => s.hydrate);
  const saveTheme = useStudio((s) => s.saveTheme);
  const [tags, setTags] = useState<GenreTag[]>([]);
  const [tagsReady, setTagsReady] = useState(false);
  const [corrections, setCorrections] = useState<Corrections | null>(null);
  const [song, setSong] = useState<SongLook | null>(null);
  const [ai, setAi] = useState<AiProfile | null>(null);
  const [aiTried, setAiTried] = useState(false);
  // what has finished loading for THIS song: its stored look, and (up to a short grace period) its genre tags. Until then the
  // stage does not draw, so a song never flashes the wrong look and then jumps to its own.
  const [storedFor, setStoredFor] = useState<string | null>(null);
  const [grace, setGrace] = useState(false);

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  // this song's stored look / corrections, and its genre tags
  useEffect(() => {
    let cancelled = false;
    setTags([]);
    setTagsReady(false);
    setCorrections(null);
    setSong(null);
    setAi(null);
    setAiTried(false);
    setStoredFor(null);
    setGrace(false);
    const grace = window.setTimeout(() => setGrace(true), 700);
    const track = trackRef.current;
    if (!track) return;
    void (async () => {
      const [look, legacy, corr] = await Promise.all([kvGet<SongLook | null>(`look:${track.id}`), kvGet<string | null>(`theme:${track.id}`), kvGet<Corrections | null>(`corr:${track.id}`)]);
      if (cancelled) return;
      let s: SongLook | null = look && look.pick ? look : null;
      // a look pinned before art directions existed was a single style id
      if (!s && legacy && (STYLE_IDS as readonly string[]).includes(legacy)) s = { pick: { kind: 'direction', id: legacy as StyleId }, tweaks: {} };
      setSong(s);
      setCorrections(corr ?? null);
      setStoredFor(track.id);
    })();
    void tagsForTrack(track, { online: ui.onlineGenres }).then((t) => {
      if (cancelled) return;
      setTags(t);
      setTagsReady(true);
    });
    return () => {
      cancelled = true;
      window.clearTimeout(grace);
    };
  }, [trackId, ui.onlineGenres]);

  // the optional AI reading: only when allowed, only once tags are in, one cached call per song and lyric text
  useEffect(() => {
    let cancelled = false;
    setAi(null);
    setAiTried(false);
    const track = trackRef.current;
    if (!ui.aiInterpret || !track || !doc || !tagsReady) return;
    void interpretSong(track, doc, tags).then((p) => {
      if (cancelled) return;
      setAi(p);
      setAiTried(true);
    });
    return () => {
      cancelled = true;
    };
  }, [ui.aiInterpret, trackId, doc, tags, tagsReady]);

  const identity = useMemo(
    () => (track ? buildIdentity({ trackId: track.id, title: track.title, album: track.album, releaseYear: track.releaseYear, tags, lyrics: doc, bpm: track.bpm, cover: cover ? { light: cover.light, vibrance: cover.vibrance, warmth: cover.warmth } : null, ai, corrections }) : null),
    [track, tags, doc, cover, ai, corrections],
  );
  const described = useMemo(() => (identity ? describeIdentity(identity) : null), [identity]);

  const resolved = useMemo(
    () => resolveLook({ identity, cover, song, saved, familyDefaults, autoTheme: ui.autoTheme, fallback: fallbackStyle }),
    [identity, cover, song, saved, familyDefaults, ui.autoTheme, fallbackStyle],
  );

  const persist = useCallback(
    (next: SongLook | null) => {
      setSong(next);
      if (!track) return;
      const empty = !next || (next.pick.kind === 'auto' && Object.keys(next.tweaks).length === 0);
      void kvSet(`look:${track.id}`, empty ? null : next);
      void kvSet(`theme:${track.id}`, null); // the legacy single-style pin is superseded
    },
    [track],
  );

  const setPick = useCallback((pick: Pick) => persist({ pick, tweaks: song?.tweaks ?? {} }), [persist, song]);
  const setTweaks = useCallback((fn: (t: Tweaks) => Tweaks) => persist({ pick: song?.pick ?? { kind: 'auto' }, tweaks: fn(song?.tweaks ?? {}) }), [persist, song]);
  const resetTweaks = useCallback(() => persist({ pick: song?.pick ?? { kind: 'auto' }, tweaks: {} }), [persist, song]);

  const correct = useCallback(
    (id: CorrectionId) => {
      if (!track) return;
      const next = applyCorrection(corrections, id);
      setCorrections(next);
      void kvSet(`corr:${track.id}`, next);
    },
    [track, corrections],
  );
  const resetCorrections = useCallback(() => {
    if (!track) return;
    setCorrections(null);
    void kvSet(`corr:${track.id}`, null);
  }, [track]);

  /** Save the look on screen (direction + this song's adjustments) as a named theme and apply it to this song. */
  const saveAsTheme = useCallback(
    (name: string) => {
      const base = resolved.direction;
      const theme = saveTheme(name, base, mergeTweaks(resolved.tweaks, undefined));
      persist({ pick: { kind: 'saved', id: theme.id }, tweaks: {} });
      return theme;
    },
    [resolved, saveTheme, persist],
  );

  /** false while this song's stored look and tags are still loading (the stage holds its first frame until then) */
  const ready = !trackId || (storedFor === trackId && (tagsReady || grace));
  const aiState: AiState = !ui.aiInterpret ? 'off' : ai ? 'used' : aiTried ? 'unavailable' : 'loading';

  return { ready, identity, described, resolved, tags, corrections, song, aiState, setPick, setTweaks, resetTweaks, correct, resetCorrections, saveAsTheme };
}
