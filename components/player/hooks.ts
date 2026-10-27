'use client';

import { useEffect, useState } from 'react';
import { player, usePlayer } from '@/lib/player/controller';

/** Smooth playback position (ms), refreshed on a timer while `active`. */
export function usePosition(active = true, fps = 12): number {
  const [pos, setPos] = useState(() => player.getPositionMs());
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let last = 0;
    // Keep controlled seek sliders at a command's new position before the next animation tick.
    const unsubscribe = usePlayer.subscribe((state, previous) => {
      if (state.positionMs !== previous.positionMs) setPos(state.positionMs);
    });
    const tick = (now: number) => {
      if (now - last > 1000 / fps) {
        last = now;
        setPos(player.getPositionMs());
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      unsubscribe();
      cancelAnimationFrame(raf);
    };
  }, [active, fps]);
  return pos;
}

export function fmtTime(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) ms = 0;
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}
