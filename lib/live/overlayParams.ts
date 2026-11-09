// The overlay page's options live in its URL, so OBS and wallpaper apps can be set up by pasting one address.

import { DEFAULT_STRIP, STRIP_FONTS, type StripOptions } from '@/components/live/LyricStrip';

export function parseOverlayParams(search: string): StripOptions {
  const q = new URLSearchParams(search);
  const pick = <T extends string>(k: string, allowed: readonly T[], d: T): T => {
    const v = q.get(k) as T | null;
    return v && allowed.includes(v) ? v : d;
  };
  const flag = (k: string, d: boolean) => (q.has(k) ? q.get(k) !== '0' && q.get(k) !== 'false' : d);
  return {
    bg: pick('bg', ['transparent', 'solid', 'cover'] as const, 'transparent'),
    size: pick('size', ['s', 'm', 'l', 'xl'] as const, 'l'),
    align: pick('align', ['left', 'center'] as const, DEFAULT_STRIP.align),
    next: flag('next', true),
    meta: flag('meta', false),
    font: pick('font', STRIP_FONTS, DEFAULT_STRIP.font),
  };
}

export function overlayUrl(origin: string, o: StripOptions): string {
  const q = new URLSearchParams({ bg: o.bg, size: o.size, align: o.align, next: o.next ? '1' : '0', meta: o.meta ? '1' : '0', font: o.font });
  return `${origin}/overlay?${q.toString()}`;
}
