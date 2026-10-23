// Text-side helpers for timing lyrics when only line starts (or nothing) are known.

/** Rough syllable count; good enough to apportion time (English-ish, falls back to length for other scripts). */
export function syllables(word: string): number {
  const w = word.toLowerCase().replace(/[^\p{L}]/gu, '');
  if (!w) return 0.5;
  if (!/^[a-z]+$/.test(w)) return Math.max(1, Math.ceil(w.length / 2.2)); // Devanagari, Hangul, accented Latin, ...
  let groups = (w.match(/[aeiouy]+/g) ?? []).length;
  if (groups > 1 && /[^aeiouy]e$/.test(w) && !/[^aeiouy]le$/.test(w)) groups--; // silent e
  if (groups > 1 && /ed$/.test(w) && !/[td]ed$/.test(w)) groups--; // "walked"
  return Math.max(1, groups);
}

/** Time weight of a word inside a line: its syllables, plus a small breath after punctuation. */
export const wordWeight = (word: string): number => syllables(word) + (/[,;:.!?…]$/.test(word) ? 0.3 : 0);

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
