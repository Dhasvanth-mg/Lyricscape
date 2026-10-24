import { describe, expect, it } from 'vitest';
import { parseLrc } from '@/lib/lyrics/parse';
import { compileTimeline } from '@/lib/kinetic/compile';
import { computeFrame } from '@/lib/kinetic/frame';
import { analyzeEmotion, scoreText } from '@/lib/kinetic/emotion';
import { iconForWord } from '@/lib/kinetic/icons';
import { STYLES, estimateWidth, fontCss, fontCssFor, spacingFor } from '@/lib/kinetic/styles';
import { readText } from '@/lib/identity/text';
import { readGenres } from '@/lib/identity/genre';
import { detectLanguage, hasIndic } from '@/lib/lyrics/script';
import { phoneticKey, romanize, soundsAlike } from '@/lib/lyrics/translit';
import { normalizeTitle, rankCandidates, scoreCandidate, type LrclibRecord } from '@/lib/lyrics/match';
import { syllables } from '@/lib/lyrics/words';
import { safeFilename } from '@/lib/export/video';
import type { FrameEnv } from '@/lib/kinetic/types';

const HINDI = `[00:01.00] तेरे बिना ज़िंदगी से कोई शिकवा नहीं
[00:05.00] दिल में मेरे प्यार का दरिया बहता है
[00:09.00] आँखों में आँसू हैं, जुदाई का दर्द है
[00:13.00] चाँद रातों में तेरी याद आती है
[00:17.00] तेरे बिना ज़िंदगी से कोई शिकवा नहीं
[00:21.00] दिल में मेरे प्यार का दरिया बहता है`;
const TAMIL = `[00:01.00] நீ இல்லாமல் என் நெஞ்சம் அழுகிறது
[00:05.00] காதல் மழையில் நனைகிறேன் உன்னோடு
[00:09.00] கண்ணீர் துளிகள் என் கன்னம் தொட்டன
[00:13.00] நிலா வானில் உன் நினைவு வருகிறது
[00:17.00] நீ இல்லாமல் என் நெஞ்சம் அழுகிறது
[00:21.00] காதல் மழையில் நனைகிறேன் உன்னோடு`;
const HINGLISH = `[00:01.00] tere bina zindagi mein kuch nahi hai
[00:05.00] dil mein mere pyaar ka dariya hai
[00:09.00] aankhon mein aansu hain judaai ka dard hai
[00:13.00] chand raat mein teri yaad aati hai
[00:17.00] tu hi toh mera sanam hai yaar`;

const env: FrameEnv = { width: 1280, height: 720, reducedMotion: false };
const build = (lrc: string) => compileTimeline(parseLrc(lrc, 'test'), { trackId: 'indic', durationMs: 30000, palette: ['#ff2e63', '#ffb703', '#4cc9f0', '#14121f'], bpm: 100, style: 'maximalist' });

describe('script and language', () => {
  it('detects Hindi, Tamil, mixed and romanised lyrics', () => {
    const text = (lrc: string) => parseLrc(lrc, 't').lines.map((l) => l.words.map((w) => w.text).join(' ')).join('\n');
    expect(detectLanguage(text(HINDI)).id).toBe('hi');
    expect(detectLanguage(text(TAMIL)).id).toBe('ta');
    expect(detectLanguage(text(HINGLISH)).id).toBe('hi-latn');
    expect(detectLanguage('nee enna solla naan romba kadhal pannen un kooda vaa vaa kanna en uyire nila vaanam mazhai').id).toBe('ta-latn');
    expect(detectLanguage('I walked home alone under the neon lights tonight and thought of you').id).toBe('en');
    expect(detectLanguage('तुम मेरी ज़िंदगी हो always forever baby my heart tonight').id).toBe('mixed');
    expect(detectLanguage('hi').id).toBe('unknown');
    expect(hasIndic('प्यार')).toBe(true);
    expect(hasIndic('love')).toBe(false);
  });
});

