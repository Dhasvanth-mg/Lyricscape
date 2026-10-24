import { describe, expect, it } from 'vitest';
import { parseLrc } from '@/lib/lyrics/parse';
import { compileTimeline } from '@/lib/kinetic/compile';
import { computeFrame } from '@/lib/kinetic/frame';
import { analyzeEmotion, scoreText } from '@/lib/kinetic/emotion';
import { iconForWord } from '@/lib/kinetic/icons';
import { STYLES, estimateWidth, fontCssFor, scriptFamilies, spacingFor } from '@/lib/kinetic/styles';
import { buildIdentity, describeIdentity } from '@/lib/identity/build';
import { readGenres } from '@/lib/identity/genre';
import { lyricsPace } from '@/lib/identity/lyricStats';
import { readText } from '@/lib/identity/text';
import { detectLanguage, isComplexScript } from '@/lib/lyrics/script';
import { LEX_MOOD } from '@/lib/lyrics/lexicons';
import { syllables, tokenize } from '@/lib/lyrics/words';
import type { FrameEnv } from '@/lib/kinetic/types';

const lrcOf = (lines: string[], gap = 4) => lines.map((l, i) => `[${String(Math.floor((i * gap + 2) / 60)).padStart(2, '0')}:${String(((i * gap + 2) % 60).toFixed(2)).padStart(5, '0')}] ${l}`).join('\n');
const doc = (lines: string[]) => parseLrc(lrcOf(lines), 't');

const SAMPLES: Record<string, { lines: string[]; id: string }> = {
  es: { id: 'es', lines: ['yo no sé por qué te quiero tanto', 'tú eres la luz de mi vida y mi corazón', 'cuando te veo todo es más bonito para mí', 'pero ya no estás aquí y me duele el alma', 'siempre te voy a recordar mi amor'] },
  fr: { id: 'fr', lines: ['je ne sais pas pourquoi je pense à toi', 'tu es la lumière de ma vie et mon coeur', 'quand je te vois tout est plus beau pour moi', 'mais tu es parti et je pleure dans la nuit', 'toujours je me souviens de notre amour'] },
  pt: { id: 'pt', lines: ['eu não sei por que eu te quero tanto', 'você é a luz da minha vida e o meu coração', 'quando eu te vejo tudo é mais bonito para mim', 'mas você já não está aqui e eu choro de saudade', 'sempre vou lembrar de você meu amor'] },
  de: { id: 'de', lines: ['ich weiß nicht warum ich dich so sehr liebe', 'du bist das licht in meinem leben und mein herz', 'wenn ich dich sehe ist alles schöner für mich', 'aber du bist nicht mehr hier und ich weine in der nacht', 'ich werde dich immer vermissen mein schatz'] },
  it: { id: 'it', lines: ['io non so perché ti amo così tanto', 'sei la luce della mia vita e il mio cuore', 'quando ti vedo tutto è più bello per me', 'ma non sei più qui e io piango nella notte', 'ti ricorderò sempre amore mio'] },
  ko: { id: 'ko', lines: ['나는 너를 사랑해 이유는 몰라', '너는 내 삶의 빛이고 내 마음이야', '너를 볼 때마다 모든 게 아름다워', '하지만 이제 네가 없어서 눈물이 나', '언제나 너를 기억할게 사랑해'] },
  ja: { id: 'ja', lines: ['あなたを愛している理由はわからない', 'あなたは私の人生の光で私の心', 'あなたを見るたびにすべてが美しい', 'でももうあなたはいなくて涙が出る', 'いつまでもあなたを忘れないよ'] },
  zh: { id: 'zh', lines: ['我不知道为什么我这么爱你', '你是我生命中的光也是我的心', '每次看到你一切都变得美好', '可是你已经不在这里我在夜里流泪', '我会永远记得你我的爱'] },
  ru: { id: 'ru', lines: ['я не знаю почему я так люблю тебя', 'ты свет моей жизни и моё сердце', 'когда я вижу тебя всё становится прекрасным', 'но тебя больше нет и я плачу ночью', 'я всегда буду помнить тебя любовь моя'] },
  ar: { id: 'ar', lines: ['لا أعرف لماذا أحبك كل هذا الحب', 'أنت نور حياتي وأنت قلبي', 'عندما أراك يصبح كل شيء أجمل', 'لكنك لم تعد هنا وأنا أبكي في الليل', 'سأذكرك دائما يا حبيبي'] },
};

describe('language detection', () => {
  for (const [name, s] of Object.entries(SAMPLES)) {
    it(`recognises ${name}`, () => {
      const lang = detectLanguage(s.lines.join('\n'));
      expect(lang.id).toBe(s.id);
      expect(lang.rtl).toBe(name === 'ar');
    });
  }
  it('still says English for English, and does not call English French because of a few shared words', () => {
    expect(detectLanguage('we were dancing in the dark and you were holding my hand all night long and the music was so loud').id).toBe('en');
    expect(detectLanguage('tonight we dance in the moonlight, mon amour, and the world is ours forever and ever my love').id).toBe('en');
  });
  it('mixed-script lyrics are called mixed', () => {
    expect(detectLanguage('you are my always forever baby 사랑해 사랑해 tonight baby 너만 사랑해 yeah yeah').id).toBe('mixed');
  });
});

