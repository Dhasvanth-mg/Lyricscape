import { describe, expect, it } from 'vitest';
import { canRomanize, romanize } from '@/lib/lyrics/romanize';

describe('display romanisation', () => {
  it('Hindi: casual spellings people type', () => {
    const cases: [string, string][] = [
      ['दिल', 'dil'],
      ['प्यार', 'pyaar'],
      ['तेरा', 'tera'],
      ['मेरी', 'meri'],
      ['क्या', 'kya'],
      ['है', 'hai'],
      ['मैं', 'main'],
      ['हूँ', 'hoon'],
      ['नहीं', 'nahin'],
      ['ज़िंदगी', 'zindagi'],
      ['केसरिया', 'kesariya'],
      ['दिल्ली', 'dilli'],
      ['न', 'na'],
      ['मित्र', 'mitra'],
      ['अंबर', 'ambar'],
    ];
    for (const [hi, ro] of cases) expect(romanize(hi), hi).toBe(ro);
  });
  it('Tamil: voicing from position', () => {
    const cases: [string, string][] = [
      ['காதல்', 'kaadhal'],
      ['நெஞ்சம்', 'nenjam'],
      ['அன்பு', 'anbu'],
      ['என்று', 'endru'],
      ['காற்று', 'kaatru'],
      ['வீடு', 'veedu'],
      ['மழை', 'mazhai'],
      ['கண்ணே', 'kanne'],
      ['பாட்டு', 'paattu'],
      ['சொல்லு', 'sollu'],
      ['பக்கம்', 'pakkam'],
      ['முகம்', 'mugam'],
      ['சங்கம்', 'sangam'],
    ];
    for (const [ta, ro] of cases) expect(romanize(ta), ta).toBe(ro);
  });
  it('keeps spaces, punctuation and Latin words as they are', () => {
    expect(romanize('तेरा दिल, baby')).toBe('tera dil, baby');
    expect(canRomanize('hello')).toBe(false);
    expect(canRomanize('காதல் love')).toBe(true);
  });
});
