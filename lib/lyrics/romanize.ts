// Display romanisation of Hindi (Devanagari) and Tamil lyrics: the casual spelling people use when they type lyrics in Latin
// letters ("tera", "zindagi", "kaadhal", "nenjam"), so a listener who cannot read the script can sing along.
//
// HONEST SCOPE: a rule-based spelling, not a dictionary. Hindi drops the inherent "a" only at the end of a word (Hindi also drops
// some in the middle, "dhadkan" comes out "dhadakan"); Tamil voices k/s/t/th/p from their position (after a nasal, between vowels),
// which matches most words but not loanwords. It needs checking by native readers before it is called right (docs/visuals.md T4).
// It never changes the lyrics or their timing: it is a second line under them. (lib/lyrics/translit.ts is a different, lossy
// romanisation used only to compare names.)

const DEV_VOWEL: Record<string, string> = { 'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee', 'उ': 'u', 'ऊ': 'oo', 'ऋ': 'ri', 'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au', 'ऑ': 'o', 'ऍ': 'e' };
const DEV_SIGN: Record<string, string> = { 'ा': 'aa', 'ि': 'i', 'ी': 'ee', 'ु': 'u', 'ू': 'oo', 'ृ': 'ri', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ॉ': 'o', 'ॅ': 'e' };
const DEV_CONS: Record<string, string> = {
  'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'n', 'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'n', 'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n',
  'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n', 'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm', 'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v', 'श': 'sh', 'ष': 'sh',
  'स': 's', 'ह': 'h', 'ळ': 'l', 'क़': 'q', 'ख़': 'kh', 'ग़': 'gh', 'ज़': 'z', 'ड़': 'd', 'ढ़': 'dh', 'फ़': 'f', 'य़': 'y',
};
const NUKTA = '़';
const VIRAMA = '्';
const DIGITS = '०१२३४५६७८९';

type Unit = { c: string; v: string; inherent: boolean; nasal: boolean };

function devWord(w: string): string {
  const ch = [...w.normalize('NFC')];
  const units: Unit[] = [];
  let out = '';
  for (let i = 0; i < ch.length; i++) {
    let c = ch[i]!;
    if (ch[i + 1] === NUKTA) {
      c += NUKTA;
      i++;
    }
    if (DEV_CONS[c] !== undefined) {
      units.push({ c: DEV_CONS[c]!, v: 'a', inherent: true, nasal: false });
    } else if (DEV_VOWEL[c] !== undefined) {
      units.push({ c: '', v: DEV_VOWEL[c]!, inherent: false, nasal: false });
    } else if (DEV_SIGN[c] !== undefined && units.length) {
      const u = units[units.length - 1]!;
      u.v = DEV_SIGN[c]!;
      u.inherent = false;
    } else if (c === VIRAMA && units.length) {
      const u = units[units.length - 1]!;
      u.v = '';
      u.inherent = false;
    } else if ((c === 'ं' || c === 'ँ') && units.length) {
      units[units.length - 1]!.nasal = true;
    } else if (c === 'ः' && units.length) {
      units[units.length - 1]!.v += 'h';
    } else if (c === '।' || c === '॥') {
      units.push({ c: '.', v: '', inherent: false, nasal: false });
    } else if (DIGITS.includes(c)) {
      units.push({ c: String(DIGITS.indexOf(c)), v: '', inherent: false, nasal: false });
    } else {
      units.push({ c, v: '', inherent: false, nasal: false });
    }
  }
  // the inherent "a" of the last consonant is not said (dil, pyaar), unless the word is that one consonant (na) or it closes a cluster (mitra)
  const last = units.length - 1;
  const lu = units[last];
  if (lu && lu.inherent && last > 0 && units[last - 1]!.v !== '' && !lu.nasal) lu.v = '';
  // casual spelling: a final long vowel is written short (tera, meri, nahin)
  if (lu && lu.c && lu.v === 'aa') lu.v = 'a';
  if (lu && lu.v === 'ee') lu.v = 'i';
  units.forEach((u, i) => {
    out += u.c + u.v;
    if (u.nasal) {
      const next = units[i + 1]?.c ?? '';
      out += /^(p|b|bh|m)$/.test(next) ? 'm' : 'n';
    }
  });
  return out;
}

const TA_VOWEL: Record<string, string> = { 'அ': 'a', 'ஆ': 'aa', 'இ': 'i', 'ஈ': 'ee', 'உ': 'u', 'ஊ': 'oo', 'எ': 'e', 'ஏ': 'e', 'ஐ': 'ai', 'ஒ': 'o', 'ஓ': 'o', 'ஔ': 'au' };
const TA_SIGN: Record<string, string> = { 'ா': 'aa', 'ி': 'i', 'ீ': 'ee', 'ு': 'u', 'ூ': 'oo', 'ெ': 'e', 'ே': 'e', 'ை': 'ai', 'ொ': 'o', 'ோ': 'o', 'ௌ': 'au' };
const PULLI = '்';
/** [at the start of a word or after a hard consonant, between vowels, after a nasal, doubled] */
const TA_STOP: Record<string, [string, string, string, string]> = {
  'க': ['k', 'g', 'g', 'kk'],
  'ச': ['s', 's', 'j', 'ch'],
  'ட': ['t', 'd', 'd', 'tt'],
  'த': ['th', 'dh', 'dh', 'th'],
  'ப': ['p', 'p', 'b', 'pp'],
};
const TA_CONS: Record<string, string> = { 'ங': 'ng', 'ஞ': 'nj', 'ண': 'n', 'ந': 'n', 'ம': 'm', 'ய': 'y', 'ர': 'r', 'ல': 'l', 'வ': 'v', 'ழ': 'zh', 'ள': 'l', 'ற': 'r', 'ன': 'n', 'ஜ': 'j', 'ஷ': 'sh', 'ஸ': 's', 'ஹ': 'h' };
const TA_NASAL = new Set(['ங', 'ஞ', 'ண', 'ந', 'ம', 'ன']);

type TaUnit = { base: string; v: string | null };

function taWord(w: string): string {
  const ch = [...w.normalize('NFC')];
  const units: TaUnit[] = [];
  for (const c of ch) {
    if (TA_STOP[c] || TA_CONS[c] !== undefined) units.push({ base: c, v: 'a' });
    else if (TA_VOWEL[c] !== undefined) units.push({ base: '', v: TA_VOWEL[c]! });
    else if (TA_SIGN[c] !== undefined && units.length) units[units.length - 1]!.v = TA_SIGN[c]!;
    else if (c === PULLI && units.length) units[units.length - 1]!.v = null;
    else if (c === 'ஃ') units.push({ base: '', v: 'h' });
    else units.push({ base: c, v: '' });
  }
  let out = '';
  units.forEach((u, i) => {
    const prev = units[i - 1];
    let cons = '';
    if (TA_STOP[u.base]) {
      const [initial, between, nasal, doubled] = TA_STOP[u.base]!;
      if (prev && prev.base === u.base && prev.v === null) {
        // the doubled consonant was already written once by the previous unit: write the rest
        cons = doubled.slice(TA_STOP[u.base]![0].length) || doubled;
      } else if (prev && prev.v === null && TA_NASAL.has(prev.base)) cons = nasal;
      else if (prev && prev.v !== null && prev.v !== '' && i > 0) cons = between;
      else cons = initial;
      // a doubled stop: the first half (with pulli) is written as the plain sound
      if (u.v === null && units[i + 1]?.base === u.base) cons = initial === 'th' ? 't' : initial === 's' ? 'c' : initial;
    } else if (u.base === 'ற' && prev?.base === 'ற' && prev.v === null) cons = 'r';
    else if (u.base === 'ற' && u.v === null && units[i + 1]?.base === 'ற') cons = 't';
    else if (u.base === 'ற' && prev?.base === 'ன' && prev.v === null) cons = 'dr';
    // ஞ் and ங் before their own stop are just the nasal: nenjam, sangam (the stop brings the j and g)
    else if ((u.base === 'ஞ' || u.base === 'ங') && u.v === null && TA_STOP[units[i + 1]?.base ?? '']) cons = 'n';
    else cons = TA_CONS[u.base] ?? u.base;
    out += cons + (u.v ?? '');
  });
  return out;
}

const DEV_RE = /[ऀ-ॿ]/;
const TA_RE = /[஀-௿]/;

/** Romanise one word or line. Text in other scripts passes through unchanged. */
export function romanize(text: string): string {
  return text
    .split(/(\s+)/)
    .map((tok) => {
      if (DEV_RE.test(tok)) return tok.replace(/[ऀ-ॿ]+/g, (m) => devWord(m));
      if (TA_RE.test(tok)) return tok.replace(/[஀-௿]+/g, (m) => taWord(m));
      return tok;
    })
    .join('');
}

/** Whether a line has anything this can romanise. */
export const canRomanize = (text: string): boolean => DEV_RE.test(text) || TA_RE.test(text);
