import { describe, expect, it } from 'vitest';
import { parseLrc } from '@/lib/lyrics/parse';
import { buildIdentity, describeIdentity, blend } from '@/lib/identity/build';
import { applyCorrection } from '@/lib/identity/corrections';
import { parseAiResponse, buildAiMessages, aiCacheKey } from '@/lib/identity/ai';
import { readGenres } from '@/lib/identity/genre';
import { lyricStats, lyricsPace } from '@/lib/identity/lyricStats';
import { readText, rate } from '@/lib/identity/text';
import { DIM_KEYS, type GenreTag, type IdentityInputs } from '@/lib/identity/types';

// All lyrics here are original lines written for the tests.
const lrc = (lines: string[], gap = 3) => parseLrc(lines.map((l, i) => `[${String(Math.floor((i * gap) / 60)).padStart(2, '0')}:${String(((i * gap) % 60).toFixed(2)).padStart(5, '0')}] ${l}`).join('\n'));

const SAD = lrc([
  'I cry alone in the empty rain tonight',
  'Tears fall down and the pain will not fade',
  'Goodbye is a heartbreak I regret',
  'I miss you more than the lonely nights',
  'My broken heart aches in the grey',
  'Sorrow sits beside me in the dark room',
  'I am lost without you and so tired',
  'Every memory hurts and I feel numb',
  'Alone again with the rain on the glass',
  'Cry for me when the morning comes',
]);
const JOY = lrc([
  'We dance in the sunshine and laugh with joy',
  'Happy golden summer, I am so grateful',
  'Celebrate with me, the party is alive',
  'Smile at the sweet blessed morning',
  'Wonderful days and delighted hearts',
  'Cheer for the lucky sunshine tonight',
  'Dance with me, we are glad and free',
  'Bliss is a summer afternoon with you',
  'Laugh out loud, the whole crowd sings',
  'Joy joy joy, I am thrilled to be alive',
]);
const tag = (t: string, weight = 1, source: GenreTag['source'] = 'spotify'): GenreTag => ({ tag: t, weight, source });
const base = (over: Partial<IdentityInputs> = {}): IdentityInputs => ({ trackId: 't', tags: [], lyrics: null, ...over });

describe('unknown stays unknown', () => {
  it('a song with no evidence has no emotional dimensions, not a default middle', () => {
    const id = buildIdentity(base({ trackId: 'empty' }));
    for (const k of DIM_KEYS) expect(id.emotional[k].v, k).toBeNull();
    expect(id.emotional.ambiguity.v).toBeNull();
    expect(id.evidence).toBe(0);
    expect(describeIdentity(id).headline).toMatch(/not enough information/i);
    expect(id.provenance.unknown.join(' ')).toMatch(/audio/i);
  });

  it('genre tags alone only nudge: one trap tag is not a verdict about this song', () => {
    const id = buildIdentity(base({ trackId: 'tagonly', tags: [tag('trap', 0.5)] }));
    expect(id.musical.primaryGenre).toBe('hiphop');
    expect(id.emotional.valence.v).toBeNull();
    expect(id.emotional.melancholy.v).toBeNull();
  });

  it('never invents artist influences, whatever the inputs', () => {
    const id = buildIdentity(base({ trackId: 'inf', tags: [tag('alternative r&b'), tag('neo soul')], lyrics: SAD }));
    expect(id.cultural.influences).toEqual([]);
    expect(id.provenance.unknown.join(' ')).toMatch(/influences/);
  });
});

describe('evidence is combined, not mistaken for certainty', () => {
  it('sad words + a slow, dark cover read as low valence with real confidence', () => {
    const id = buildIdentity(base({ trackId: 'sad', lyrics: SAD, cover: { light: 0.15, vibrance: 0.2 } }));
    expect(id.emotional.valence.v!).toBeLessThan(0.4);
    expect(id.emotional.melancholy.v!).toBeGreaterThan(0.5);
    expect(id.emotional.valence.src).toEqual(expect.arrayContaining(['lyrics', 'cover']));
  });

  it('melancholy words over a bright, fast, colourful setting are ambiguous, not forced into one label', () => {
    const clear = buildIdentity(base({ trackId: 'a1', lyrics: SAD, cover: { light: 0.15, vibrance: 0.2 }, bpm: 70 }));
    const mixed = buildIdentity(base({ trackId: 'a2', lyrics: SAD, cover: { light: 0.7, vibrance: 0.7 }, bpm: 128, tags: [tag('dance pop'), tag('synth-pop')] }));
    expect(mixed.emotional.ambiguity.v!).toBeGreaterThan(clear.emotional.ambiguity.v ?? 0);
    expect(mixed.emotional.valence.conf).toBeLessThan(clear.emotional.valence.conf);
  });

  it('lyrics that hold both joy and heartbreak register as ambiguity', () => {
    const both = lrc([...SAD.lines.slice(0, 5).map((l) => l.words.map((w) => w.text).join(' ')), ...JOY.lines.slice(0, 5).map((l) => l.words.map((w) => w.text).join(' '))]);
    const a = buildIdentity(base({ trackId: 'both', lyrics: both }));
    const pure = buildIdentity(base({ trackId: 'pure', lyrics: SAD }));
    expect(a.emotional.ambiguity.v!).toBeGreaterThan(pure.emotional.ambiguity.v!);
  });

  it('dimensions are independent: a song can be warm and sad at once', () => {
    const id = buildIdentity(base({ trackId: 'ind', lyrics: SAD, cover: { light: 0.4, vibrance: 0.5, warmth: 0.9 }, tags: [tag('neo soul')] }));
    expect(id.emotional.warmth.v!).toBeGreaterThan(0.6);
    expect(id.emotional.melancholy.v!).toBeGreaterThan(0.5);
  });

  it('blend: disagreeing sources lower confidence versus agreeing ones', () => {
    const agree = blend([{ v: 0.8, w: 1, src: 'lyrics' }, { v: 0.78, w: 1, src: 'cover' }]);
    const clash = blend([{ v: 0.9, w: 1, src: 'lyrics' }, { v: 0.1, w: 1, src: 'cover' }]);
    expect(clash.conf).toBeLessThan(agree.conf);
    expect(blend([{ v: 0.9, w: 0.1, src: 'genre' }]).v).toBeNull();
  });
});

