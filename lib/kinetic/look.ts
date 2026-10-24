// A Look is the fully RESOLVED art direction for one song: every colour, face, treatment and motion value the renderer needs.
// It is produced by lib/theme/compose.ts (from the song's identity, an art direction and the listener's adjustments) and consumed
// by computeFrame() and the renderer. Nothing in here decides anything: it is data, so the same Look always draws the same frame.

import type { SceneKind, StyleDef } from './styleBase';

export type ArtTreatment = 'wash' | 'defocus' | 'tonal' | 'cinema' | 'card' | 'split' | 'collage' | 'bleed' | 'off';
export const ART_TREATMENTS: ArtTreatment[] = ['wash', 'defocus', 'tonal', 'cinema', 'card', 'split', 'collage', 'bleed', 'off'];
/** how words ENTER. 'preset' = the layout family's own entrance (the director's choice per line). */
export type Transition = 'preset' | 'cut' | 'fade' | 'drift' | 'rise' | 'pop' | 'drop' | 'zoom' | 'blur' | 'unfold' | 'spin' | 'snap' | 'slide' | 'scatter' | 'bounce' | 'glitch' | 'elastic';
export const TRANSITIONS: Transition[] = ['preset', 'cut', 'fade', 'drift', 'rise', 'pop', 'drop', 'zoom', 'blur', 'unfold', 'spin', 'snap', 'slide', 'scatter', 'bounce', 'glitch', 'elastic'];
/** how words LEAVE ('auto' = matches the entrance family) */
export type ExitKind = 'auto' | 'fade' | 'rise' | 'drop' | 'zoom' | 'shrink' | 'slide' | 'scatter' | 'spin' | 'blur' | 'cut';
export const EXIT_KINDS: ExitKind[] = ['auto', 'fade', 'rise', 'drop', 'zoom', 'shrink', 'slide', 'scatter', 'spin', 'blur', 'cut'];
/** a one-shot effect when a new line begins */
export type LineTransition = 'none' | 'zoomPunch' | 'pan' | 'tilt' | 'wipe' | 'iris' | 'bars' | 'flash';
export const LINE_TRANSITIONS: LineTransition[] = ['none', 'zoomPunch', 'pan', 'tilt', 'wipe', 'iris', 'bars', 'flash'];

export type LookColors = {
  /** words that have been sung / the resting colour of lyrics */
  ink: string;
  /** words not yet sung (line reveal) and secondary text */
  inkDim: string;
  /** the word being sung */
  active: string;
  /** emphasis words in a chorus / the one accent */
  accent: string;
  /** captions, motifs, small furniture */
  support: string;
};

export type Look = {
  /** changes whenever anything layout- or draw-relevant changes (layout caches key on it) */
  key: string;
  /** final style, after typography and texture adjustments */
  style: StyleDef;
  ground: [string, string] | null;
  colors: LookColors | null;
  /** 4 colours for motifs / interlude light, already harmonised with the direction */
  palette: string[] | null;
  artwork: { treatment: ArtTreatment; /** 0..1 */ amount: number; side: 'left' | 'right'; reflect: boolean; /** 0..1 how soft */ blur: number };
  layout: { align: 'center' | 'left'; textScale: number; /** fraction of height, + = lower */ textY: number };
  motion: {
    /** multiplier on scene intensity */
    intensity: number;
    /** 0..1: how soft entrances are (overshoot and slides reduce, fades lead) */
    smooth: number;
    /** multiplier on word emphasis (punch, split, stretch) */
    emphasis: number;
    /** multiplier on beat pumps / shakes */
    beat: number;
    complexity: number;
    reveal: 'word' | 'line';
    transition: Transition;
    /** how words leave (default auto) */
    exit?: ExitKind;
    /** transition speed multiplier 0.5..2 (default 1) */
    speed?: number;
    /** a camera move or shape when each line begins (default none) */
    lineTransition?: LineTransition;
    /** every line, or only repeated hook lines */
    lineOn?: 'all' | 'hooks';
    /** illumination travels through held words */
    progress: boolean;
    /** the chorus brightens and uses the accent (only where the lyrics themselves repeat) */
    sections: boolean;
  };
  appearance: { grain: number; glow: number; density: number; scene: SceneKind | null };
};

/** What the artwork may actually do at this size: card / split need room beside the words, so narrow screens fall back to a wash. */
export function effectiveTreatment(look: Look | undefined | null, W: number, H: number): ArtTreatment {
  const t = look?.artwork.treatment ?? 'wash';
  if ((t === 'card' || t === 'split' || t === 'collage') && (W < H * 1.05 || W < 640)) return 'wash';
  return t;
}

export type LayoutBox = { shiftX: number; widthFrac: number; align: 'center' | 'left'; scale: number; y: number; cardRect: { x: number; y: number; w: number; h: number } | null; splitRect: { x: number; w: number } | null };

/** Where the words may live once the artwork treatment has taken its part of the stage. Pure, shared by layout and renderer. */
export function layoutBox(look: Look | undefined | null, W: number, H: number): LayoutBox {
  const t = effectiveTreatment(look, W, H);
  const side = look?.artwork.side ?? 'left';
  const align = look?.layout.align ?? 'center';
  const base = { align, scale: look?.layout.textScale ?? 1, y: (look?.layout.textY ?? 0) * H };
  if (t === 'card' || t === 'collage') {
    const cardH = Math.min(H * 0.5, W * 0.3);
    const margin = Math.min(W, H) * 0.07;
    const x = side === 'left' ? margin : W - margin - cardH;
    const cardRect = { x, y: H / 2 - cardH / 2, w: cardH, h: cardH };
    const textLeft = side === 'left' ? x + cardH + margin * 0.9 : W * 0.05;
    const textRight = side === 'left' ? W * 0.95 : x - margin * 0.9;
    const widthFrac = Math.max(0.45, Math.min(1, (textRight - textLeft) / (W * 0.9)));
    return { ...base, shiftX: (textLeft + textRight) / 2 - W / 2, widthFrac, cardRect, splitRect: null };
  }
  if (t === 'split') {
    const w = W * 0.34;
    const textLeft = side === 'left' ? w + W * 0.04 : W * 0.05;
    const textRight = side === 'left' ? W * 0.95 : W - w - W * 0.04;
    const widthFrac = Math.max(0.45, Math.min(1, (textRight - textLeft) / (W * 0.9)));
    return { ...base, shiftX: (textLeft + textRight) / 2 - W / 2, widthFrac, cardRect: null, splitRect: { x: side === 'left' ? 0 : W - w, w } };
  }
  return { ...base, shiftX: 0, widthFrac: 1, cardRect: null, splitRect: null };
}
