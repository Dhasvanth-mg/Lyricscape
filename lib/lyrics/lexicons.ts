// All non-English vocabulary in one place: Hindi and Tamil (indicLexicon.ts) plus the world languages (worldLexicon.ts).
// The mood reader, the identity text reader and the icon table all take what they need from here.

import type { EmotionId } from '../kinetic/emotion';
import type { IconId } from '../kinetic/icons';
import { INDIC_ICONS, INDIC_MOOD, INDIC_NEGATORS, INDIC_SUBJECT_STEMS, INDIC_TEXT } from './indicLexicon';
import { WORLD_ICONS, WORLD_MOOD, WORLD_NEGATORS, WORLD_SUBJECT_STEMS } from './worldLexicon';

// (own list, not imported from emotion.ts: that module imports this one, and a value import would be circular)
const EMOTIONS: EmotionId[] = ['joy', 'love', 'energy', 'calm', 'nostalgia', 'sadness', 'anger', 'dark'];

export const LEX_MOOD = Object.fromEntries(EMOTIONS.map((e) => [e, [...INDIC_MOOD[e], ...WORLD_MOOD[e]]])) as Record<EmotionId, string[]>;
export const LEX_NEGATORS: string[] = [...INDIC_NEGATORS, ...WORLD_NEGATORS];

/** identity/text.ts categories: the eight moods plus a few weak extras */
export const LEX_TEXT: Record<string, { strong: string[]; weak: string[] }> = Object.fromEntries(
  EMOTIONS.map((e) => [e, { strong: [...(INDIC_TEXT[e]?.strong ?? []), ...WORLD_MOOD[e]], weak: [...(INDIC_TEXT[e]?.weak ?? [])] }]),
);

export const LEX_SUBJECT_STEMS: Record<string, string[]> = (() => {
  const out: Record<string, string[]> = {};
  for (const src of [INDIC_SUBJECT_STEMS, WORLD_SUBJECT_STEMS]) for (const [k, v] of Object.entries(src)) (out[k] ??= []).push(...v);
  return out;
})();

export const LEX_ICONS: Record<string, IconId> = { ...INDIC_ICONS, ...WORLD_ICONS };
