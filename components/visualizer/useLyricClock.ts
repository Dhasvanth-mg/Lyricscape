'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Track } from '@/lib/types';
import { kvGet, kvSet } from '@/lib/library/db';
import { player } from '@/lib/player/controller';
import { lyricTimeMs } from '@/lib/player/lyricTime';
import { useUi } from '@/lib/ui-store';
import { syncDiag } from '@/lib/player/syncDiag';

/**
 * The lyric clock for the current track: provider position + automatic output latency + the two user corrections
 * (device delay, shared by every song; and this song's own offset, stored beside, never inside, the lyrics).
 * `now()` is cheap enough for every animation frame, and the timing editor stamps with it too.
 */
export function useLyricClock(track: Track | null) {
  const family = track?.provider === 'spotify' ? 'spotify' : 'local';
  const device = useUi((s) => s.syncGlobal[family]);
  const setSyncGlobal = useUi((s) => s.setSyncGlobal);
  const [trackOffset, setTrackOffsetState] = useState(0);
  const trackId = track?.id ?? null;

  useEffect(() => {
    let cancelled = false;
    setTrackOffsetState(0);
    if (!trackId) return;
    const load = () =>
      void kvGet<number>(`offset:${trackId}`).then((v) => {
        if (!cancelled) setTrackOffsetState(typeof v === 'number' ? v : 0);
      });
    load();
    const onChange = (e: Event) => {
      if ((e as CustomEvent).detail === trackId) load();
    };
    window.addEventListener('lyricscape:offset', onChange);
    return () => {
      cancelled = true;
      window.removeEventListener('lyricscape:offset', onChange);
    };
  }, [trackId]);

  const ref = useRef({ device, trackOffset });
  useEffect(() => {
    ref.current = { device, trackOffset };
  }, [device, trackOffset]);

  // opt-in diagnostics (lib/player/syncDiag.ts): report the corrections in use next to the raw telemetry
  useEffect(() => {
    if (!syncDiag.enabled()) return;
    syncDiag.setCorrections(() => ({ deviceAdvanceMs: ref.current.device, trackOffsetMs: ref.current.trackOffset, outputLatencyMs: player.getOutputLatencyMs() }));
    return () => syncDiag.setCorrections(null);
  }, []);

  const now = useCallback(
    () => lyricTimeMs(player.getPositionMs(), { outputLatencyMs: player.getOutputLatencyMs(), deviceAdvanceMs: ref.current.device, trackOffsetMs: ref.current.trackOffset }),
    [],
  );

  const setDevice = useCallback((ms: number) => setSyncGlobal(family, ms), [family, setSyncGlobal]);
  const setTrackOffset = useCallback(
    (ms: number) => {
      setTrackOffsetState(ms);
      if (!trackId) return;
      void kvSet(`offset:${trackId}`, ms).then(() => window.dispatchEvent(new CustomEvent('lyricscape:offset', { detail: trackId })));
    },
    [trackId],
  );

  return { now, family, device, trackOffset, setDevice, setTrackOffset };
}
