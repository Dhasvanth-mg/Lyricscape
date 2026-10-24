// Facts that can be counted in the lyric text (and its timing): pace, repetition, who is speaking to whom.

import type { LyricDocument } from '../types';
import type { LyricStats, Perspective } from './types';

/** Words per second over the time lines are actually on screen: a delivery-speed signal that works without any audio. */
export function lyricsPace(doc: LyricDocument | null | undefined): number | undefined {
  if (!doc || doc.lines.length < 4) return undefined;
  // pasted plain text is spread evenly over the song: its "pace" is an artefact of the spreading, not a delivery speed
  if (doc.timing?.source === 'plain' || doc.source === 'plain') return undefined;
  let words = 0;
  let ms = 0;
  doc.lines.forEach((l, i) => {
    const next = doc.lines[i + 1];
    // Lines followed by a long break (or the last line) say nothing about delivery speed: the gap is a pause, not slow singing.
    if (!next || next.startMs - l.startMs > 8000) return;
    const span = Math.min(l.endMs - l.startMs, next.startMs - l.startMs, 6000);
    if (span > 0) {
      words += l.words.length;
      ms += span;
    }
  });
  return ms > 4000 ? words / (ms / 1000) : undefined;
}

const FIRST = new Set(['i', "i'm", 'im', "i'll", "i've", "i'd", 'me', 'my', 'mine', 'myself']);
const SECOND = new Set(['you', "you're", 'youre', "you'll", "you've", "you'd", 'your', 'yours', 'u', 'ya']);
const PLURAL = new Set(['we', "we're", "we'll", "we've", 'us', 'our', 'ours', 'everybody', 'everyone', "y'all", 'yall']);
const THIRD = new Set(['he', 'she', 'they', 'him', 'her', 'them', 'his', 'hers', 'their', "he's", "she's", "they're"]);
const PAST = new Set(['was', 'were', 'had', 'did', 'said', 'told', 'went', 'came', 'got', 'saw', 'knew', 'thought', 'felt', 'took', 'made', 'left', 'gave', 'found', 'heard', 'wanted', 'used']);

const tokenize = (s: string) => s.toLowerCase().replace(/[’]/g, "'").replace(/[^\p{L}\p{N}'\s]/gu, ' ').split(/\s+/).filter(Boolean);

export function lyricStats(doc: LyricDocument | null | undefined): LyricStats | null {
  if (!doc || doc.lines.length < 3) return null;
  const seen = new Set<string>();
  let repeats = 0;
  let words = 0;
  let first = 0;
  let second = 0;
  let plural = 0;
  let third = 0;
  let past = 0;
  let q = 0;
  let ex = 0;
  for (const l of doc.lines) {
    const text = l.words.map((w) => w.text).join(' ');
    const key = tokenize(text).join(' ');
    if (!key) continue;
    if (seen.has(key)) repeats++;
    else seen.add(key);
    if (/\?/.test(text)) q++;
    if (/!/.test(text)) ex++;
    for (const t of tokenize(text)) {
      words++;
      if (FIRST.has(t)) first++;
      else if (SECOND.has(t)) second++;
      else if (PLURAL.has(t)) plural++;
      else if (THIRD.has(t)) third++;
      if (PAST.has(t) || (t.length > 4 && t.endsWith('ed'))) past++;
    }
  }
  if (words < 20) return null;
  const n = doc.lines.length;
  const r = (x: number) => x / words;
  const stats = {
    lines: n,
    words,
    pace: lyricsPace(doc),
    repetition: repeats / n,
    avgWordsPerLine: words / n,
    firstPerson: r(first),
    secondPerson: r(second),
    plural: r(plural),
    thirdPerson: r(third),
    pastTense: r(past),
    questions: q / n,
    exclaims: ex / n,
  };
  const narrativity = Math.min(1, Math.max(0, (stats.avgWordsPerLine - 5.5) / 5) * 0.4 + (1 - Math.min(1, stats.repetition * 3)) * 0.25 + Math.min(1, stats.pastTense * 9) * 0.25 + Math.min(1, stats.thirdPerson * 12) * 0.1);
  let perspective: Perspective = 'unknown';
  if (stats.plural > 0.035 && stats.plural >= stats.firstPerson * 0.6) perspective = 'collective';
  else if (narrativity > 0.55 && stats.thirdPerson > 0.012) perspective = 'narrative';
  else if (stats.secondPerson > stats.firstPerson * 0.8 && stats.secondPerson > 0.04) perspective = 'addressed';
  else if (stats.firstPerson > 0.05) perspective = 'inward';
  return { ...stats, narrativity, perspective };
}
