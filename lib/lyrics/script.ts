// Which script and language a piece of lyrics is in. Pure and cheap: it drives font choice (Devanagari and Tamil need their own
// faces and no letter spacing), the mood lexicon, and the language label in the UI.
//
// HONEST SCOPE: script detection is exact. Telling Hindi from Urdu-in-Devanagari, or romanised Hindi ("Hinglish") from English, is a
// word-list heuristic: it needs a clear share of very common words and says "mixed" or "unknown" otherwise.

export const DEVANAGARI = /[ऀ-ॿ]/;
export const TAMIL = /[஀-௿]/;
export const INDIC = /[ऀ-ॿ஀-௿]/;
/** combining marks of the Indic scripts (vowel signs, virama, anusvara...): they belong to the letter before them */
export const MARKS = /\p{M}/u;

export const hasIndic = (s: string): boolean => INDIC.test(s);
export const hasDevanagari = (s: string): boolean => DEVANAGARI.test(s);
export const hasTamil = (s: string): boolean => TAMIL.test(s);

export type ScriptCounts = { latin: number; devanagari: number; tamil: number; other: number };

export function scriptCounts(text: string): ScriptCounts {
  const c: ScriptCounts = { latin: 0, devanagari: 0, tamil: 0, other: 0 };
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (cp >= 0x900 && cp <= 0x97f) c.devanagari++;
    else if (cp >= 0xb80 && cp <= 0xbff) c.tamil++;
    else if (/\p{L}/u.test(ch)) (/[A-Za-zÀ-ɏ]/.test(ch) ? c.latin++ : c.other++);
  }
  return c;
}

export type LangId = 'en' | 'hi' | 'ta' | 'hi-latn' | 'ta-latn' | 'mixed' | 'other' | 'unknown';
export type Lang = { id: LangId; label: string; scripts: ScriptCounts };

// the most frequent function / emotion words of romanised Hindi and Tamil (lower case, without diacritics)
const HI_LATN = new Set(
  'hai hain tha thi the hoon hun ho nahi nahin nhi kya kyun kyu kab kaise kahan koi kuch sab toh to tu tum tera tere teri tujhe tujhko tumhe mera mere meri mujhe mujhko main mai mein hum hamara humko woh wo vo yeh ye ek aur ya bhi hi se ko ka ki ke par pe liye lie jab jaise jaisa kabhi abhi ab aaj kal raat din dil pyaar pyar ishq mohabbat muhabbat zindagi zindagi yaar dost sanam sajna saajan jaan jaana jana aana aaja chal chalo ruk bas bhula yaad yaadein aansu judaai judai tanha akela khuda rab chand taare sitare baarish barish mausam ghar dard bewafa wafa hawa dhadkan saathi sath saath khwab khwaab sapna'.split(' '),
);
const TA_LATN = new Set(
  'nee nii naan naa nan enna en ennai ennaku unnai unakku un unnoda ava avan avanga avalo avalukku inga enga engey ange anga idhu idhe adhu adhe ithu athu oru oru onnu illa illai ille vendam vendaam venum vaa vaanga va po poda poda di da dei machan machi macha thala kanna kannamma kanmani kadhal kaadhal kadhali kaathal anbe anbu uyire uyir azhagu azhage mazhai mazhaiyil nila nilave vaanam vaanil nenjam nenjil nenje kangal kann paadal paattu paadu sollu sol solla thaan dhaan tha thaa mattum romba semma ponnu pulla chella chellam thangam kuyil kili minnal veyil iravu pagal pozhudhu'.split(' '),
);

const fold = (w: string) => w.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');

/** Language of a block of lyrics, from its script and (for Latin text) a word-list read. */
export function detectLanguage(text: string): Lang {
  const sc = scriptCounts(text);
  const letters = sc.latin + sc.devanagari + sc.tamil + sc.other;
  if (letters < 6) return { id: 'unknown', label: 'Unknown', scripts: sc };
  const share = (n: number) => n / letters;
  const dev = share(sc.devanagari);
  const tam = share(sc.tamil);
  if (dev >= 0.55) return { id: 'hi', label: 'Hindi', scripts: sc };
  if (tam >= 0.55) return { id: 'ta', label: 'Tamil', scripts: sc };
  if (dev >= 0.15 || tam >= 0.15) return { id: 'mixed', label: dev >= tam ? 'Hindi + English' : 'Tamil + English', scripts: sc };
  if (share(sc.other) >= 0.5) return { id: 'other', label: 'Another script', scripts: sc };
  const words = text.split(/\s+/).map(fold).filter((w) => w.length > 0);
  if (words.length >= 12) {
    let hi = 0;
    let ta = 0;
    for (const w of words) {
      if (HI_LATN.has(w)) hi++;
      if (TA_LATN.has(w)) ta++;
    }
    const best = Math.max(hi, ta) / words.length;
    if (best >= 0.16 && hi !== ta) return hi > ta ? { id: 'hi-latn', label: 'Hindi (romanised)', scripts: sc } : { id: 'ta-latn', label: 'Tamil (romanised)', scripts: sc };
  }
  return { id: 'en', label: 'English', scripts: sc };
}

export function lyricsText(doc: { lines: { words: { text: string }[] }[] } | null | undefined, maxLines = 60): string {
  if (!doc) return '';
  return doc.lines
    .slice(0, maxLines)
    .map((l) => l.words.map((w) => w.text).join(' '))
    .join('\n');
}

export const detectDocLanguage = (doc: Parameters<typeof lyricsText>[0]): Lang => detectLanguage(lyricsText(doc));
