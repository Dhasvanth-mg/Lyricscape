'use client';

import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { hasRealWordTimes, stripAt, wordProgress, type StripLine } from '@/lib/live/strip';

export type StripOptions = {
  /** transparent: for OBS; solid: dark panel; cover: the cover blurred behind (wallpaper) */
  bg: 'transparent' | 'solid' | 'cover';
  size: 's' | 'm' | 'l' | 'xl';
  align: 'left' | 'center';
  /** also show the next line, smaller */
  next: boolean;
  /** show title and artist */
  meta: boolean;
};

export const DEFAULT_STRIP: StripOptions = { bg: 'solid', size: 'm', align: 'center', next: true, meta: true };

const SIZE: Record<StripOptions['size'], { cur: string; nxt: string }> = {
  s: { cur: 'text-[clamp(16px,4.5vw,22px)]', nxt: 'text-[clamp(12px,3vw,15px)]' },
  m: { cur: 'text-[clamp(20px,6vw,34px)]', nxt: 'text-[clamp(13px,3.6vw,19px)]' },
  l: { cur: 'text-[clamp(26px,7vw,56px)]', nxt: 'text-[clamp(15px,4vw,28px)]' },
  xl: { cur: 'text-[clamp(32px,6.5vw,96px)]', nxt: 'text-[clamp(18px,3.4vw,44px)]' },
};

type Props = {
  lines: StripLine[] | null;
  /** lyric time now (ms); called every frame */
  now: () => number;
  /** the window whose frames drive the animation (the floating window has its own) */
  win?: Window | null;
  options: StripOptions;
  title?: string | null;
  artist?: string | null;
  artworkUrl?: string | null;
  accent?: string | null;
  /** a second line under each lyric line (romanised or translated) */
  sub?: (string | null)[] | null;
  /** shown when there are no lyrics; null shows nothing (OBS) */
  emptyText?: string | null;
};

/**
 * One or two lyric lines, big and readable, for small and borrowed surfaces (floating window, stream overlay, wallpaper).
 * React re-renders only when the line changes; word progress is written straight to CSS variables every frame.
 */
export function LyricStrip({ lines, now, win, options, title, artist, artworkUrl, accent, sub, emptyText = 'No lyrics for this song' }: Props) {
  const [pos, setPos] = useState({ current: -1, next: -1 });
  const wordEls = useRef<(HTMLSpanElement | null)[]>([]);
  const lineEl = useRef<HTMLParagraphElement | null>(null);
  const nowRef = useRef(now);
  useEffect(() => {
    nowRef.current = now;
  }, [now]);

  useEffect(() => {
    const w = win ?? window;
    let raf = 0;
    let shown = { current: -1, next: -1 };
    const loop = () => {
      const ls = lines ?? [];
      const t = nowRef.current();
      const s = stripAt(ls, t);
      if (s.current !== shown.current || s.next !== shown.next) {
        shown = { current: s.current, next: s.next };
        setPos(shown);
      }
      const l = s.current >= 0 ? ls[s.current] : null;
      if (l && hasRealWordTimes(l)) {
        l.words.forEach((wd, i) => wordEls.current[i]?.style.setProperty('--p', String(wordProgress(wd, t))));
      }
      lineEl.current?.style.setProperty('--p', String(s.lineProgress));
      raf = w.requestAnimationFrame(loop);
    };
    raf = w.requestAnimationFrame(loop);
    return () => w.cancelAnimationFrame(raf);
  }, [lines, win]);

  const ls = lines ?? [];
  const cur = pos.current >= 0 ? ls[pos.current] : null;
  const nxt = options.next && pos.next >= 0 ? ls[pos.next] : null;
  const karaoke = !!cur && hasRealWordTimes(cur);
  const sz = SIZE[options.size];
  const hi = accent ?? '#ffffff';

  return (
    <div
      data-testid="lyric-strip"
      className={clsx('relative flex h-full w-full flex-col justify-center overflow-hidden px-[5%] py-3', options.align === 'center' ? 'items-center text-center' : 'items-start text-left', options.bg === 'solid' && 'bg-[#0b0a12]')}
      style={{ ['--hi' as string]: hi, ['--lo' as string]: 'rgba(255,255,255,0.42)' }}
    >
      {options.bg === 'cover' && artworkUrl && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={artworkUrl} alt="" aria-hidden className="absolute inset-0 -z-10 h-full w-full scale-110 object-cover blur-2xl brightness-[0.45]" />
          <div className="absolute inset-0 -z-10 bg-black/25" />
        </>
      )}
      <div className={clsx('flex w-full flex-col gap-[0.35em]', options.bg === 'transparent' && '[filter:drop-shadow(0_2px_6px_rgba(0,0,0,0.85))]')}>
        {cur ? (
          <p ref={lineEl} key={pos.current} className={clsx('font-display leading-[1.08] font-bold tracking-tight [text-wrap:balance]', sz.cur, !karaoke && 'text-[var(--hi)]')}>
            {karaoke
              ? cur.words.map((w, i) => (
                  <span
                    key={i}
                    ref={(el) => {
                      wordEls.current[i] = el;
                    }}
                    className="bg-clip-text text-transparent"
                    style={{ backgroundImage: 'linear-gradient(90deg, var(--hi) calc(var(--p, 0) * 100%), var(--lo) calc(var(--p, 0) * 100%))' }}
                  >
                    {w.text}
                    {i < cur.words.length - 1 ? ' ' : ''}
                  </span>
                ))
              : cur.words.map((w) => w.text).join(' ')}
          </p>
        ) : ls.length === 0 && emptyText ? (
          <p className={clsx('font-display text-white/60', sz.nxt)}>{emptyText}</p>
        ) : ls.length > 0 && !nxt ? (
          <p aria-label="Instrumental" className={clsx('font-display tracking-[0.4em] text-white/50', sz.cur)}>• • •</p>
        ) : null}
        {cur && sub?.[pos.current] && <p data-testid="strip-sub" className={clsx('leading-snug font-semibold text-white/85 italic [text-wrap:balance]', sz.nxt)}>{sub[pos.current]}</p>}
        {nxt && <p className={clsx('leading-snug font-semibold text-white/55 [text-wrap:balance]', sz.nxt)}>{nxt.words.map((w) => w.text).join(' ')}</p>}
      </div>
      {options.meta && title && (
        <p className={clsx('absolute bottom-1.5 max-w-[90%] truncate text-[11px] tracking-wide text-white/55', options.align === 'center' ? 'left-1/2 -translate-x-1/2' : 'left-[5%]', options.bg === 'transparent' && '[text-shadow:0_1px_3px_rgba(0,0,0,0.9)]')}>
          {title}
          {artist ? ` · ${artist}` : ''}
        </p>
      )}
    </div>
  );
}