describe('word splitting for scripts without spaces', () => {
  it('cuts Japanese, Chinese and Thai runs into several words; spaced text is untouched', () => {
    expect(tokenize('あなたを愛している理由はわからない').length).toBeGreaterThan(2);
    expect(tokenize('我不知道为什么我这么爱你').length).toBeGreaterThan(2);
    expect(tokenize('ฉันรักเธอมากที่สุดในโลก').length).toBeGreaterThan(1);
    expect(tokenize('hello  big   world')).toEqual(['hello', 'big', 'world']);
    expect(tokenize('나는 너를 사랑해')).toEqual(['나는', '너를', '사랑해']);
    // nothing is lost: the pieces are the original text
    expect(tokenize('あなたを愛している理由はわからない').join('')).toBe('あなたを愛している理由はわからない');
  });
  it('lyric documents get real word units for those scripts', () => {
    const d = doc(SAMPLES.ja!.lines);
    for (const l of d.lines) expect(l.words.length).toBeGreaterThan(1);
  });
  it('counts syllables for Korean, Japanese and Russian', () => {
    expect(syllables('사랑해')).toBe(3);
    expect(syllables('ありがとう')).toBe(5);
    expect(syllables('きょう')).toBe(2);
    expect(syllables('любовь')).toBe(2);
  });
});

describe('mood and icons in other languages', () => {
  const expectEmotion = (text: string, emo: string) => expect(scoreText(text)[emo as 'love']).toBeGreaterThan(0);
  it('reads feeling words', () => {
    expectEmotion('te quiero mi amor', 'love');
    expectEmotion('lloro lágrimas de tristeza', 'sadness');
    expectEmotion('je pleure de tristesse', 'sadness');
    expectEmotion('mon coeur plein d amour', 'love');
    expectEmotion('estou feliz na festa', 'joy');
    expectEmotion('ich liebe dich mein herz', 'love');
    expectEmotion('ich weine vor trauer', 'sadness');
    expectEmotion('ti amo mio cuore', 'love');
    expectEmotion('나는 사랑해', 'love');
    expectEmotion('눈물이 나', 'sadness');
    expectEmotion('あなたを愛している', 'love');
    expectEmotion('涙が出る', 'sadness');
    expectEmotion('我爱你', 'love');
    expectEmotion('我在夜里流泪', 'sadness');
    expectEmotion('я люблю тебя', 'love');
    expectEmotion('я плачу, мне грустно', 'sadness');
    expectEmotion('أحبك يا حبيبي', 'love');
    expectEmotion('أبكي من الحزن', 'sadness');
  });
  it('analyses whole songs in each language to a plausible mood', () => {
    for (const [name, s] of Object.entries(SAMPLES)) {
      const a = analyzeEmotion(doc(s.lines));
      expect(['love', 'sadness', 'nostalgia'], name).toContain(a.overall.emotion);
    }
  });
  it('the foreign word lists never match common English words (so one stray word cannot change the mood of an English song)', () => {
    const english = ['pain', 'rose', 'mine', 'sale', 'gift', 'hell', 'art', 'tire', 'fin', 'son', 'die', 'but', 'red', 'man', 'car', 'me', 'sin', 'was', 'bald', 'kind', 'hand', 'rock', 'mist', 'wand', 'rat', 'pie', 'gut', 'tot'];
    const stems = Object.values(LEX_MOOD).flat().filter((s) => /^[a-zà-ÿ ]+$/i.test(s));
    for (const w of english) for (const s of stems) expect(s.length <= 3 ? w === s : w.startsWith(s), `${w} vs ${s}`).toBe(false);
  });
  it('the identity text reader sees feelings in other languages too', () => {
    const r = readText(doc([...SAMPLES.es!.lines, ...SAMPLES.es!.lines, ...SAMPLES.es!.lines]));
    expect(r).not.toBeNull();
    expect(r!.cat.love + r!.cat.sadness).toBeGreaterThan(0);
  });
  it('has icons for common words', () => {
    for (const [w, icon] of [['corazón', 'heart'], ['luna', 'moon'], ['feu', 'flame'], ['liebe', 'heart'], ['stella', 'star'], ['사랑', 'heart'], ['涙', 'tear'], ['月亮', 'moon'], ['любовь', 'heart'], ['قلب', 'heart']] as const) expect(iconForWord(w)).toBe(icon);
  });
  it('reads regional genre tags', () => {
    const tags = (t: string) => [{ tag: t, weight: 1, source: 'user' as const }];
    expect(readGenres(tags('reggaeton')).primary).toBe('pop');
    expect(readGenres(tags('k-pop')).primary).toBe('pop');
    expect(readGenres(tags('afrobeats')).primary).toBe('pop');
    expect(readGenres(tags('french rap')).primary).toBe('hiphop');
    expect(readGenres(tags('flamenco')).primary).toBe('folk');
  });
});