describe('lyric reading is more careful than word spotting', () => {
  it('negation weakens a hit instead of flipping it into another feeling', () => {
    const neg = readText(lrc(['I am never happy when you leave', 'not joy not laughter in this room', 'no smile no sunshine here today', 'without delight I stay in bed', 'never glad to see the morning', 'nothing blessed about it all']));
    const pos = readText(lrc(['I am happy when you stay', 'joy and laughter in this room', 'a smile and sunshine here today', 'with delight I leave the bed', 'glad to see the morning', 'something blessed about it all']));
    expect(neg!.cat.joy).toBeLessThan(pos!.cat.joy * 0.4);
    expect(neg!.cat.sadness).toBe(0);
  });

  it('a repeated hook counts once at full weight, then a third: repetition is emphasis, not new feeling', () => {
    const hook = ['I love you so', 'x'];
    const once = readText(lrc(['I love you so', 'the road goes on and on', 'we walk past the old gate', 'the river runs beside us', 'a quiet town at dusk', 'the lamps are coming on']));
    const many = readText(lrc(['I love you so', 'I love you so', 'I love you so', 'I love you so', 'I love you so', 'the road goes on and on', 'we walk past the old gate', 'the river runs beside us', 'a quiet town at dusk', 'the lamps are coming on']));
    expect(hook.length).toBe(2);
    expect(many!.cat.love).toBeLessThan(once!.cat.love * 2.5);
    expect(rate(many!, 'love')).toBeLessThan(rate(once!, 'love') * 2.5);
  });

  it('everyday words that merely sit near feelings are not mood evidence', () => {
    const t = readText(lrc(['the city is loud at night', 'baby we drop the beat', 'yeah it is good to run', 'we fall into the blue', 'break the chain and move', 'the wall the tape the wire']));
    expect(t!.hits).toBeLessThan(1);
  });

  it('plain (unsynced) lyrics have no pace: spread-out lines are not a delivery speed', () => {
    const doc = lrc(Array.from({ length: 12 }, (_, i) => `line number ${i} of some words here`));
    expect(lyricsPace(doc)).toBeGreaterThan(0);
    expect(lyricsPace({ ...doc, source: 'plain', timing: { source: 'plain' } })).toBeUndefined();
  });

  it('storytelling reads differently from a chorus-led song', () => {
    const story = lyricStats(lrc(['He walked into the room and said nothing to her at all', 'She had left the keys on the table where they had been', 'They talked for hours about the years they had wasted', 'He knew that she wanted to go back to the old house', 'The night ended the way that it had always started', 'She took her coat and left him standing at the door']));
    const chorus = lyricStats(lrc(['hey hey hey', 'oh oh oh', 'hey hey hey', 'oh oh oh', 'hey hey hey', 'oh oh oh', 'we are one', 'we are one', 'we are one']));
    expect(story!.narrativity).toBeGreaterThan(chorus!.narrativity + 0.2);
  });
});