describe('transliteration and cross-script matching', () => {
  it('romanises Devanagari and Tamil loosely', () => {
    expect(romanize('केसरिया')).toBe('kesariyaa');
    expect(romanize('प्यार')).toBe('pyaar');
    expect(romanize('दिल')).toBe('dil');
    expect(romanize('காதல்')).toBe('kaathal');
    expect(romanize('நிலா')).toBe('nilaa');
    expect(romanize('mixed ताज')).toBe('mixed taaj');
  });

  it('gives one phonetic key to spellings of the same name', () => {
    expect(phoneticKey('Kesariya')).toBe(phoneticKey('केसरिया'));
    expect(phoneticKey('Kadhal')).toBe(phoneticKey('காதல்'));
    expect(phoneticKey('Munbe Vaa')).toBe(phoneticKey('முன்பே வா'));
    expect(soundsAlike('Kesariya', 'Kesaria')).toBeGreaterThan(0.8);
    expect(soundsAlike('Kesariya', 'Blinding Lights')).toBeLessThan(0.5);
  });

  const rec = (over: Partial<LrclibRecord>): LrclibRecord => ({ id: 1, trackName: 'x', artistName: 'y', duration: 270, syncedLyrics: '[00:01.00] a b c', ...over });
  it('matches a Latin Spotify title to a native-script record, and still rejects a different song', () => {
    const q = { title: 'Kesariya', artist: 'Arijit Singh', duration: 268 };
    expect(scoreCandidate(rec({ trackName: 'केसरिया', artistName: 'अरिजीत सिंह' }), q)).not.toBeNull();
    expect(scoreCandidate(rec({ trackName: 'Kesaria', artistName: 'Arijit Singh' }), q)).not.toBeNull();
    expect(scoreCandidate(rec({ trackName: 'ताज महल', artistName: 'अरिजीत सिंह' }), q)).toBeNull();
    expect(scoreCandidate(rec({ trackName: 'केसरिया', artistName: 'श्रेया घोषाल' }), q)).toBeNull();
    const ranked = rankCandidates([rec({ id: 1, trackName: 'ताज महल', artistName: 'अरिजीत सिंह' }), rec({ id: 2, trackName: 'केसरिया', artistName: 'अरिजीत सिंह' })], q);
    expect(ranked.map((r) => r.record.id)).toEqual([2]);
  });

  it('keeps vowel signs when normalising titles', () => {
    expect(normalizeTitle('प्यार का रंग')).toBe('प्यार का रंग');
    expect(normalizeTitle('காதல் (From "Movie")')).toBe('காதல்');
  });

  it('keeps native-script names in export filenames', () => {
    expect(safeFilename('Arijit Singh केसरिया lyrics')).toBe('Arijit-Singh-केसरिया-lyrics');
    expect(safeFilename('காதல் - நிலா')).toContain('காதல்');
  });
});

describe('timing helpers', () => {
  it('counts syllables (aksharas) in Hindi and Tamil words', () => {
    expect(syllables('दिल')).toBe(2);
    expect(syllables('प्यार')).toBe(2);
    expect(syllables('ज़िंदगी')).toBeGreaterThanOrEqual(3);
    expect(syllables('காதல்')).toBe(2);
    expect(syllables('நெஞ்சம்')).toBeGreaterThanOrEqual(2);
    expect(syllables('love')).toBe(1);
  });
});

