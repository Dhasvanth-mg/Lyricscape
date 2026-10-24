// Type pairings the listener can choose from. Each is a display face plus an accent face for emphasised words.

import type { FontDef } from '../kinetic/styleBase';
import type { TypePairId } from './types';

export type TypePair = { id: TypePairId; label: string; hint: string; display: FontDef | null; accent: FontDef | null; sample: string };

const f = (family: string, weight: number | string, widthFactor: number, uppercase: boolean, letterSpacingEm = 0, italic = false): FontDef => ({ family, weight, widthFactor, uppercase, letterSpacingEm, italic });

export const TYPE_PAIRS: TypePair[] = [
  { id: 'direction', label: "The direction's own", hint: 'The pairing this art direction was designed with', display: null, accent: null, sample: 'Aa' },
  { id: 'velvet', label: 'Velvet serif', hint: 'Warm, spaced Garamond with an italic voice', display: f('Cormorant Garamond', 600, 0.42, false, 0.012), accent: f('Cormorant Garamond', 500, 0.4, false, 0.01, true), sample: 'Aa' },
  { id: 'light-serif', label: 'Light serif', hint: 'Thin Garamond, airy and quiet', display: f('Cormorant Garamond', 300, 0.4, false, 0.03), accent: f('Cormorant Garamond', 300, 0.38, false, 0.02, true), sample: 'Aa' },
  { id: 'art-serif', label: 'Art-book serif', hint: 'A condensed display serif in roman and italic', display: f('Instrument Serif', 400, 0.4, false), accent: f('Instrument Serif', 400, 0.38, false, 0, true), sample: 'Aa' },
  { id: 'editorial', label: 'Editorial serif', hint: 'High-contrast newspaper headline', display: f('Playfair Display Variable', 800, 0.52, false, -0.01), accent: f('Playfair Display Variable', 600, 0.48, false, 0, true), sample: 'Aa' },
  { id: 'quiet-sans', label: 'Quiet sans', hint: 'Light lowercase sans with a serif italic', display: f('Inter Variable', 300, 0.56, false, 0.02), accent: f('Instrument Serif', 400, 0.38, false, 0, true), sample: 'Aa' },
  { id: 'grotesk', label: 'Grotesk', hint: 'Clean geometric sans with a wide caps accent', display: f('Space Grotesk Variable', 700, 0.58, false, -0.025), accent: f('Archivo Variable', 900, 0.66, true, -0.02), sample: 'Aa' },
  { id: 'condensed', label: 'Condensed caps', hint: 'Tall poster caps with a serif counterpoint', display: f('Anton', 400, 0.44, true, 0.01), accent: f('DM Serif Display', 400, 0.5, false, 0, true), sample: 'AA' },
  { id: 'poster', label: 'Poster + typewriter', hint: 'Bebas caps, typewriter second voice', display: f('Bebas Neue', 400, 0.38, true, 0.03), accent: f('Special Elite', 400, 0.56, false), sample: 'AA' },
  { id: 'wide', label: 'Wide black', hint: 'Heavy extended caps', display: f('Archivo Variable', 900, 0.66, true, -0.02), accent: f('DM Serif Display', 400, 0.5, false, 0, true), sample: 'AA' },
  { id: 'syne', label: 'Syne', hint: 'Quirky extended grotesque, experimental but controlled', display: f('Syne Variable', 800, 0.72, true, -0.01), accent: f('Instrument Serif', 400, 0.38, false, 0, true), sample: 'AA' },
  { id: 'typewriter', label: 'Typewriter', hint: 'Textured, a little imperfect', display: f('Special Elite', 400, 0.56, false), accent: f('Instrument Serif', 400, 0.38, false, 0, true), sample: 'Aa' },
  { id: 'marker', label: 'Marker', hint: 'Handwritten felt-tip', display: f('Permanent Marker', 400, 0.56, false), accent: f('Permanent Marker', 400, 0.56, false), sample: 'Aa' },
];

export const TYPE_PAIR: Record<TypePairId, TypePair> = Object.fromEntries(TYPE_PAIRS.map((t) => [t.id, t])) as Record<TypePairId, TypePair>;
