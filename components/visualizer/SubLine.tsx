'use client';

import { useEffect, useRef, useState } from 'react';
import { stripAt, type StripLine } from '@/lib/live/strip';

/**
 * The second line (romanisation or translation) under the stage, as a subtitle. It follows the same lyric clock as the stage, and
 * only re-renders when the line changes. It sits above the canvas, so it never touches the stage's timing or drawing.
 */
export function SubLine({ lines, sub, now }: { lines: StripLine[] | null; sub: (string | null)[] | null; now: () => number }) {
  const [idx, setIdx] = useState(-1);
  const nowRef = useRef(now);
  useEffect(() => {
    nowRef.current = now;
  }, [now]);
  useEffect(() => {
    let raf = 0;
    let shown = -1;
    const loop = () => {
      const i = lines ? stripAt(lines, nowRef.current()).current : -1;
      if (i !== shown) {
        shown = i;
        setIdx(i);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [lines]);
  const text = idx >= 0 ? sub?.[idx] : null;
  if (!text) return null;
  return (
    <p data-testid="sub-line" className="pointer-events-none absolute inset-x-0 bottom-[84px] z-[5] mx-auto w-fit max-w-[86%] rounded-xl bg-black/45 px-4 py-1.5 text-center text-[clamp(15px,2.2vw,24px)] leading-snug font-semibold text-white/95 backdrop-blur-sm [text-wrap:balance] sm:bottom-[96px]">
      {text}
    </p>
  );
}
