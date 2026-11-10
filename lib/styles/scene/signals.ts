// What a song offers the scene planner to match against scene-family signals ("calm", "night", "grief", "rap"): its mood
// estimate, the words of its lyrics, and the density of its lines. Every tag here is an estimate or a plain lyric word; none is
// presented as a measurement. Genre tags are passed in when the identity layer has them (they come from Spotify, MusicBrainz or
// the file); without them the planner simply matches less.

import type { VisualTimeline } from '../../kinetic/types';

export type SongSignals = {
  /** words that can match a scene family's signals */
  tags: Set<string>;
  /** -1..1 and 0..1 mood estimate (lyrics and tempo heuristics), or null when there is none */
  valence: number | null;
  arousal: number | null;
  /** the dark register (grief, anger, loss) applies: cute drawings and cute colour sets are excluded (invalid-combination tables) */
  dark: boolean;
  /** mean words per line */
  density: number;
  /** words of every line, lower-cased, for per-line lexicon matches */
  lineWords: string[][];
};

/** Synonyms so a lyric word can meet a scene-family keyword ("tears" meets "grief"). Small on purpose: no guessing beyond these. */
const LEXICON: Record<string, string[]> = {
  night: ['night', 'midnight', 'moon', 'dark', 'stars', 'tonight', 'nights'],
  city: ['city', 'street', 'streets', 'downtown', 'neon', 'traffic', 'avenue'],
  love: ['love', 'heart', 'kiss', 'darling', 'baby', 'lover', 'yours'],
  home: ['home', 'house', 'room', 'kitchen', 'bed', 'window', 'door'],
  rain: ['rain', 'raining', 'storm', 'umbrella', 'wet'],
  grief: ['gone', 'goodbye', 'tears', 'cry', 'crying', 'funeral', 'lost', 'miss', 'grave', 'mourning'],
  memory: ['remember', 'memory', 'memories', 'yesterday', 'used', 'back', 'old'],
  space: ['space', 'stars', 'planet', 'moon', 'orbit', 'galaxy', 'sky', 'heaven'],
  travel: ['road', 'train', 'leaving', 'leave', 'flight', 'highway', 'station', 'miles'],
  nature: ['river', 'sea', 'ocean', 'tree', 'forest', 'mountain', 'flower', 'wind'],
  fire: ['fire', 'burn', 'burning', 'flame', 'flames'],
  dance: ['dance', 'dancing', 'move', 'floor', 'party'],
};
const SYN = new Map<string, string[]>();
for (const [k, vs] of Object.entries(LEXICON)) for (const v of vs) SYN.set(v, [...(SYN.get(v) ?? []), k]);

const norm = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{M}\p{N}'-]/gu, '');

export function songSignals(tl: Pick<VisualTimeline, 'scenes' | 'emotion'>, extra: { genres?: string[] } = {}): SongSignals {
  const tags = new Set<string>();
  const lineWords = tl.scenes.map((s) => s.words.map((w) => norm(w.text)).filter(Boolean));
  const counts = new Map<string, number>();
  for (const ws of lineWords)
    for (const w of ws) {
      for (const k of SYN.get(w) ?? []) counts.set(k, (counts.get(k) ?? 0) + 1);
      if (w.length > 3) counts.set(w, (counts.get(w) ?? 0) + 1);
    }
  // a theme needs at least two mentions to count as a subject of the song
  for (const [k, n] of counts) if (n >= 2) tags.add(k);
  const m = tl.emotion?.overall;
  const valence = m && m.confidence > 0 ? m.valence : null;
  const arousal = m && m.confidence > 0 ? m.arousal : null;
  if (m && m.confidence > 0) {
    tags.add(m.emotion);
    if (m.emotion === 'sadness') tags.add('grief').add('melancholy');
    if (m.emotion === 'anger') tags.add('angry').add('protest');
    if (m.emotion === 'energy') tags.add('energetic').add('hype');
    if (m.emotion === 'calm') tags.add('dreamy').add('quiet');
    if (m.emotion === 'love') tags.add('romance');
    if (arousal !== null && arousal >= 0.62) tags.add('energy').add('high');
    if (arousal !== null && arousal <= 0.3) tags.add('calm').add('quiet');
    if (valence !== null && valence <= -0.35) tags.add('dark');
  }
  for (const g of extra.genres ?? []) tags.add(g.toLowerCase());
  const words = lineWords.reduce((a, l) => a + l.length, 0);
  const density = tl.scenes.length ? words / tl.scenes.length : 0;
  if (density >= 9) tags.add('dense');
  const dark = !!m && m.confidence > 0 && (m.emotion === 'sadness' || m.emotion === 'anger' || m.emotion === 'dark') && (valence ?? 0) < -0.2;
  return { tags, valence, arousal, dark, density, lineWords };
}

/** 0..1: how much of a scene family's signal list this song offers. */
export function signalMatch(signals: string[], song: SongSignals): number {
  if (!signals.length) return 0;
  let hit = 0;
  for (const s of signals) if (song.tags.has(s)) hit++;
  return Math.min(1, hit / Math.min(3, signals.length));
}
