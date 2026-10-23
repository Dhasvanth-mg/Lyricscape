// Mood detection for the visualizer.
//
// HONEST SCOPE: this is a transparent lexicon + tempo heuristic, not a machine-learning model.
// It reads (1) the words of the lyrics and (2) the tempo when we know it (demo / imported audio).
// Spotify gives us no audio features, so for Spotify tracks the mood comes from lyrics alone.
// Moods only choose colors, emoji and doodles. They never decide anything about the listener.

import type { LyricDocument } from '../types';
import { hexToRgb } from './util';

export const EMOTIONS = ['joy', 'love', 'energy', 'calm', 'nostalgia', 'sadness', 'anger', 'dark'] as const;
export type EmotionId = (typeof EMOTIONS)[number];

export const MOTIFS = ['sparkle', 'heart', 'star', 'bolt', 'ring', 'wave', 'cloud', 'sun', 'rain', 'flame', 'spiral', 'zigzag', 'burst', 'flower', 'moon', 'note', 'blob', 'squiggle'] as const;
export type MotifId = (typeof MOTIFS)[number];

export type EmotionDef = {
  id: EmotionId;
  label: string;
  emoji: string;
  /** emoji that float around in this mood */
  emojiSet: string[];
  /** [accent1, accent2, accent3, dark] — original palettes */
  palette: [string, string, string, string];
  motifs: MotifId[];
  valence: number; // -1 (negative) .. 1 (positive)
  arousal: number; // 0 (still) .. 1 (intense)
};

export const EMOTION_DEFS: Record<EmotionId, EmotionDef> = {
  joy: { id: 'joy', label: 'Joyful', emoji: '😄', emojiSet: ['😄', '✨', '🌞', '🎉', '🌈'], palette: ['#ffb703', '#fb5607', '#ff006e', '#26123d'], motifs: ['sun', 'sparkle', 'star', 'burst', 'flower'], valence: 0.8, arousal: 0.7 },
  love: { id: 'love', label: 'Romantic', emoji: '😍', emojiSet: ['❤️', '💖', '😍', '🌹', '💘'], palette: ['#ff4d8d', '#ff9bb3', '#ffd6e0', '#2a0a1e'], motifs: ['heart', 'sparkle', 'ring', 'flower', 'star'], valence: 0.8, arousal: 0.4 },
  energy: { id: 'energy', label: 'Hyped', emoji: '🔥', emojiSet: ['🔥', '⚡', '💃', '🕺', '🚀'], palette: ['#ff2bd6', '#00e5ff', '#c6ff00', '#0c0220'], motifs: ['bolt', 'star', 'zigzag', 'burst', 'spiral'], valence: 0.6, arousal: 0.95 },
  calm: { id: 'calm', label: 'Dreamy', emoji: '🌙', emojiSet: ['🌙', '🌊', '🍃', '☁️', '🕊️'], palette: ['#4cc9f0', '#80ed99', '#c8f7e4', '#07212b'], motifs: ['wave', 'cloud', 'ring', 'moon', 'flower'], valence: 0.4, arousal: 0.15 },
  nostalgia: { id: 'nostalgia', label: 'Nostalgic', emoji: '📼', emojiSet: ['📼', '🌅', '📷', '🍂', '🎞️'], palette: ['#e9a23b', '#d4745e', '#f4d8a8', '#2a1810'], motifs: ['sun', 'spiral', 'ring', 'flower', 'squiggle'], valence: 0.3, arousal: 0.3 },
  sadness: { id: 'sadness', label: 'Melancholy', emoji: '😢', emojiSet: ['😢', '🌧️', '💔', '🥀', '🌑'], palette: ['#5a7bd8', '#8f9bd6', '#b8c4ee', '#0b1030'], motifs: ['rain', 'cloud', 'wave', 'moon', 'squiggle'], valence: -0.7, arousal: 0.2 },
  anger: { id: 'anger', label: 'Intense', emoji: '😤', emojiSet: ['😤', '🔥', '💢', '⚡', '🖤'], palette: ['#ff1f1f', '#ff7a00', '#ffd000', '#1a0505'], motifs: ['bolt', 'flame', 'burst', 'zigzag', 'star'], valence: -0.7, arousal: 0.9 },
  dark: { id: 'dark', label: 'Moody', emoji: '🌑', emojiSet: ['🌑', '🦇', '👁️', '🕯️', '🖤'], palette: ['#9d4edd', '#ff4d9d', '#e0aaff', '#0d0221'], motifs: ['moon', 'spiral', 'star', 'zigzag', 'blob'], valence: -0.5, arousal: 0.5 },
};