describe('musical identity from tags', () => {
  it('maps tags to a family, a subgenre and an aesthetic, with shares', () => {
    const g = readGenres([tag('alternative r&b'), tag('neo soul', 0.5), tag('lo-fi')]);
    expect(g.primary).toBe('rnb');
    expect(g.subgenre).toBe('alt R&B');
    expect(g.aesthetics).toContain('lo-fi');
    expect(g.familyShare.rnb!).toBeGreaterThan(0.5);
  });

  it('keeps a secondary family only when it is a real part of the mix', () => {
    expect(readGenres([tag('alternative r&b'), tag('hip hop', 0.7)]).secondary).toBe('hiphop');
    expect(readGenres([tag('hip hop'), tag('hip hop'), tag('pop', 0.05)]).secondary).toBeNull();
  });

  it('treats fast timed delivery as rapped and slow as sung (a delivery inference, labelled as such)', () => {
    const fast = lrc(Array.from({ length: 14 }, () => 'one two three four five six seven eight nine ten eleven twelve'), 3);
    const slow = lrc(Array.from({ length: 14 }, () => 'slow soft song'), 4);
    expect(buildIdentity(base({ trackId: 'f', lyrics: fast })).musical.delivery.kind).toBe('rapped');
    expect(buildIdentity(base({ trackId: 's', lyrics: slow })).musical.delivery.kind).toBe('sung');
  });
});

describe('corrections and AI', () => {
  it('"more intimate" moves only that dimension, is bounded and is remembered', () => {
    let c = applyCorrection(null, 'moreIntimate');
    for (let i = 0; i < 10; i++) c = applyCorrection(c, 'moreIntimate');
    expect(c.adjust.intimacy).toBeLessThanOrEqual(0.6);
    const plain = buildIdentity(base({ trackId: 'c', lyrics: SAD }));
    const steered = buildIdentity(base({ trackId: 'c', lyrics: SAD, corrections: c }));
    expect(steered.emotional.intimacy.v!).toBeGreaterThan(plain.emotional.intimacy.v ?? 0.4);
    expect(steered.emotional.intimacy.src).toContain('user');
    expect(steered.emotional.energy.v).toBe(plain.emotional.energy.v);
    expect(steered.key).not.toBe(plain.key);
  });

  it('taste axes are steered separately from the emotional dimensions', () => {
    const c = applyCorrection(applyCorrection(null, 'moreCinematic'), 'moreMinimal');
    expect(buildIdentity(base({ trackId: 'tt', corrections: c })).taste).toMatchObject({ cinematic: 0.35, minimal: 0.35, experimental: 0 });
  });

  it('an AI reply is validated, its confidence capped, and fields outside the schema are dropped', () => {
    const reply = '```json\n{"dims":{"melancholy":{"v":0.9,"conf":0.99},"warmth":{"v":2,"conf":0.5}},"subjects":["a long night drive"],"influences":["Someone Famous"],"summary":"Quiet and reflective."}\n```';
    expect(parseAiResponse(reply)).toBeNull(); // warmth.v = 2 is out of range: the whole reply is rejected, never half-trusted
    const ok = parseAiResponse('{"dims":{"melancholy":{"v":0.9,"conf":0.99}},"subjects":["a long night drive"],"influences":["Someone Famous"]}', 'm');
    expect(ok!.dims.melancholy!.conf).toBe(0.7);
    expect(ok).not.toHaveProperty('influences');
    expect(parseAiResponse('no json here')).toBeNull();
  });

  it('AI evidence joins the blend with source "ai" but cannot outvote the text it was given', () => {
    const ai = parseAiResponse('{"dims":{"melancholy":{"v":0.1,"conf":0.7}}}', 'm')!;
    const without = buildIdentity(base({ trackId: 'ai', lyrics: SAD }));
    const withAi = buildIdentity(base({ trackId: 'ai', lyrics: SAD, ai }));
    expect(withAi.ai).toBe(true);
    expect(withAi.emotional.melancholy.src).toContain('ai');
    expect(withAi.emotional.melancholy.v!).toBeLessThan(without.emotional.melancholy.v!);
    expect(withAi.emotional.melancholy.v!).toBeGreaterThan(0.25); // the text still counts
  });

  it('prompt caps the excerpt and the cache key follows the lyric text', () => {
    const m = buildAiMessages({ title: 't', artist: 'a', tags: [], lyrics: 'x'.repeat(10_000) });
    expect(m[1]!.content.length).toBeLessThan(2700);
    expect(m[0]!.content).toMatch(/Do NOT state facts about the artist/);
    expect(aiCacheKey('id', 'one', 'm')).not.toBe(aiCacheKey('id', 'two', 'm'));
  });
});

describe('explaining a profile', () => {
  it('the headline names the mood words and the genre, and only uses dimensions it is sure of', () => {
    const id = buildIdentity(base({ trackId: 'd', lyrics: SAD, tags: [tag('alternative r&b'), tag('neo soul')], cover: { light: 0.2, vibrance: 0.25, warmth: 0.5 } }));
    const d = describeIdentity(id);
    expect(d.genre).toBe('alt R&B');
    expect(d.headline).toMatch(/Alt R&B$/);
    expect(d.words.length).toBeGreaterThan(0);
    expect(d.why.some((w) => w.startsWith('genre'))).toBe(true);
  });

  it('is deterministic: the same inputs give the same profile and key', () => {
    const inp = base({ trackId: 'det', lyrics: JOY, tags: [tag('pop')], bpm: 120 });
    expect(JSON.stringify(buildIdentity(inp))).toBe(JSON.stringify(buildIdentity({ ...inp })));
  });
});
