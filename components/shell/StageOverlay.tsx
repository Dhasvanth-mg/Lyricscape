'use client';

import { useEffect } from 'react';
import { usePlayer } from '@/lib/player/controller';
import { useUi } from '@/lib/ui-store';
import { LyricStage } from '@/components/visualizer/LyricStage';

/** Full-screen "chill mode" lyric stage, available from any route (press L). */
export function StageOverlay() {
  const open = useUi((s) => s.stageOpen);
  const close = useUi((s) => s.closeStage);
  const style = useUi((s) => s.style);
  const setStyle = useUi((s) => s.setStyle);
  const track = usePlayer((s) => s.track);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.fullscreenElement) close();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, close]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] bg-black" role="dialog" aria-modal="true" aria-label="Lyric stage">
      <LyricStage track={track} style={style} onStyleChange={setStyle} chrome onClose={close} className="h-full w-full" />
    </div>
  );
}