// ---------------------------------------------------------------------------
// Lexicon (word stems -> emotion). Small and readable on purpose; extend freely.
// ---------------------------------------------------------------------------
const LEXICON: Record<EmotionId, string[]> = {
  joy: ['happy', 'joy', 'smil', 'laugh', 'sunshin', 'sun', 'bright', 'celebrat', 'party', 'danc', 'fun', 'glad', 'shin', 'golden', 'bliss', 'beautiful', 'wonderful', 'alive', 'free', 'win', 'spark', 'rainbow', 'summer', 'cheer', 'good', 'great', 'yeah', 'hooray', 'sweet', 'lucky'],
  love: ['love', 'heart', 'kiss', 'darling', 'babe', 'baby', 'honey', 'desire', 'together', 'romanc', 'forever', 'mine', 'adore', 'tender', 'touch', 'angel', 'beloved', 'crush', 'lover', 'hold me', 'embrace', 'cuddl'],
  energy: ['fire', 'run', 'fast', 'jump', 'loud', 'wild', 'rush', 'electric', 'lightning', 'move', 'power', 'rise', 'ride', 'speed', 'nonstop', 'bounce', 'explod', 'neon', 'static', 'signal', 'turn up', 'crowd', 'beat', 'drop', 'wire', 'city', 'night'],
  calm: ['calm', 'quiet', 'soft', 'slow', 'gentl', 'breath', 'sleep', 'dream', 'peace', 'still', 'ocean', 'sea', 'drift', 'float', 'easy', 'rest', 'sky', 'cloud', 'whisper', 'silen', 'planet', 'paper', 'orbit', 'tape', 'wall', 'wings', 'fold'],
  nostalgia: ['remember', 'yesterday', 'memor', 'old', 'once', 'home', 'childhood', 'used to', 'gone', 'past', 'years', 'remind', 'photograph', 'faded', 'echo', 'again', 'back then', 'hours', 'pieces'],
  sadness: ['cry', 'tear', 'alone', 'lonely', 'sad', 'broken', 'hurt', 'pain', 'miss', 'lost', 'goodbye', 'rain', 'empty', 'fall', 'fading', 'sorrow', 'grey', 'gray', 'blue', 'ache', 'shatter', 'glass', 'regret', 'wound'],
  anger: ['hate', 'angry', 'rage', 'fight', 'war', 'scream', 'kill', 'hell', 'damn', 'enemy', 'lies', 'break', 'shake', 'chain', 'mad', 'revenge', 'bleed', 'burn', 'smash'],
  dark: ['dark', 'shadow', 'black', 'death', 'ghost', 'devil', 'demon', 'void', 'cold', 'fear', 'haunt', 'midnight', 'grave', 'blood', 'moon', 'dead', 'sin', 'abyss'],
};
const NEGATORS = new Set(['not', 'never', 'no', "don't", 'dont', "can't", 'cant', "won't", 'wont', "ain't", 'aint', 'without', 'nothing']);
/** "not happy" leans sad, "never alone" leans joy. */
const FLIP: Record<EmotionId, EmotionId> = { joy: 'sadness', love: 'sadness', energy: 'calm', calm: 'energy', nostalgia: 'joy', sadness: 'joy', anger: 'calm', dark: 'joy' };

