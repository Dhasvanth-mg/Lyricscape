// Card colour sets (Sketch Cards design-spec section 2): paper, ink, one accent, one pill colour, and a shade, taken from the
// song's own colours where they read, otherwise from the style's fallback sets. The contrast floors are the spec's: the big
// word 7:1 against the card, thin lettering 4.5:1. Dark-register sets are separate and never mixed with cute ones (the
// invalid-combination table).

import { contrastRatio, mix } from '../../kinetic/util';

export type ColourSet = { paper: string; ink: string; accent: string; pill: string; shade: string; dark: boolean };

/** Paper stocks by card type family: white index, kraft, pastel stocks, sticky-note colours. */
export const PAPERS = {
  index: ['#fbfaf4', '#f6f3ea'],
  stock: ['#efe6d2', '#e6dcc6', '#f3e3df', '#dfe8e0', '#e3e6ef', '#f1ead2'],
  kraft: ['#cfae84', '#c7a57b'],
  sticky: ['#fbe57d', '#f9b9c8', '#b9e3f2', '#c9eeb1', '#fbcf8b'],
  newsprint: ['#e9e6dc', '#e2ddd0'],
  thermal: ['#f7f6f2'],
  black: ['#151416', '#1b1a1d'],
} as const;

const INKS = ['#1f1a24', '#1b2340', '#2c1e18', '#20262a'];
const FALLBACK_ACCENTS = ['#e0574a', '#2f7fe0', '#f1b92a', '#4aa6d6', '#a14f7b', '#2e9a6a', '#e5732d'];

/** the first colour that reaches `ratio` against `bg`, or the best of them darkened/lightened until it does */
export function readable(bg: string, candidates: string[], ratio: number): string {
  for (const c of candidates) if (contrastRatio(c, bg) >= ratio) return c;
  const best = candidates.reduce((a, b) => (contrastRatio(b, bg) > contrastRatio(a, bg) ? b : a), candidates[0] ?? '#000000');
  const toward = contrastRatio('#000000', bg) > contrastRatio('#ffffff', bg) ? '#000000' : '#ffffff';
  for (let t = 0.1; t <= 1.001; t += 0.1) {
    const c = mix(best, toward, t);
    if (contrastRatio(c, bg) >= ratio) return c;
  }
  return toward;
}

/**
 * A colour set for one card. `songColours` are the song's palette (album colours blended with mood). The accent must be
 * visible on the paper (3:1, it carries fills, not text); the pill's text colour is chosen later against the pill itself.
 */
export function colourSet(paper: string, songColours: string[], pick: number, dark: boolean): ColourSet {
  if (dark) {
    const ink = readable(paper, ['#f1ede4', '#e8e4da'], 7);
    const accent = readable(paper, ['#c2453a', '#b8513f', '#9db3cf'], 3);
    return { paper, ink, accent, pill: accent, shade: mix(paper, ink, 0.45), dark: true };
  }
  const ink = readable(paper, [INKS[pick % INKS.length]!, ...INKS], 7);
  const pool = [...songColours.filter((c) => /^#[0-9a-f]{6}$/i.test(c)), ...FALLBACK_ACCENTS];
  const visible = pool.filter((c) => contrastRatio(c, paper) >= 2.2 && contrastRatio(c, ink) >= 1.6);
  const list = visible.length ? visible : FALLBACK_ACCENTS;
  const accent = list[pick % list.length]!;
  const pill = list[(pick + 1) % list.length] ?? accent;
  return { paper, ink, accent, pill, shade: mix(paper, ink, 0.35), dark: false };
}

/** the text colour that reads on a pill (4.5:1) */
export const onPill = (pill: string, set: ColourSet) => readable(pill, [set.ink, set.paper, '#ffffff', '#111111'], 4.5);
