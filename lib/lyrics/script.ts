// Which script and language a piece of lyrics is in. Pure and cheap: it drives font choice (complex scripts need their own faces and no
// letter spacing), word splitting, right-to-left layout, the mood lexicon, and the language label in the UI.
//
// HONEST SCOPE: script detection is exact. Telling Hindi from Urdu-in-Devanagari, Japanese kanji-only text from Chinese, or a romanised
// language ("Hinglish", "Tanglish", Spanish, French...) from English is a word-list heuristic: it needs a clear share of very common words
// and answers "unknown" / "English" otherwise. It never reads meaning.

export const DEVANAGARI = /[ऀ-ॿ]/;
export const TAMIL = /[஀-௿]/;
export const INDIC = /[ऀ-ॿ஀-௿]/;
export const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힯]/;
export const KANA = /[぀-ヿㇰ-ㇿ]/;
export const HAN = /[㐀-䶿一-鿿豈-﫿]/;
export const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
export const HEBREW = /[֐-׿]/;
export const THAI = /[฀-๿]/;
export const CYRILLIC = /[Ѐ-ӿ]/;
/** combining marks (vowel signs, virama, diacritics): they belong to the letter before them */
export const MARKS = /\p{M}/u;

export const hasIndic = (s: string): boolean => INDIC.test(s);
export const hasDevanagari = (s: string): boolean => DEVANAGARI.test(s);
export const hasTamil = (s: string): boolean => TAMIL.test(s);
export const hasCjk = (s: string): boolean => HANGUL.test(s) || KANA.test(s) || HAN.test(s);
export const hasRtl = (s: string): boolean => ARABIC.test(s) || HEBREW.test(s);
export const hasThai = (s: string): boolean => THAI.test(s);
/** text that is not plain Latin / Cyrillic / Greek: it needs a script face, no letter spacing and no italic */
export const isComplexScript = (s: string): boolean => INDIC.test(s) || hasCjk(s) || hasRtl(s) || THAI.test(s);

export type ScriptCounts = { latin: number; devanagari: number; tamil: number; hangul: number; kana: number; han: number; arabic: number; hebrew: number; thai: number; cyrillic: number; other: number };

export function scriptCounts(text: string): ScriptCounts {
  const c: ScriptCounts = { latin: 0, devanagari: 0, tamil: 0, hangul: 0, kana: 0, han: 0, arabic: 0, hebrew: 0, thai: 0, cyrillic: 0, other: 0 };
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (cp >= 0x900 && cp <= 0x97f) c.devanagari++;
    else if (cp >= 0xb80 && cp <= 0xbff) c.tamil++;
    else if (!/\p{L}|\p{M}/u.test(ch)) continue;
    else if (HANGUL.test(ch)) c.hangul++;
    else if (KANA.test(ch)) c.kana++;
    else if (HAN.test(ch)) c.han++;
    else if (ARABIC.test(ch)) c.arabic++;
    else if (HEBREW.test(ch)) c.hebrew++;
    else if (THAI.test(ch)) c.thai++;
    else if (CYRILLIC.test(ch)) c.cyrillic++;
    else if (/[A-Za-zÀ-ɏ]/.test(ch)) c.latin++;
    else if (/\p{L}/u.test(ch)) c.other++;
  }
  return c;
}

export type LangId = 'en' | 'hi' | 'ta' | 'hi-latn' | 'ta-latn' | 'es' | 'fr' | 'pt' | 'de' | 'it' | 'ko' | 'ja' | 'zh' | 'ar' | 'he' | 'ru' | 'th' | 'mixed' | 'other' | 'unknown';
export type Lang = { id: LangId; label: string; scripts: ScriptCounts; rtl: boolean };

// the most frequent function / feeling words of each language written in Latin letters (lower case, without diacritics)
const W = (s: string) => new Set(s.split(' '));
const LATIN_WORDS: Record<'hi-latn' | 'ta-latn' | 'es' | 'fr' | 'pt' | 'de' | 'it', Set<string>> = {
  'hi-latn': W('hai hain tha thi the hoon hun ho nahi nahin nhi kya kyun kyu kab kaise kahan koi kuch sab toh to tu tum tera tere teri tujhe tujhko tumhe mera mere meri mujhe mujhko main mai mein hum hamara humko woh wo vo yeh ye ek aur ya bhi hi se ko ka ki ke par pe liye lie jab jaise jaisa kabhi abhi ab aaj kal raat din dil pyaar pyar ishq mohabbat muhabbat zindagi yaar dost sanam sajna saajan jaan jaana jana aana aaja chal chalo ruk bas bhula yaad yaadein aansu judaai judai tanha akela khuda rab chand taare sitare baarish barish mausam ghar dard bewafa wafa hawa dhadkan saathi sath saath khwab khwaab sapna'),
  'ta-latn': W('nee nii naan naa nan enna en ennai ennaku unnai unakku un unnoda ava avan avanga inga enga engey ange anga idhu idhe adhu adhe ithu athu oru onnu illa illai ille vendam vendaam venum vaa vaanga va po poda di da dei machan machi macha thala kanna kannamma kanmani kadhal kaadhal kadhali kaathal anbe anbu uyire uyir azhagu azhage mazhai mazhaiyil nila nilave vaanam vaanil nenjam nenjil nenje kangal kann paadal paattu paadu sollu sol solla thaan dhaan tha thaa mattum romba semma ponnu pulla chella chellam thangam kuyil kili minnal veyil iravu pagal pozhudhu'),
  es: W('el la los las un una unos unas de del que y en es por con para como pero mas muy yo tu te me mi mis tus su sus nos ya si no se lo le al este esta eso esa soy eres estoy estas tengo tienes quiero amor corazon vida noche dia hoy ayer siempre nunca todo nada cuando donde porque ahora aqui alla baby bebe mami papi'),
  fr: W('le la les un une des du de et est en que qui pas pour dans sur avec plus tout tous mon ma mes ton ta tes son sa ses nous vous ils elles je tu il elle ne se ce cette ces mais ou donc car si comme tres bien aussi toujours jamais amour coeur vie nuit jour moi toi lui oui non suis es sont ai as ont'),
  pt: W('o a os as um uma uns umas de do da dos das em no na nos nas que e eh para por com como mas mais muito eu tu voce ele ela nos eles elas meu minha meus minhas teu tua seu sua nao sim ja se isso essa esse aqui ali amor coracao vida noite dia hoje ontem sempre nunca tudo nada quando onde porque agora tenho quero sou estou'),
  de: W('der die das ein eine einen und ist in zu den von mit sich auf fur nicht auch es an er sie wir ihr ich du mir mich dich mein dein sein unser aber wie wenn nur noch schon dann wird war bin bist sind hab hast habe liebe herz leben nacht tag immer nie alles nichts heute jetzt hier'),
  it: W('il lo la i gli le un una uno di del della dei delle e che in con per non come ma piu molto io tu lui lei noi voi loro mio mia miei mie tuo tua suo sua si no ho hai ha sono sei siamo amore cuore vita notte giorno oggi ieri sempre mai tutto niente quando dove perche adesso qui'),
};

