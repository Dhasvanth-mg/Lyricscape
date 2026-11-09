'use client';

import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { hasRealWordTimes, stripAt, wordProgress, type StripLine } from '@/lib/live/strip';

export type StripFont = 'clean' | 'grotesk' | 'serif' | 'poster';
export type StripOptions = {
  /** transparent: only the lyrics (OBS, the see-through desktop window); solid: a dark wash in the song's colours; cover: the cover blurred behind */
  bg: 'transparent' | 'solid' | 'cover';
  size: 's' | 'm' | 'l' | 'xl';
  align: 'left' | 'center';
  /** also show the next line, smaller */
  next: boolean;
  /** show title and artist */
  meta: boolean;
  font: StripFont;
};

export const DEFAULT_STRIP: StripOptions = { bg: 'solid', size: 'm', align: 'center', next: true, meta: true, font: 'clean' };
export const STRIP_FONTS: StripFont[] = ['clean', 'grotesk', 'serif', 'poster'];
export const STRIP_FONT_LABEL: Record<StripFont, string> = { clean: 'Clean', grotesk: 'Grotesk', serif: 'Serif', poster: 'Poster' };

const INDIC = '"Noto Sans Devanagari Variable", "Noto Sans Tamil Variable", "Nirmala UI"';
const FONT: Record<StripFont, { family: string; weight: number; tracking: string; leading: number }> = {
  clean: { family: `"Inter Variable", ${INDIC}, system-ui, sans-serif`, weight: 800, tracking: '-0.025em', leading: 1.12 },
  grotesk: { family: `"Space Grotesk Variable", ${INDIC}, sans-serif`, weight: 700, tracking: '-0.02em', leading: 1.1 },
  serif: { family: `"Instrument Serif", ${INDIC}, Georgia, serif`, weight: 400, tracking: '-0.01em', leading: 1.05 },
  poster: { family: `"Anton", ${INDIC}, Impact, sans-serif`, weight: 400, tracking: '0.01em', leading: 1.04 },
};

// sizes scale with the window, so the floating window, a 300 px OBS strip and a 4K wallpaper all read well
const SIZE: Record<StripOptions['size'], { cur: string; nxt: string }> = {
  s: { cur: 'clamp(16px, 5.2vw, 26px)', nxt: 'clamp(12px, 3.2vw, 16px)' },
  m: { cur: 'clamp(20px, 6.6vw, 40px)', nxt: 'clamp(13px, 3.6vw, 20px)' },
  l: { cur: 'clamp(26px, 7.4vw, 64px)', nxt: 'clamp(15px, 3.8vw, 30px)' },
  xl: { cur: 'clamp(32px, 7vw, 108px)', nxt: 'clamp(18px, 3.4vw, 46px)' },
};

// line changes slide up and fade in (also inside the floating window, which has its own document)
const CSS = `
@keyframes ls-strip-in { from { opacity: 0; transform: translateY(0.35em); filter: blur(4px) } to { opacity: 1; transform: none; filter: none } }
@keyframes ls-strip-next { from { opacity: 0 } to { opacity: 1 } }
.ls-strip-in { animation: ls-strip-in 380ms cubic-bezier(.2,.7,.2,1) both }
.ls-strip-next { animation: ls-strip-next 500ms ease-out both }
@media (prefers-reduced-motion: reduce) { .ls-strip-in, .ls-strip-next { animation: none } }
`;

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
  /** the song's colours (from its cover): the sung part of a word takes the brightest one */
  palette?: string[] | null;
  /** a second line under each lyric line (romanised or translated) */
  sub?: (string | null)[] | null;
  /** shown when there are no lyrics; null shows nothing (OBS) */
  emptyText?: string | null;
};

/** The brightest, most colourful of the song's colours, for the sung part of a word; white when there is none worth using. */
export function accentOf(palette: string[] | null | undefined): string {
  let best = '#ffffff';
  let score = 0;
  for (const hex of palette ?? []) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex);
    if (!m) continue;
    const n = parseInt(m[1]!, 16);
    const r = (n >> 16) / 255;
    const g = ((n >> 8) & 255) / 255;
    const b = (n & 255) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const sat = max === 0 ? 0 : (max - min) / max;
    const s = sat * 0.6 + max * 0.4;
    // only light, colourful colours stay readable over dark or transparent backgrounds
    if (max >= 0.6 && sat >= 0.35 && s > score) {
      score = s;
      best = `#${m[1]}`;
    }
  }
  return best;
}

/**
 * One or two lyric lines, big and readable, for small and borrowed surfaces (floating window, stream overlay, wallpaper, the
 * see-through desktop window). React re-renders only when the line changes; word progress goes straight to CSS variables per frame.
 */