describe('identity is honest about languages it cannot read', () => {
  const inp = (lyrics: ReturnType<typeof doc>) => ({ trackId: 'x', tags: [], lyrics });
  const thai = doc(Array.from({ length: 12 }, () => 'ฉันรักเธอมากที่สุดในโลกใบนี้ทั้งใบ'));
  const english = doc(Array.from({ length: 12 }, () => 'we walk down the long road home tonight again'));
  it('names the limit, and a language without a word list never counts as "not sad"', () => {
    const idThai = buildIdentity(inp(thai));
    const limits = describeIdentity(idThai).limits.join(' | ');
    expect(limits).toContain('Thai');
    const idEn = buildIdentity(inp(english));
    // English with plenty of words and no sad words: weak evidence it is NOT melancholy; Thai: no such claim
    expect(idEn.emotional.melancholy.conf ?? 0).toBeGreaterThanOrEqual(idThai.emotional.melancholy.conf ?? 0);
  });
  it('covered languages say their word list is small', () => {
    expect(describeIdentity(buildIdentity(inp(doc(SAMPLES.es!.lines)))).limits.join(' ')).toContain('Spanish');
  });
});

describe('typography for other scripts', () => {
  const def = STYLES.maximalist.fonts.display;
  it('picks script faces, no letter spacing, and widths that match the script', () => {
    for (const text of ['사랑해', 'あなた', '我爱你', 'أحبك', 'שלום', 'รักเธอ']) {
      expect(isComplexScript(text)).toBe(true);
      expect(scriptFamilies(text)).toBeTruthy();
      expect(spacingFor({ ...def, letterSpacingEm: 0.1 }, 100, text)).toBe(0);
    }
    expect(fontCssFor(def, 50, '사랑해')).toContain('Malgun Gothic');
    expect(fontCssFor(def, 50, 'あなた')).toContain('Yu Gothic');
    expect(fontCssFor(def, 50, '我爱你')).toContain('YaHei');
    expect(fontCssFor(def, 50, 'أحبك')).toContain('Segoe UI');
    expect(scriptFamilies('hello')).toBeNull();
    expect(scriptFamilies('привет')).toBeNull(); // Cyrillic: the look's own faces cover it, then the system
    expect(estimateWidth('我爱你', def, 100)).toBeCloseTo(300, 0);
    expect(estimateWidth('사랑해', def, 100)).toBeCloseTo(300, 0);
  });
});

describe('layout and pace', () => {
  const env: FrameEnv = { width: 1280, height: 720, reducedMotion: false };
  const build = (lines: string[]) => compileTimeline(doc(lines), { trackId: 'w', durationMs: 40000, palette: ['#ff2e63', '#ffb703', '#4cc9f0', '#14121f'], bpm: 100, style: 'maximalist' });
  it('every script lays out with finite geometry inside the width budget', () => {
    for (const [name, s] of Object.entries(SAMPLES)) {
      const tl = build(s.lines);
      for (let t = 0; t < 40000; t += 150) {
        for (const w of computeFrame(tl, t, env).words) {
          expect(Number.isFinite(w.x) && Number.isFinite(w.y) && w.sizePx > 4, name).toBe(true);
          expect(w.maxWidthPx).toBeLessThanOrEqual(1280);
        }
      }
    }
  });
  it('right-to-left lines are mirrored: the first word of a row sits at the right', () => {
    const tl = build(['أنت نور حياتي وأنت قلبي الغالي', 'أنت نور حياتي وأنت قلبي الغالي']);
    let checked = 0;
    // settled words only: the middle of each line, after its entrance and before its exit (words fly around while they move)
    for (const t of [4800, 5000, 5200, 8800, 9000, 9200]) {
      const f = computeFrame(tl, t, env);
      const rows = new Map<string, { i: number; x: number }[]>();
      for (const w of f.words) {
        const key = `${w.id.split(':')[0]}|${Math.round(w.y / Math.max(10, w.sizePx * 0.7))}`; // same line, same row
        const r = rows.get(key) ?? [];
        r.push({ i: Number(w.id.split(':')[1]), x: w.x });
        rows.set(key, r);
      }
      for (const r of rows.values()) {
        const ord = [...r].sort((a, b) => a.i - b.i);
        for (let k = 1; k < ord.length; k++) {
          expect(ord[k]!.x).toBeLessThan(ord[k - 1]!.x + 1);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
  it('delivery pace is counted in syllables outside Latin text, so a Japanese or Tamil song is not mistaken for a very slow one', () => {
    const jp = lyricsPace(doc(Array.from({ length: 10 }, () => 'あなたを愛している理由はわからない')));
    const en = lyricsPace(doc(Array.from({ length: 10 }, () => 'you are the light of my life and my heart')));
    expect(jp).toBeGreaterThan(1);
    expect(jp! / en!).toBeGreaterThan(0.4);
    expect(jp! / en!).toBeLessThan(3);
  });
});
