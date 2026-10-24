// Text-side helpers for timing lyrics when only line starts (or nothing) are known.

import { HAN, HANGUL, KANA, THAI } from './script';

const SMALL_KANA = /[ぁぃぅぇぉゃゅょゎァィゥェォャュョヮ]/;
const UNSPACED = /[\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\u0E00-\u0E7F]{5,}/;

/**
 * Split lyric text into words. Whitespace separates words, except in scripts that are written WITHOUT spaces (Japanese, Chinese, Thai):
 * a long unspaced run there would be one enormous "word", so it is cut into real words with the browser's own segmenter (ICU).
 * Falls back to short runs of characters where the segmenter is missing.
 */
export function tokenize(text: string): string[] {
  const out: string[] = [];
  for (const tok of text.trim().split(/\s+/).filter(Boolean)) {
    if (!UNSPACED.test(tok)) {
      out.push(tok);
      continue;
    }
    const lang = KANA.test(tok) ? 'ja' : HAN.test(tok) ? 'zh' : 'th';
    let parts: string[] = [];
    if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
      try {
        const seg = new Intl.Segmenter(lang, { granularity: 'word' });
        for (const s of seg.segment(tok)) parts.push(s.segment);
      } catch {
        parts = [];
      }
    }
    if (!parts.length) parts = Array.from(tok.match(/.{1,3}/gu) ?? [tok]);
    // punctuation travels with the word before it; words that are only particles stay attached too (a 1-character word is a poor unit)
    const merged: string[] = [];
    for (const p of parts) {
      const pure = /^[\p{P}\p{S}]+$/u.test(p);
      if (pure && merged.length) merged[merged.length - 1] += p;
      else if (merged.length && Array.from(merged[merged.length - 1]!).length === 1 && Array.from(p).length === 1 && lang !== 'th') merged[merged.length - 1] += p;
      else merged.push(p);
    }
    out.push(...merged);
  }
  return out;
}

/** Rough syllable count; good enough to apportion time (English-ish, falls back to length for other scripts). */
export function syllables(word: string): number {
  const w = word.toLowerCase().replace(/[^\p{L}\p{M}]/gu, '');
  if (!w) return 0.5;
  if (/[ऀ-ॿ஀-௿]/.test(w)) {
    // Devanagari / Tamil: every consonant or independent vowel starts a syllable (an akshara), except a consonant that carries a
    // virama / pulli (it closes the syllable before it, or opens a conjunct whose last consonant carries the vowel).
    let n = 0;
    const cps = Array.from(w);
    for (let i = 0; i < cps.length; i++) if (/\p{L}/u.test(cps[i]!) && cps[i + 1] !== '्' && cps[i + 1] !== '்') n++;
    return Math.max(1, n);
  }
  if (HANGUL.test(w) || KANA.test(w) || HAN.test(w)) {
    // Korean: one syllable block per character. Japanese: one mora per kana (small ya/yu/yo/tsu join the one before). Chinese / kanji: one per character.
    let n = 0;
    for (const c of w) {
      if (SMALL_KANA.test(c) || c === 'ー' || c === 'っ' || c === 'ッ') continue;
      n++;
    }
    return Math.max(1, n);
  }
  if (THAI.test(w)) return Math.max(1, Math.round(Array.from(w).filter((c) => !/\p{M}/u.test(c)).length / 2.2));
  if (/[\u0400-\u04FF]/.test(w)) return Math.max(1, (w.match(/[аеёиоуыэюяіїє]/g) ?? []).length);
  if (/[\u0600-\u06FF\u0590-\u05FF]/.test(w)) return Math.max(1, Math.round(Array.from(w).filter((c) => !/\p{M}/u.test(c)).length / 2.2));
  if (!/^[a-z]+$/.test(w)) return Math.max(1, Math.ceil(w.length / 2.2)); // accented Latin, Greek, ...
  let groups = (w.match(/[aeiouy]+/g) ?? []).length;
  if (groups > 1 && /[^aeiouy]e$/.test(w) && !/[^aeiouy]le$/.test(w)) groups--; // silent e
  if (groups > 1 && /ed$/.test(w) && !/[td]ed$/.test(w)) groups--; // "walked"
  return Math.max(1, groups);
}

/** Time weight of a word inside a line: its syllables, plus a small breath after punctuation. */
export const wordWeight = (word: string): number => syllables(word) + (/[,;:.!?…]$/.test(word) ? 0.3 : 0);

/**
 * Pace-aware spread for line-synced lyrics: how much of the gap before the next line is actually SUNG, by how fast the
 * line is delivered (gap per word). Singing fills almost all of a fast line's gap and only about half of a very slow one's
 * (pauses, held notes, instrumental tails). Fitted on 20 human-annotated songs by minimising word-onset error with a word
 * that appears EARLY counted twice as bad as one that is a little late (tools/sync-report/ab/estimator_study.ts, E8);
 * with every song scored on parameters fitted on the other 19 it beat the previous fixed 650 ms-per-word cap:
 * within 200 ms 52.6 % vs 46.5 %, words more than 300 ms late 24.4 % vs 36.5 %. It is an estimate, not timing.
 */
const PACE_MIDS = [200, 425, 600, 850, 1250, 2200];
const PACE_SHARE = [1.0, 0.85, 0.85, 0.7, 0.55, 0.5];
export function sungShareOfGap(gapPerWordMs: number): number {
  if (gapPerWordMs <= PACE_MIDS[0]!) return PACE_SHARE[0]!;
  for (let i = 1; i < PACE_MIDS.length; i++) {
    if (gapPerWordMs <= PACE_MIDS[i]!) return PACE_SHARE[i - 1]! + ((PACE_SHARE[i]! - PACE_SHARE[i - 1]!) * (gapPerWordMs - PACE_MIDS[i - 1]!)) / (PACE_MIDS[i]! - PACE_MIDS[i - 1]!);
  }
  return PACE_SHARE[PACE_SHARE.length - 1]!;
}

/** How long a line takes to sing at a typical pace (used to stop words stretching across an instrumental gap). */
export function expectedSungMs(tokens: string[]): number {
  const syl = tokens.reduce((a, w) => a + syllables(w), 0);
  return Math.round(syl * 300 + 350);
}

const SECTION = /^\s*[[(]\s*(intro|verse|chorus|pre-?chorus|hook|bridge|outro|refrain|interlude|instrumental|solo|break|post-?chorus|drop)\b[^\])]*[\])]\s*:?\s*$/i;
const SECTION_PLAIN = /^\s*(intro|verse|chorus|pre-?chorus|hook|bridge|outro|refrain|interlude)(\s+\d+)?\s*:\s*$/i;

/** Pasted lyric sheet -> clean rows: [Chorus] / "Verse 2:" headers and "(x2)" markers removed, blank rows dropped. */
export function cleanLyricRows(text: string): { rows: string[]; stanzaBefore: boolean[] } {
  const rows: string[] = [];
  const stanzaBefore: boolean[] = [];
  let pendingBreak = false;
  for (const raw of text.replace(/\r/g, '').split('\n')) {
    const t = raw.trim();
    if (!t) {
      pendingBreak = true;
      continue;
    }
    if (SECTION.test(t) || SECTION_PLAIN.test(t)) {
      pendingBreak = true;
      continue;
    }
    const row = t.replace(/\s*[[(]\s*x\s*\d+\s*[\])]\s*$/i, '').replace(/\s+/g, ' ').trim();
    if (!row) continue;
    rows.push(row);
    stanzaBefore.push(pendingBreak && rows.length > 1);
    pendingBreak = false;
  }
  return { rows, stanzaBefore };
}
