// Reading evidence out of lyric TEXT.
//
// HONEST SCOPE: a lexicon finds words, not meaning. It cannot see irony, metaphor, delivery or the music underneath, so its
// output is one weak-to-moderate signal among several (build.ts) and carries a confidence that grows only with the amount
// of evidence. Choices that make it less wrong than the old mood lexicon:
//   - ambiguous everyday words (night, city, beat, drop, baby, good, yeah, fall, break, run, blue...) are not mood evidence;
//   - strong and weak stems are weighted differently;
//   - a hook repeated ten times counts once at full weight, then at a third (repetition is emphasis, not new feeling);
//   - negation weakens a hit instead of teleporting it into the opposite emotion.

import type { LyricDocument } from '../types';
import type { MotifId } from '../kinetic/emotion';

export const TEXT_CATS = ['joy', 'love', 'energy', 'calm', 'nostalgia', 'sadness', 'anger', 'dark', 'tension', 'warm', 'cold'] as const;
export type TextCat = (typeof TEXT_CATS)[number];

type Lex = { strong: string[]; weak: string[] };
const LEX: Record<TextCat, Lex> = {
  joy: { strong: ['happy', 'joy', 'smil', 'laugh', 'celebrat', 'bliss', 'wonderful', 'cheer', 'delight', 'grateful', 'blessed', 'thrill', 'euphori', 'overjoy'], weak: ['sunshin', 'danc', 'party', 'glad', 'golden', 'alive', 'summer', 'lucky', 'sweet', 'fun'] },
  love: { strong: ['love', 'adore', 'darling', 'beloved', 'devotion', 'kiss', 'romanc', 'tender', 'cherish', 'crush', 'lover', 'soulmate', 'hold me', 'want you', 'need you'], weak: ['babe', 'honey', 'heart', 'touch', 'together', 'forever', 'desire', 'angel', 'mine'] },
  energy: { strong: ['explod', 'adrenalin', 'electric', 'lightning', 'nonstop', 'turn up', 'riot', 'wild', 'rush', 'speed', 'run it up', 'banger'], weak: ['loud', 'jump', 'bounc', 'crowd', 'power', 'rise', 'fire'] },
  calm: { strong: ['calm', 'peace', 'serene', 'gentl', 'whisper', 'tranquil', 'lullaby', 'drift', 'float', 'breathe', 'hush'], weak: ['quiet', 'soft', 'slow', 'sleep', 'dream', 'ocean', 'still', 'easy', 'rest', 'silen'] },
  nostalgia: { strong: ['remember', 'nostalg', 'childhood', 'yesterday', 'used to', 'back then', 'memories', 'good old', 'photograph', 'those days', 'long ago', 'growing up'], weak: ['memor', 'faded', 'old days', 'last summer', 'once upon', 'years ago'] },
  sadness: { strong: ['cry', 'tears', 'lonely', 'heartbreak', 'broken', 'grief', 'sorrow', 'mourn', 'hurt', 'pain', 'sobbing', 'miss you', 'goodbye', 'empty', 'despair', 'regret', 'ache', 'lost without'], weak: ['alone', 'rain', 'fading', 'grey', 'gray', 'tired', 'numb', 'sorry', 'lost'] },
  anger: { strong: ['hate', 'rage', 'fury', 'furious', 'kill', 'revenge', 'scream', 'enemy', 'enemies', 'fight', 'bitter', 'curse', 'bleed', 'smash', 'liar', 'war '], weak: ['mad', 'lies', 'burn', 'shout', 'blood'] },
  dark: { strong: ['death', 'grave', 'demon', 'devil', 'ghost', 'haunt', 'void', 'abyss', 'nightmare', 'funeral', 'coffin', 'darkness'], weak: ['shadow', 'black', 'fear', 'midnight', 'sin', 'dead'] },
  tension: { strong: ['anxious', 'anxiety', 'panic', 'trembl', 'dread', 'paranoi', 'pressure', 'suffocat', "can't breathe", 'cant breathe', 'chase', 'trapped', 'nervous', 'on edge', 'sweat', 'alarm', 'scared', 'afraid', 'terrif'], weak: ['wait', 'shake', 'worry', 'hide', 'sleepless', "can't sleep", 'doubt', 'run from'] },
  warm: { strong: ['warm', 'sunlight', 'sunrise', 'cozy', 'hug', 'fireplace', 'blanket', 'honey', 'hold me', 'embrace'], weak: ['summer', 'skin', 'kiss', 'amber', 'candle', 'tender', 'gentle', 'golden'] },
  cold: { strong: ['cold', 'icy', 'frozen', 'winter', 'numb', 'frost', 'hollow', 'steel', 'empty'], weak: ['ice', 'snow', 'grey', 'gray', 'shiver', 'distance', 'alone'] },
};

