'use client';

import { useEffect, useRef } from 'react';
import { usePlayer } from '@/lib/player/controller';
import { recordPlay } from '@/lib/library/history';

/** Records each song once it actually starts playing, for "Jump back in" and recommendations. */
export function PlayHistoryRecorder() {
  const track = usePlayer((s) => s.track);
  const playing = usePlayer((s) => s.status === 'playing');
  const last = useRef<string | null>(null);

  useEffect(() => {
    if (!track || !playing || last.current === track.id) return;
    last.current = track.id;
    void recordPlay(track).catch(() => undefined);
  }, [track, playing]);

  return null;
}
