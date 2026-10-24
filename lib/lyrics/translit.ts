// Romanising Devanagari and Tamil, and a phonetic key to compare names across scripts.
//
// Why: a Spotify track is "Kesariya" while the lyrics database may hold "केसरिया"; or the artist is "Anirudh Ravichander" there and
// "அனிருத் ரவிச்சந்தர்" here. Exact text comparison calls them different recordings. This is deliberately a LOOSE, loss-tolerant
// romanisation (long vowels collapsed, aspirates folded) used only to compare names, never to display text.

const DEV_VOWEL: Record<string, string> = { 'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee', 'उ': 'u', 'ऊ': 'oo', 'ऋ': 'ri', 'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au', 'ऑ': 'o', 'ऍ': 'e' };
const DEV_MATRA: Record<string, string> = { 'ा': 'aa', 'ि': 'i', 'ी': 'ee', 'ु': 'u', 'ू': 'oo', 'ृ': 'ri', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ॉ': 'o', 'ॅ': 'e' };
const DEV_CONS: Record<string, string> = {
  'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'n', 'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'n', 'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n', 'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
  'प': 'p', 'फ': 'f', 'ब': 'b', 'भ': 'bh', 'म': 'm', 'य': 'y', 'र': 'r', 'ल': 'l', 'ळ': 'l', 'व': 'v', 'श': 'sh', 'ष': 'sh', 'स': 's', 'ह': 'h',
  'क़': 'q', 'ख़': 'kh', 'ग़': 'g', 'ज़': 'z', 'ड़': 'r', 'ढ़': 'rh', 'फ़': 'f',
};
const DEV_SIGN: Record<string, string> = { 'ं': 'n', 'ँ': 'n', 'ः': 'h' };

const TAM_VOWEL: Record<string, string> = { 'அ': 'a', 'ஆ': 'aa', 'இ': 'i', 'ஈ': 'ee', 'உ': 'u', 'ஊ': 'oo', 'எ': 'e', 'ஏ': 'ee', 'ஐ': 'ai', 'ஒ': 'o', 'ஓ': 'oo', 'ஔ': 'au' };
const TAM_MATRA: Record<string, string> = { 'ா': 'aa', 'ி': 'i', 'ீ': 'ee', 'ு': 'u', 'ூ': 'oo', 'ெ': 'e', 'ே': 'ee', 'ை': 'ai', 'ொ': 'o', 'ோ': 'oo', 'ௌ': 'au' };
const TAM_CONS: Record<string, string> = {
  'க': 'k', 'ங': 'ng', 'ச': 's', 'ஞ': 'ny', 'ட': 't', 'ண': 'n', 'த': 'th', 'ந': 'n', 'ப': 'p', 'ம': 'm', 'ய': 'y', 'ர': 'r', 'ல': 'l', 'வ': 'v', 'ழ': 'zh', 'ள': 'l', 'ற': 'r', 'ன': 'n',
  'ஜ': 'j', 'ஷ': 'sh', 'ஸ': 's', 'ஹ': 'h',
};

const DEVC: Record<string, string> = Object.fromEntries(Object.entries(DEV_CONS).map(([k, v]) => [k.normalize('NFC'), v]));
const VIRAMA_DEV = '्';
const NUKTA = '़';
const PULLI = '்';
const AYTHAM = 'ஃ';

/** One word of Devanagari -> loose Latin. Inherent 'a' is kept inside the word and dropped at its end (Hindi schwa deletion). */
function romanizeDevanagari(word: string): string {
  const cps = Array.from(word.normalize('NFC'));
  let out = '';
  for (let i = 0; i < cps.length; i++) {
    let ch = cps[i]!;
    if (cps[i + 1] === NUKTA) {
      ch = ch + NUKTA;
      i++;
    }
    const cons = DEVC[ch.normalize('NFC')] ?? DEVC[ch[0]!];
    if (cons !== undefined) {
      out += cons;
      const next = cps[i + 1];
      if (next === VIRAMA_DEV) {
        i++; // conjunct / silent: no vowel
      } else if (next && (DEV_MATRA[next] !== undefined || next === NUKTA)) {
        // the matra that follows supplies the vowel
      } else if (i < cps.length - 1) out += 'a'; // inherent vowel, except at the end of a word
      continue;
    }
    if (DEV_VOWEL[ch] !== undefined) out += DEV_VOWEL[ch];
    else if (DEV_MATRA[ch] !== undefined) out += DEV_MATRA[ch];
    else if (DEV_SIGN[ch] !== undefined) out += DEV_SIGN[ch];
    else if (/\p{L}|\p{N}/u.test(ch)) out += ch;
  }
  return out;
}

function romanizeTamil(word: string): string {
  const cps = Array.from(word.normalize('NFC'));
  let out = '';
  for (let i = 0; i < cps.length; i++) {
    const ch = cps[i]!;
    // two-part vowel signs written as a pair in some sources
    const cons = TAM_CONS[ch];
    if (cons !== undefined) {
      out += cons;
      const next = cps[i + 1];
      if (next === PULLI) i++;
      else if (next && TAM_MATRA[next] !== undefined) {
        // supplied by the sign
      } else out += 'a';
      continue;
    }
    if (TAM_VOWEL[ch] !== undefined) out += TAM_VOWEL[ch];
    else if (TAM_MATRA[ch] !== undefined) out += TAM_MATRA[ch];
    else if (ch === AYTHAM) out += 'h';
    else if (ch === PULLI) continue;
    else if (/\p{L}|\p{N}/u.test(ch)) out += ch;
  }
  return out;
}

/** Latin text unchanged; Devanagari and Tamil words romanised (loosely). Spaces and Latin words are kept. */
export function romanize(text: string): string {
  return text
    .split(/(\s+)/)
    .map((tok) => {
      if (/[ऀ-ॿ]/.test(tok)) return romanizeDevanagari(tok);
      if (/[஀-௿]/.test(tok)) return romanizeTamil(tok);
      return tok;
    })
    .join('');
}

/**
 * A key that two spellings of the same sound tend to share: "Kesariya" / "केसरिया" / "Kesaria", "Kadhal" / "காதல்" / "Kaadhal".
 * Lower case, diacritics off, long vowels and doubled letters collapsed, aspirates folded, vowels reduced to a skeleton.
 */
export function phoneticKey(text: string): string {
  let s = romanize(text).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z\s]/g, ' ');
  s = s
    .replace(/ph/g, 'f')
    .replace(/ck|q/g, 'k')
    .replace(/x/g, 'ks')
    .replace(/zh/g, 'l')
    .replace(/([bcdfghjklmnpqrstvwxyz])h/g, '$1') // th, dh, kh, gh, bh, ch, sh -> t, d, k, g, b, c, s
    .replace(/w/g, 'v')
    .replace(/z/g, 'j')
    // Tamil script does not tell b/p, g/k, d/t apart and Latin spellings use either: fold the voicing pairs
    .replace(/b/g, 'p')
    .replace(/g/g, 'k')
    .replace(/d/g, 't')
    .replace(/j/g, 'c')
    .replace(/y(?=[aeiou])/g, 'y')
    .replace(/(.)\1+/g, '$1');
  return s
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0] + w.slice(1).replace(/[aeiouy]/g, '')) // keep the first letter, drop the other vowels
    .join(' ');
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length]!;
}

/** 0..1: how alike two names sound, across scripts. 1 = same phonetic key. */
export function soundsAlike(a: string, b: string): number {
  const ka = phoneticKey(a).replace(/\s+/g, '');
  const kb = phoneticKey(b).replace(/\s+/g, '');
  if (!ka || !kb) return 0;
  if (ka === kb) return 1;
  return 1 - levenshtein(ka, kb) / Math.max(ka.length, kb.length);
}