export function LyricStrip({ lines, now, win, options, title, artist, artworkUrl, palette, sub, emptyText = 'No lyrics for this song' }: Props) {
  const [pos, setPos] = useState({ current: -1, next: -1 });
  const wordEls = useRef<(HTMLSpanElement | null)[]>([]);
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
      if (l && hasRealWordTimes(l)) l.words.forEach((wd, i) => wordEls.current[i]?.style.setProperty('--p', String(wordProgress(wd, t))));
      raf = w.requestAnimationFrame(loop);
    };
    raf = w.requestAnimationFrame(loop);
    return () => w.cancelAnimationFrame(raf);
  }, [lines, win]);

  const ls = lines ?? [];
  const cur = pos.current >= 0 ? ls[pos.current] : null;
  const nxt = options.next && pos.next >= 0 ? ls[pos.next] : null;
  const karaoke = !!cur && hasRealWordTimes(cur);
  const f = FONT[options.font] ?? FONT.clean;
  const sz = SIZE[options.size];
  const accent = accentOf(palette);
  const clear = options.bg === 'transparent';
  const subText = cur ? sub?.[pos.current] : null;
  // over a desktop or a game nothing behind the words can be assumed: a tight dark edge plus a soft halo keeps them readable anywhere
  const legible = clear ? '[filter:drop-shadow(0_1px_1px_rgba(0,0,0,0.95))_drop-shadow(0_0_14px_rgba(0,0,0,0.55))]' : '';

  return (
    <div
      data-testid="lyric-strip"
      className={clsx('relative isolate flex h-full w-full flex-col justify-center overflow-hidden px-[6%] py-4', options.align === 'center' ? 'items-center text-center' : 'items-start text-left')}
      style={{ ['--hi' as string]: '#ffffff', ['--acc' as string]: accent, ['--lo' as string]: clear ? 'rgba(255,255,255,0.78)' : 'rgba(255,255,255,0.34)' }}
    >
      <style>{CSS}</style>
      {options.bg === 'solid' && (
        <div aria-hidden className="absolute inset-0 -z-10" style={{ background: `radial-gradient(120% 140% at 15% 0%, color-mix(in srgb, ${accent} 30%, #0b0a12) 0%, #0b0a12 55%), #0b0a12` }} />
      )}
      {options.bg === 'cover' && (
        <div aria-hidden className="absolute inset-0 -z-10 bg-[#0b0a12]">
          {artworkUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={artworkUrl} alt="" className="h-full w-full scale-125 object-cover opacity-70 blur-3xl saturate-150" />
          )}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.25),rgba(0,0,0,0.7))]" />
        </div>
      )}

      <div className={clsx('flex w-full flex-col gap-[0.4em]', legible)}>
        {cur ? (
          <p
            key={pos.current}
            className="ls-strip-in [text-wrap:balance]"
            style={{ fontFamily: f.family, fontWeight: f.weight, letterSpacing: f.tracking, lineHeight: f.leading, fontSize: sz.cur, color: karaoke ? undefined : 'var(--hi)' }}
          >
            {karaoke
              ? cur.words.map((w, i) => (
                  <span
                    key={i}
                    ref={(el) => {
                      wordEls.current[i] = el;
                    }}
                    className="bg-clip-text text-transparent"
                    style={{ backgroundImage: 'linear-gradient(90deg, var(--hi) 0%, var(--acc) calc(var(--p, 0) * 100%), var(--lo) calc(var(--p, 0) * 100%))' }}
                  >
                    {w.text}
                    {i < cur.words.length - 1 ? ' ' : ''}
                  </span>
                ))
              : cur.words.map((w) => w.text).join(' ')}
          </p>
        ) : ls.length === 0 && emptyText ? (
          <p className="text-white/60" style={{ fontFamily: f.family, fontSize: sz.nxt }}>
            {emptyText}
          </p>
        ) : ls.length > 0 && !nxt ? (
          <p aria-label="Instrumental" className="tracking-[0.4em] text-white/50" style={{ fontSize: sz.nxt }}>
            • • •
          </p>
        ) : null}
        {subText && (
          <p key={`s${pos.current}`} data-testid="strip-sub" className="ls-strip-next font-medium text-white/85 italic [text-wrap:balance]" style={{ fontSize: sz.nxt, lineHeight: 1.25 }}>
            {subText}
          </p>
        )}
        {nxt && (
          <p key={`n${pos.next}`} className={clsx('ls-strip-next font-semibold [text-wrap:balance]', clear ? 'text-white/85' : 'text-white/45')} style={{ fontFamily: f.family, fontSize: sz.nxt, lineHeight: 1.2, fontWeight: Math.min(f.weight, 600) }}>
            {nxt.words.map((w) => w.text).join(' ')}
          </p>
        )}
      </div>

      {options.meta && title && (
        <div className={clsx('absolute bottom-2.5 flex max-w-[88%] items-center gap-2 text-[11px] text-white/60', options.align === 'center' ? 'left-1/2 -translate-x-1/2' : 'left-[6%]', legible)}>
          {artworkUrl && options.bg !== 'transparent' && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={artworkUrl} alt="" className="h-5 w-5 rounded-[4px] object-cover" />
          )}
          <span className="truncate">
            <span className="font-semibold text-white/80">{title}</span>
            {artist ? ` · ${artist}` : ''}
          </span>
        </div>
      )}
    </div>
  );
}
