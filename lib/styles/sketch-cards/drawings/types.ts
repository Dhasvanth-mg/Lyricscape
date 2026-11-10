import type { Pen } from '../pen';

/** One Sketch Cards drawing: an asset with a Phase 2 id, drawn by code in a 100 x 100 box centred on (0, 0). */
export type Drawing = {
  /** the Phase 2 name, unchanged */
  name: string;
  /** lyric words it answers to (the slot filler prefers a drawing whose tags the line contains) */
  tags: string[];
  draw(p: Pen): void;
};

export type Register = 'cute' | 'everyday' | 'dark';