describe('fonts and layout', () => {
  const def = STYLES.maximalist.fonts.display;
  it('Indic text gets its script face first, no italic, no letter spacing; Latin text is untouched', () => {
    expect(fontCssFor(def, 60, 'hello')).toBe(fontCss(def, 60));
    const dev = fontCssFor({ ...def, italic: true }, 60, 'प्यार');
    expect(dev).toContain('Noto Sans Devanagari Variable');
    expect(dev.startsWith('italic')).toBe(false);
    expect(dev.indexOf('Noto Sans Devanagari')).toBeLessThan(dev.indexOf(def.family));
    expect(fontCssFor(def, 60, 'காதல்')).toContain('Noto Sans Tamil Variable');
    expect(spacingFor({ ...def, letterSpacingEm: 0.05 }, 100, 'hello')).toBe(5);
    expect(spacingFor({ ...def, letterSpacingEm: 0.05 }, 100, 'प्यार')).toBe(0);
  });
  it('estimates Indic width by letters, not by combining marks', () => {
    const w = estimateWidth('प्यार', def, 100);
    const naive = 'प्यार'.length * (def.widthFactor + def.letterSpacingEm) * 100;
    expect(w).toBeLessThan(naive * 1.2);
    expect(w).toBeGreaterThan(100);
  });
  for (const [name, lrc] of [['Hindi', HINDI], ['Tamil', TAMIL], ['Hinglish', HINGLISH]] as const) {
    it(`${name} lyrics compile and draw: every word is on screen at some point, unchanged, with finite geometry`, () => {
      const tl = build(lrc);
      const doc = parseLrc(lrc, 't');
      const seen = new Set<string>();
      for (let t = 0; t < 30000; t += 80) {
        const f = computeFrame(tl, t, env);
        for (const w of f.words) {
          expect(Number.isFinite(w.x) && Number.isFinite(w.y) && Number.isFinite(w.sizePx) && w.sizePx > 4).toBe(true);
          expect(w.maxWidthPx).toBeLessThanOrEqual(1280);
          seen.add(w.text);
        }
      }
      for (const line of doc.lines) for (const word of line.words) expect(seen.has(word.text) || seen.has(word.text.toUpperCase())).toBe(true);
    });
  }
});

describe('mood, subjects, icons and genre for Hindi and Tamil', () => {
  it('reads feelings in native script and in romanised text', () => {
    expect(scoreText('दिल में प्यार है').love).toBeGreaterThan(0);
    expect(scoreText('आँखों में आँसू और जुदाई का दर्द').sadness).toBeGreaterThan(0);
    expect(scoreText('காதல் மழையில் நனைகிறேன்').love).toBeGreaterThan(0);
    expect(scoreText('கண்ணீர் துளிகள் வலி').sadness).toBeGreaterThan(0);
    expect(scoreText('tere pyaar mein dil hai').love).toBeGreaterThan(0);
    expect(scoreText('kadhal kadhal uyire').love).toBeGreaterThan(0);
    // a negation weakens it, as in English
    expect(scoreText('नहीं प्यार').love).toBeLessThan(scoreText('प्यार').love + 1);
  });

  it('analyses a whole Hindi or Tamil song', () => {
    expect(['love', 'sadness']).toContain(analyzeEmotion(parseLrc(HINDI, 't')).overall.emotion);
    expect(['love', 'sadness']).toContain(analyzeEmotion(parseLrc(TAMIL, 't')).overall.emotion);
  });

  it('the identity text reader finds feelings and subjects too', () => {
    const hi = readText(parseLrc(HINDI, 't'))!;
    expect(hi).not.toBeNull();
    expect(hi.cat.love + hi.cat.sadness).toBeGreaterThan(0);
    const ta = readText(parseLrc(TAMIL, 't'))!;
    expect(ta.cat.love + ta.cat.sadness).toBeGreaterThan(0);
  });

  it('has icons for common words', () => {
    expect(iconForWord('दिल')).toBe('heart');
    expect(iconForWord('चाँद,')).toBe('moon');
    expect(iconForWord('காதல்')).toBe('heart');
    expect(iconForWord('நிலா')).toBe('moon');
    expect(iconForWord('pyaar')).toBe('heart');
    expect(iconForWord('mazhai')).toBe('rain');
  });

  it('reads Tamil film and Indian classical tags', () => {
    expect(readGenres([{ tag: 'kollywood', weight: 1, source: 'user' as const }]).primary).toBe('pop');
    expect(readGenres([{ tag: 'tamil hip hop', weight: 1, source: 'user' as const }]).primary).toBe('hiphop');
    expect(readGenres([{ tag: 'ghazal', weight: 1, source: 'user' as const }]).primary).toBe('atmospheric');
  });
});
