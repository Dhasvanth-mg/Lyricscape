// Optional AI interpretation of a song's lyric themes, as a STRUCTURED profile.
//
// What the model is asked for: emotional dimensions it can actually judge from the text (with its own confidence), the narrative
// perspective, subjects, imagery and whether sentiment rises / falls / turns. What it is NOT asked for: artist influences,
// intentions, production details or any fact about the recording; the schema has no field for them, so they cannot enter the app.
//
// The result is one more piece of evidence in build.ts (source 'ai', confidence capped), never a controller of animation.
// It is requested only when the listener turned it on, cached per song and lyric text, and the app works without it.

import { z } from 'zod';
import { MOTIFS } from '../kinetic/emotion';
import { DIM_KEYS } from './types';

const dim = z.object({ v: z.number().min(0).max(1), conf: z.number().min(0).max(1) });

export const aiProfileSchema = z.object({
  dims: z.object(Object.fromEntries(DIM_KEYS.map((k) => [k, dim.optional()])) as Record<(typeof DIM_KEYS)[number], z.ZodOptional<typeof dim>>).partial(),
  ambiguity: dim.optional(),
  delivery: z.enum(['rapped', 'sung', 'mixed']).optional(),
  perspective: z.enum(['inward', 'addressed', 'collective', 'narrative']).optional(),
  subjects: z.array(z.string().max(40)).max(4).optional(),
  motifs: z.array(z.enum(MOTIFS)).max(4).optional(),
  imagery: z.array(z.string().max(30)).max(5).optional(),
  arc: z.enum(['steady', 'rising', 'falling', 'turning']).optional(),
  summary: z.string().max(220).optional(),
});
export type AiProfile = z.infer<typeof aiProfileSchema> & { model?: string; generatedAt?: number };

/** The model's own confidence is capped: it is reading text, not hearing music. */
export const AI_CONF_CAP = 0.7;
export const AI_MAX_LYRIC_CHARS = 2400;

export const AI_SYSTEM_PROMPT = [
  'You help a lyric visualizer choose an art direction. You are given a song title, artist, genre tags and an excerpt of the lyrics.',
  'Return ONLY one JSON object, no prose, with these optional keys:',
  '"dims": for each of valence, energy, intimacy, tension, warmth, nostalgia, melancholy, urgency, dreaminess an object {"v": 0..1, "conf": 0..1}. Omit a dimension you cannot judge from the text.',
  '"ambiguity": {"v","conf"} high when the lyrics mix or contradict feelings. "delivery": rapped|sung|mixed. "perspective": inward|addressed|collective|narrative.',
  '"subjects": up to 4 short phrases. "motifs": up to 4 of ' + MOTIFS.join(', ') + '. "imagery": up to 5 concrete images in the text. "arc": steady|rising|falling|turning. "summary": one short sentence about the lyrics.',
  'Judge only the words you are shown. Do NOT state facts about the artist, their influences, intentions, the production or how the recording sounds. If unsure, omit the key. Lower conf when the text is short or ambiguous.',
].join('\n');

export type AiRequest = { title: string; artist: string; tags: string[]; lyrics: string };

export function buildAiMessages(r: AiRequest): { role: 'system' | 'user'; content: string }[] {
  const excerpt = r.lyrics.slice(0, AI_MAX_LYRIC_CHARS);
  return [
    { role: 'system', content: AI_SYSTEM_PROMPT },
    { role: 'user', content: `Title: ${r.title}\nArtist: ${r.artist}\nGenre tags: ${r.tags.join(', ') || 'none'}\nLyrics excerpt:\n${excerpt}` },
  ];
}

/** Pull the first JSON object out of a reply (models sometimes wrap it in a code fence), validate it, cap its confidence. */
export function parseAiResponse(text: string, model?: string): AiProfile | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  const parsed = aiProfileSchema.safeParse(raw);
  if (!parsed.success) return null;
  const p = parsed.data;
  const cap = <T extends { conf: number }>(d: T | undefined) => (d ? { ...d, conf: Math.min(AI_CONF_CAP, d.conf) } : d);
  const dims = Object.fromEntries(Object.entries(p.dims ?? {}).map(([k, d]) => [k, cap(d)])) as AiProfile['dims'];
  return { ...p, dims, ambiguity: cap(p.ambiguity), model, generatedAt: Date.now() };
}

/** Cache key: the same lyric text and metadata give the same stored answer. */
export function aiCacheKey(trackId: string, lyrics: string, model: string): string {
  let h = 2166136261;
  for (let i = 0; i < lyrics.length; i++) h = Math.imul(h ^ lyrics.charCodeAt(i), 16777619);
  return `identity-ai:v1:${trackId}:${(h >>> 0).toString(36)}:${model}`;
}
