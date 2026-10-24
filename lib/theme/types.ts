// The theme vocabulary: what an art direction is made of, and what a listener may change.

import type { SongIdentity, GenreFamily } from '../identity/types';
import type { ArtTreatment, Look, Transition } from '../kinetic/look';
import type { SceneKind } from '../kinetic/styleBase';
import type { StyleId } from '../kinetic/types';

export type CoverInfo = {
  /** [accent1, accent2, accent3, dark] */
  palette?: string[];
  light: number;
  vibrance: number;
  warmth?: number;
};

export type PaletteSpec = {
  id: string;
  label: string;
  /** two colours for the ground, or 'cover' = a flat field taken from the cover's own colour */
  ground: [string, string] | 'cover' | 'coverDark';
  /** push the active colour and accent to a vivid, bright version of the cover colour (hot type on full-bleed art) */
  vivid?: boolean;
  ink: string;
  inkDim: string;
  active: string;
  accent: string;
  support: string;
  /** 4 colours for motifs and interlude light: [a, b, c, dark] */
  palette: [string, string, string, string];
  /** how far the cover may pull this palette (0..1) */
  coverInfluence: number;
  /** the most saturated any pulled colour may become */
  maxSat: number;
};

export type DirectionFit = { score: number; reasons: string[] };
export type PickContext = { identity: SongIdentity | null; cover: CoverInfo | null };

export type Direction = {
  /** the style-table id this direction is rendered with (new directions have their own, classic ones keep theirs) */
  id: StyleId;
  family: GenreFamily;
  label: string;
  tagline: string;
  /** empty = classic colouring (the cover and mood decide) */
  palettes: PaletteSpec[];
  pickPalette: (c: PickContext) => number;
  artwork: { treatment: ArtTreatment; side: 'left' | 'right'; reflect: boolean; amount: number; blur: number };
  layout: Look['layout'];
  motion: Look['motion'];
  appearance: { glow: number; density: number };
  /** needs real genre evidence in one of these families (or the listener's explicit choice) to be picked automatically */
  requires?: GenreFamily[];
  /** which artwork treatment suits THIS song (defaults to artwork.treatment) */
  treatmentFor?: (c: PickContext) => ArtTreatment;
  fit: (c: PickContext) => DirectionFit;
};

export type TypePairId = 'direction' | 'velvet' | 'editorial' | 'art-serif' | 'quiet-sans' | 'grotesk' | 'poster' | 'condensed' | 'wide' | 'typewriter' | 'light-serif' | 'syne' | 'marker';

/** Everything the listener can change, as absolute values. Anything left undefined follows the art direction. */
export type Tweaks = {
  paletteId?: string;
  colors?: Partial<{ ground: string; ink: string; active: string; accent: string }>;
  typography?: TypePairId;
  scene?: SceneKind | 'none';
  artwork?: ArtTreatment;
  motion?: Partial<{ intensity: number; smooth: number; emphasis: number; beat: number; complexity: number; transition: Transition }>;
  appearance?: Partial<{ textScale: number; textY: number; align: 'center' | 'left'; contrast: number; grain: number; glow: number; blur: number; brightness: number; density: number }>;
};

export type ThemeFamilyChoice = StyleId;

/** A listener's saved theme: a starting direction plus their adjustments. */
export type SavedTheme = { id: string; name: string; base: StyleId; tweaks: Tweaks; createdAt: number };

/** How a song's look is chosen. Auto follows the song identity; the others are the listener's decision. */
export type Pick = { kind: 'auto' } | { kind: 'direction'; id: StyleId } | { kind: 'saved'; id: string };

/** What is stored for one song. */
export type SongLook = { pick: Pick; tweaks: Tweaks };
