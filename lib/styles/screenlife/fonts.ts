// Screenlife faces (typography.md): Inter for the interface, JetBrains Mono for terminals, Instrument Serif for documents; each
// falls back through the Noto faces for Devanagari, Tamil, Arabic and Hebrew so a kit never changes its layout when the script
// changes, only the glyph source. No added letter spacing, ever.

import type { Script } from '../sketch-cards/letter';

const FALLBACK = '"Noto Sans Devanagari Variable", "Noto Sans Tamil Variable", "Noto Sans Arabic Variable", "Noto Sans Hebrew Variable", system-ui, sans-serif';

export type Face = 'ui' | 'mono' | 'serif' | 'retro';

export function font(face: Face, weight: number, px: number, script: Script = 'latin'): string {
  const p = Math.max(1, Math.round(px * 10) / 10);
  // complex scripts take the Noto face first so matras and conjuncts come from one font
  const lead = script === 'devanagari' ? '"Noto Sans Devanagari Variable", ' : script === 'tamil' ? '"Noto Sans Tamil Variable", ' : script === 'arabic' ? '"Noto Sans Arabic Variable", ' : script === 'hebrew' ? '"Noto Sans Hebrew Variable", ' : '';
  const w = script === 'latin' ? weight : Math.min(600, Math.max(400, weight));
  switch (face) {
    case 'mono':
      return `${w} ${p}px ${lead}"JetBrains Mono Variable", ui-monospace, ${FALLBACK}`;
    case 'serif':
      return `400 ${p}px ${lead}"Instrument Serif", Georgia, ${FALLBACK}`;
    case 'retro':
      return `${w} ${p}px ${lead}"Space Grotesk Variable", "Inter Variable", ${FALLBACK}`;
    default:
      return `${w} ${p}px ${lead}"Inter Variable", "Segoe UI", ${FALLBACK}`;
  }
}

/** x-height as a share of the font size (Inter and the Noto faces sit near 0.53; the serif is smaller) */
export const X_HEIGHT: Record<Face, number> = { ui: 0.54, mono: 0.53, serif: 0.45, retro: 0.5 };