const fold = (w: string) => w.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');

/** Language of a block of lyrics, from its script and (for Latin letters) a word-list read. */
export function detectLanguage(text: string): Lang {
  const sc = scriptCounts(text);
  const letters = Object.values(sc).reduce((a, b) => a + b, 0);
  const mk = (id: LangId, label: string, rtl = false): Lang => ({ id, label, scripts: sc, rtl });
  if (letters < 6) return mk('unknown', 'Unknown');
  const share = (n: number) => n / letters;
  // a script that carries most of the text names the language (Hangul -> Korean, Kana -> Japanese...)
  if (share(sc.devanagari) >= 0.55) return mk('hi', 'Hindi');
  if (share(sc.tamil) >= 0.55) return mk('ta', 'Tamil');
  if (share(sc.hangul) >= 0.4) return mk('ko', 'Korean');
  if (share(sc.kana) >= 0.15 && share(sc.kana + sc.han) >= 0.4) return mk('ja', 'Japanese');
  if (share(sc.han) >= 0.5) return mk('zh', 'Chinese');
  if (share(sc.arabic) >= 0.5) return mk('ar', 'Arabic', true);
  if (share(sc.hebrew) >= 0.5) return mk('he', 'Hebrew', true);
  if (share(sc.thai) >= 0.5) return mk('th', 'Thai');
  if (share(sc.cyrillic) >= 0.5) return mk('ru', 'Russian / Cyrillic');
  const indic = share(sc.devanagari) + share(sc.tamil);
  const other = share(sc.hangul + sc.kana + sc.han + sc.arabic + sc.hebrew + sc.thai + sc.cyrillic);
  if (indic >= 0.15) return mk('mixed', share(sc.devanagari) >= share(sc.tamil) ? 'Hindi + English' : 'Tamil + English');
  if (other >= 0.15) return mk('mixed', 'Mixed languages');
  if (share(sc.other) >= 0.5) return mk('other', 'Another script');
  const words = text.split(/\s+/).map(fold).filter((w) => w.length > 0);
  if (words.length >= 12) {
    const hits: Record<string, number> = {};
    for (const w of words) for (const [id, set] of Object.entries(LATIN_WORDS)) if (set.has(w)) hits[id] = (hits[id] ?? 0) + 1;
    const ranked = Object.entries(hits).sort((a, b) => b[1] - a[1]);
    const [bestId, best] = ranked[0] ?? ['', 0];
    const second = ranked[1]?.[1] ?? 0;
    // English function words ("the", "you", "and"...) would also hit es/fr/it a little: demand a clear share and a clear lead
    const en = words.filter((w) => ['the', 'and', 'you', 'to', 'is', 'in', 'of', 'it', 'that', 'my', 'me', 'i', 'we', 'on', 'for', 'with', 'this', 'your', 'be', 'at', 'all', 'but'].includes(w)).length;
    if (best / words.length >= 0.16 && best > second * 1.25 && best > en) {
      const label: Record<string, string> = { 'hi-latn': 'Hindi (romanised)', 'ta-latn': 'Tamil (romanised)', es: 'Spanish', fr: 'French', pt: 'Portuguese', de: 'German', it: 'Italian' };
      return mk(bestId as LangId, label[bestId]!);
    }
  }
  return mk('en', 'English');
}

export function lyricsText(doc: { lines: { words: { text: string }[] }[] } | null | undefined, maxLines = 60): string {
  if (!doc) return '';
  return doc.lines
    .slice(0, maxLines)
    .map((l) => l.words.map((w) => w.text).join(' '))
    .join('\n');
}

export const detectDocLanguage = (doc: Parameters<typeof lyricsText>[0]): Lang => detectLanguage(lyricsText(doc));