type Subject = { id: string; label: string; stems: string[]; motifs: MotifId[] };
export const SUBJECTS: Subject[] = [
  { id: 'romance', label: 'romance', stems: ['love', 'kiss', 'lover', 'desire', 'tender', 'baby', 'touch', 'beautiful', 'adore'], motifs: ['heart', 'sparkle'] },
  { id: 'heartbreak', label: 'heartbreak', stems: ['heartbreak', 'broken', 'miss you', 'over you', 'goodbye', 'without you', 'leave me', 'ex ', 'cry', 'tears'], motifs: ['rain', 'cloud'] },
  { id: 'nightlife', label: 'night & city', stems: ['night', 'city', 'club', 'neon', 'street', 'lights', 'downtown', 'taxi', 'midnight', 'drive', 'bar '], motifs: ['moon', 'star', 'bolt'] },
  { id: 'ambition', label: 'ambition & status', stems: ['money', 'cash', 'rich', 'million', 'grind', 'hustle', 'crown', 'diamond', 'fame', 'empire', 'paid', 'luxury', 'top '], motifs: ['star', 'burst'] },
  { id: 'struggle', label: 'struggle', stems: ['struggle', 'survive', 'scars', 'battle', 'climb', 'overcome', 'poverty', 'pain', 'hard '], motifs: ['bolt', 'zigzag'] },
  { id: 'reflection', label: 'self-reflection', stems: ['mirror', 'myself', 'who am i', 'my mind', 'thoughts', 'therapy', 'demons', 'truth', 'honest', 'growing', 'forgive'], motifs: ['ring', 'spiral'] },
  { id: 'memory', label: 'memory & time', stems: ['remember', 'yesterday', 'childhood', 'years', 'memories', 'used to', 'growing up', 'time '], motifs: ['spiral', 'ring'] },
  { id: 'nature', label: 'sky, sea & seasons', stems: ['sky', 'ocean', 'sea ', 'mountain', 'river', 'sun', 'moon', 'stars', 'wind', 'forest', 'summer', 'winter', 'storm', 'flower', 'rain'], motifs: ['sun', 'wave', 'cloud', 'flower', 'moon'] },
  { id: 'freedom', label: 'escape & freedom', stems: ['free', 'escape', 'road', 'run away', 'fly', 'highway', 'wander', 'journey', 'somewhere', 'horizon', 'plane'], motifs: ['wave', 'star'] },
  { id: 'faith', label: 'faith & spirit', stems: ['god', 'pray', 'heaven', 'soul', 'church', 'bless', 'lord', 'spirit'], motifs: ['star', 'sun'] },
  { id: 'celebration', label: 'celebration', stems: ['party', 'dance', 'celebrate', 'tonight', 'drinks', 'dancefloor', 'turn up'], motifs: ['burst', 'sparkle'] },
  { id: 'defiance', label: 'defiance', stems: ['rebel', 'system', 'against', 'revolution', 'liar', 'lies', 'speak up', 'never bow'], motifs: ['bolt', 'flame'] },
];

const NEGATORS = new Set(['not', 'never', 'no', "don't", 'dont', "can't", 'cant', "won't", 'wont', "ain't", 'aint', 'without', 'nothing']);
const norm = (s: string) => ' ' + s.toLowerCase().replace(/[’]/g, "'").replace(/[^\p{L}\p{N}'\s]/gu, ' ').replace(/\s+/g, ' ').trim() + ' ';

type Entry = { stem: string; cat: TextCat; w: number; phrase: boolean };
const ENTRIES: Entry[] = TEXT_CATS.flatMap((cat) => [
  ...LEX[cat].strong.map((stem) => ({ stem, cat, w: 1, phrase: stem.includes(' ') })),
  ...LEX[cat].weak.map((stem) => ({ stem, cat, w: 0.4, phrase: stem.includes(' ') })),
]);
const WORD_ENTRIES = ENTRIES.filter((e) => !e.phrase);
const PHRASE_ENTRIES = ENTRIES.filter((e) => e.phrase);

/** Does token `t` carry stem `s`? Short stems must match the word (or its plural), long ones are prefixes. */
const stemHit = (t: string, s: string) => (s.length <= 4 ? t === s || t === s + 's' : t.startsWith(s));

export type TextRead = {
  words: number;
  /** effective (repetition-damped, negation-weighted) evidence mass per category */
  cat: Record<TextCat, number>;
  /** total hits across categories (a measure of how much evidence there is) */
  hits: number;
  subjects: { id: string; label: string; score: number; motifs: MotifId[] }[];
};

const zero = (): Record<TextCat, number> => Object.fromEntries(TEXT_CATS.map((c) => [c, 0])) as Record<TextCat, number>;

export function readText(doc: LyricDocument | null | undefined): TextRead | null {
  if (!doc || !doc.lines.length) return null;
  const cat = zero();
  const subj = new Map<string, number>();
  const seen = new Set<string>();
  let words = 0;
  let hits = 0;
  for (const line of doc.lines) {
    const raw = line.words.map((w) => w.text).join(' ');
    const text = norm(raw);
    const tokens = text.trim().split(' ').filter(Boolean);
    if (!tokens.length) continue;
    const key = tokens.join(' ');
    const lineW = seen.has(key) ? 0.35 : 1; // a repeated hook is emphasis, not new information
    seen.add(key);
    words += tokens.length * lineW;
    for (const e of PHRASE_ENTRIES) if (text.includes(' ' + e.stem + ' ') || text.includes(e.stem)) ((cat[e.cat] += e.w * lineW), (hits += e.w * lineW));
    tokens.forEach((t, i) => {
      const hit = WORD_ENTRIES.find((e) => stemHit(t, e.stem));
      if (!hit) return;
      const negated = NEGATORS.has(tokens[i - 1] ?? '') || NEGATORS.has(tokens[i - 2] ?? '');
      const w = hit.w * lineW * (negated ? 0.25 : 1);
      cat[hit.cat] += w;
      hits += w;
    });
    for (const s of SUBJECTS) {
      let n = 0;
      for (const stem of s.stems) if (text.includes(stem.endsWith(' ') ? ' ' + stem : ' ' + stem)) n++;
      if (n) subj.set(s.id, (subj.get(s.id) ?? 0) + Math.min(2, n) * lineW);
    }
  }
  if (words < 12) return null;
  const subjects = SUBJECTS.map((s) => ({ id: s.id, label: s.label, score: subj.get(s.id) ?? 0, motifs: s.motifs }))
    .filter((s) => s.score >= 3)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, 3);
  return { words, cat, hits, subjects };
}

/** Per-100-words rate of a category. */
export const rate = (r: TextRead, c: TextCat) => (r.cat[c] / Math.max(1, r.words)) * 100;
