// Text-side helpers for timing lyrics when only line starts (or nothing) are known.

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
  if (!/^[a-z]+$/.test(w)) return Math.max(1, Math.ceil(w.length / 2.2)); // Hangul, accented Latin, ...
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