type Entry = { stem: string; emotion: EmotionId };
const ENTRIES: Entry[] = Object.entries(LEXICON).flatMap(([emotion, stems]) => stems.map((stem) => ({ stem, emotion: emotion as EmotionId })));
const SINGLE = ENTRIES.filter((e) => !e.stem.includes(' '));
const PHRASES = ENTRIES.filter((e) => e.stem.includes(' '));

const norm = (s: string) => s.toLowerCase().replace(/[’]/g, "'").replace(/[^\p{L}\p{N}'\s]/gu, ' ');

export type Scores = Record<EmotionId, number>;
const zero = (): Scores => ({ joy: 0, love: 0, energy: 0, calm: 0, nostalgia: 0, sadness: 0, anger: 0, dark: 0 });

/** Emotion evidence in a piece of text. Negation flips the next lexicon hit. */
export function scoreText(text: string): Scores {
  const out = zero();
  const t = norm(text);
  for (const p of PHRASES) if (t.includes(p.stem)) out[p.emotion] += 1;
  const words = t.split(/\s+/).filter(Boolean);
  words.forEach((w, i) => {
    const hit = SINGLE.find((e) => (e.stem.length <= 3 ? w === e.stem || w === e.stem + 's' : w.startsWith(e.stem)));
    if (!hit) return;
    const negated = NEGATORS.has(words[i - 1] ?? '') || NEGATORS.has(words[i - 2] ?? '');
    out[negated ? FLIP[hit.emotion] : hit.emotion] += 1;
  });
  return out;
}

const addScores = (a: Scores, b: Scores, k = 1) => {
  for (const e of EMOTIONS) a[e] += b[e] * k;
  return a;
};
const top = (s: Scores): { id: EmotionId; value: number } => {
  let best: EmotionId = 'joy';
  let v = -1;
  for (const e of EMOTIONS) if (s[e] > v) ((v = s[e]), (best = e));
  return { id: best, value: v };
};

/** Tempo prior: when the lyrics say little, the groove still has a feeling. */
export function tempoPrior(bpm?: number): Scores {
  const s = zero();
  if (!bpm) return s;
  if (bpm >= 125) s.energy += 1.2;
  else if (bpm >= 108) s.joy += 0.9;
  else if (bpm >= 92) s.nostalgia += 0.5;
  else if (bpm >= 76) s.calm += 0.7;
  else s.sadness += 0.6;
  return s;
}

export type Mood = { emotion: EmotionId; valence: number; arousal: number; confidence: number };
export type MoodAnalysis = {
  overall: Mood;
  /** one entry per lyric line, smoothed so the mood changes feel like phrases, not flicker */
  perLine: Mood[];
  scores: Scores;
  /** how we got there, for the UI ("from lyrics + tempo") */
  basis: 'lyrics' | 'tempo' | 'lyrics+tempo' | 'none';
};

const moodOf = (emotion: EmotionId, confidence: number): Mood => ({ emotion, valence: EMOTION_DEFS[emotion].valence, arousal: EMOTION_DEFS[emotion].arousal, confidence: Math.round(confidence * 100) / 100 });

export function analyzeEmotion(doc: LyricDocument | null, opts: { bpm?: number } = {}): MoodAnalysis {
  const lineScores = (doc?.lines ?? []).map((l) => scoreText(l.words.map((w) => w.text).join(' ')));
  const total = zero();
  for (const s of lineScores) addScores(total, s);
  const lyricMass = EMOTIONS.reduce((a, e) => a + total[e], 0);
  const prior = tempoPrior(opts.bpm);
  const combined = addScores(addScores(zero(), total), prior, lyricMass > 0 ? Math.max(0.6, lyricMass * 0.08) : 1);
  const priorMass = EMOTIONS.reduce((a, e) => a + prior[e], 0);
  const basis: MoodAnalysis['basis'] = lyricMass > 0 && priorMass > 0 ? 'lyrics+tempo' : lyricMass > 0 ? 'lyrics' : priorMass > 0 ? 'tempo' : 'none';
  const sum = EMOTIONS.reduce((a, e) => a + combined[e], 0);
  const best = top(combined);
  const overall = sum > 0 ? moodOf(best.id, best.value / sum) : moodOf('calm', 0);

  // per-line mood: own evidence, 30% memory of the previous line, falls back to the song's mood
  const perLine: Mood[] = [];
  let carry = zero();
  for (const s of lineScores) {
    const mass = EMOTIONS.reduce((a, e) => a + s[e], 0);
    const mixed = addScores(addScores(zero(), s), carry, 0.3);
    const m = EMOTIONS.reduce((a, e) => a + mixed[e], 0);
    const t = top(mixed);
    perLine.push(m > 0.2 && mass > 0 ? moodOf(t.id, t.value / m) : m > 0.2 ? moodOf(t.id, (t.value / m) * 0.6) : { ...overall, confidence: overall.confidence * 0.5 });
    carry = mixed;
  }
  return { overall, perLine, scores: combined, basis };
}

/** User picked a mood by hand: every line gets it. */
export function overrideMood(a: MoodAnalysis, emotion: EmotionId): MoodAnalysis {
  const m = moodOf(emotion, 1);
  return { ...a, overall: m, perLine: a.perLine.map(() => m), basis: 'none' };
}

// ---------------------------------------------------------------------------
// Words -> emoji
// ---------------------------------------------------------------------------
const WORD_EMOJI: Record<string, string> = {
  love: '❤️', heart: '💖', kiss: '💋', fire: '🔥', burn: '🔥', sun: '☀️', sunshine: '🌞', star: '⭐', stars: '✨', moon: '🌙', night: '🌃', midnight: '🌌', rain: '🌧️',
  cry: '😢', tears: '💧', tear: '💧', smile: '😊', laugh: '😂', dance: '💃', dancing: '💃', party: '🎉', dream: '💭', dreams: '💭', sky: '🌤️', cloud: '☁️', ocean: '🌊', sea: '🌊', wave: '🌊',
  light: '💡', lights: '✨', glass: '🥂', run: '🏃', fast: '⚡', lightning: '⚡', neon: '🌆', static: '📺', signal: '📡', city: '🏙️', chains: '⛓️', paper: '📄', planet: '🪐', planets: '🪐',
  fly: '🕊️', wings: '🪽', flower: '🌸', flowers: '🌸', summer: '🏖️', home: '🏠', gold: '✨', golden: '✨', free: '🕊️', ghost: '👻', dark: '🌑', shadow: '🌑', heaven: '😇', angel: '😇',
  money: '💸', road: '🛣️', car: '🚗', eyes: '👀', hands: '🙌', music: '🎵', sing: '🎤', song: '🎶', guitar: '🎸', time: '⏳', hours: '⏳', hour: '⏳', clock: '⏰', broken: '💔', break: '💔',
  fall: '🍂', wind: '🍃', snow: '❄️', ice: '🧊', storm: '⛈️', thunder: '⚡', boom: '💥', crown: '👑', diamond: '💎', hold: '🤝', catch: '🫳', hit: '💥', red: '🔴', blue: '🔵', electric: '⚡',
  tape: '📼', wall: '🧱', skies: '🌤️', orbit: '🪐', alone: '🫥', pieces: '🧩', fade: '🌫️', white: '🤍', black: '🖤',
};

export function emojiForWord(word: string): string | null {
  const w = word.toLowerCase().replace(/[^\p{L}']/gu, '');
  return WORD_EMOJI[w] ?? null;
}

// ---------------------------------------------------------------------------
// Palettes
// ---------------------------------------------------------------------------
export type ColorMode = 'blend' | 'album' | 'emotion';

/** Perceptually-ish distance between two hex colors (weighted RGB). */
export function colorDistance(a: string, b: string): number {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const rm = (r1 + r2) / 2;
  return Math.sqrt((2 + rm / 256) * (r1 - r2) ** 2 + 4 * (g1 - g2) ** 2 + (2 + (255 - rm) / 256) * (b1 - b2) ** 2);
}
