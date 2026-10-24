// Stage modes: how the lyrics are staged, independent of which art direction a song gets.
//
//   Clean  The art-direction philosophy of the app, kept as a mode of its own: restraint, hierarchy, readable by construction.
//   Turbo  The same direction language (palette, type pairing, cover) pushed to full intensity and drawn entirely on the GPU.

export type StageMode = 'clean' | 'turbo';
export const STAGE_MODES: StageMode[] = ['clean', 'turbo'];

export type ModeDef = {
  id: StageMode;
  label: string;
  tagline: string;
  /** which renderer draws it */
  renderer: 'canvas2d' | 'webgl2';
  /** the rules the mode holds itself to (shown in the Studio, asserted by tests where they can be) */
  principles: string[];
};

export const MODES: Record<StageMode, ModeDef> = {
  clean: {
    id: 'clean',
    label: 'Clean',
    tagline: 'Restrained, music-informed, readable. The words are the show.',
    renderer: 'canvas2d',
    principles: [
      'One art direction per song, chosen from what the song is (genre, pace, mood, cover), and explained.',
      'Type pairings and negative space over decoration. No clutter: no duplicate lyric text, no decoration crossing a word.',
      'Readability is a guarantee, not a hope: ink 4.5:1 against both ends of the ground, whatever the cover or the adjustments.',
      'Motion has a personality per direction. Calm directions never cut, burst, drop or shake.',
      'Timing is never touched by styling: cue times are identical in every look.',
    ],
  },
  turbo: {
    id: 'turbo',
    label: 'Turbo',
    tagline: 'Everything turned up, drawn on the GPU: liquid light, bloom, beat shockwaves, lens fringing.',
    renderer: 'webgl2',
    principles: [
      'Same direction language as Clean (its palette, its type, its cover treatment), amplified rather than replaced.',
      'Every layer is drawn by the graphics processor in WebGL2: backdrop, cover, type, icons, particles and the finishing pass.',
      'Intensity comes from light and motion, never from smaller or busier type: readability floors still apply.',
      'Deterministic like Clean: the same time always gives the same picture, so seeking and video export are exact.',
      'Falls back to Clean on a browser or machine without WebGL2.',
    ],
  },
};

export const isStageMode = (v: unknown): v is StageMode => v === 'clean' || v === 'turbo';
