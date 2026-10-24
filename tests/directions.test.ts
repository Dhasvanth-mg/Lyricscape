import { describe, expect, it } from 'vitest';
import { parseLrc } from '@/lib/lyrics/parse';
import { buildIdentity } from '@/lib/identity/build';
import { applyCorrection } from '@/lib/identity/corrections';
import type { GenreTag, IdentityInputs, SongIdentity } from '@/lib/identity/types';
import { luminance, mix, contrastRatio } from '@/lib/kinetic/util';
import { STYLES } from '@/lib/kinetic/styles';
import { chooseDirection } from '@/lib/theme/choose';
import { composeLook } from '@/lib/theme/compose';
import { DIRECTIONS, NEW_DIRECTION_IDS, PALETTES } from '@/lib/theme/directions';
import { FIXTURES, tagsOf } from '@/lib/theme/fixtures';
import { songVisual } from '@/lib/theme/pipeline';
import { mergeTweaks, resolveLook } from '@/lib/theme/resolve';
import type { CoverInfo, Tweaks } from '@/lib/theme/types';
import type { StyleId } from '@/lib/kinetic/types';
import type { Track } from '@/lib/types';

const tag = (t: string, weight = 0.85): GenreTag => ({ tag: t, weight, source: 'spotify' });
const idOf = (over: Partial<IdentityInputs> = {}): SongIdentity => buildIdentity({ trackId: 'x', tags: [], lyrics: null, ...over });
const lyr = (lines: string[]) => parseLrc(lines.map((l, i) => `[00:${String(i * 4).padStart(2, '0')}.00] ${l}`).join('\n'));
const SAD = lyr(['I cry alone in the empty rain tonight', 'Tears fall down and the pain will not fade', 'Goodbye is a heartbreak I regret', 'I miss you more than the lonely nights', 'My broken heart aches in the grey', 'Sorrow sits beside me in the dark room']);
const JOY = lyr(['We dance in the sunshine and laugh with joy', 'Happy golden summer, I am so grateful', 'Celebrate with me, the party is alive', 'Smile at the sweet blessed morning', 'Wonderful days and delighted hearts', 'Cheer for the lucky sunshine tonight']);

const COVERS: (CoverInfo | null)[] = [
  null,
  { palette: ['#d98b3a', '#a8465a', '#5a2a4a', '#1a0d12'], light: 0.2, vibrance: 0.5, warmth: 0.8 },
  { palette: ['#9bb09a', '#b8a9d6', '#d9d2c0', '#2a2e2a'], light: 0.7, vibrance: 0.25, warmth: 0.45 },
  { palette: ['#ff4f8b', '#ffcf40', '#4fd6ff', '#2a1030'], light: 0.6, vibrance: 0.8, warmth: 0.6 },
  { palette: ['#e8e8ee', '#a9a9b8', '#6f6f80', '#0e0e12'], light: 0.5, vibrance: 0.02 },
  { palette: ['#fff6a0', '#ffffff', '#f5f0d0', '#e8e0b0'], light: 0.95, vibrance: 0.3, warmth: 0.7 },
];

describe('R&B has its own art directions and never defaults to a retro look', () => {
  const RNB_TAGS = [['r&b'], ['alternative r&b'], ['neo soul'], ['contemporary r&b'], ['dark r&b', 'trap soul'], ['alternative r&b', 'neo soul', 'lo-fi'], ['r&b', 'pop']];
  const LYRICS = [null, SAD, JOY];
  it('across tags, lyrics, covers and tempo, R&B lands on Velvet / Ether / Nocturne (or a calm default), never Vaporwave or Neon', () => {
    const seen = new Set<StyleId>();
    for (const tags of RNB_TAGS)
      for (const lyrics of LYRICS)
        for (const cover of COVERS)
          for (const bpm of [undefined, 70, 128]) {
            const id = idOf({ tags: tags.map((t) => tag(t)), lyrics, cover: cover ? { light: cover.light, vibrance: cover.vibrance, warmth: cover.warmth } : null, bpm });
            const c = chooseDirection({ identity: id, cover });
            seen.add(c.direction);
            expect(['vaporwave', 'neon', 'vhs', 'y2k', 'maximalist', 'popart', 'psychedelic'], `${tags} ${bpm} -> ${c.direction}`).not.toContain(c.direction);
          }
    // the three R&B directions all actually get used
    for (const d of ['velvet', 'ether', 'nocturne'] as StyleId[]) expect([...seen], `${d} never chosen`).toContain(d);
  });

  it('vaporwave remains available, but only when the tags say retro-futurist', () => {
    const tagged = chooseDirection({ identity: idOf({ tags: [tag('vaporwave')] }), cover: null });
    expect(tagged.direction).toBe('vaporwave');
    const plain = chooseDirection({ identity: idOf({ tags: [tag('r&b')], lyrics: JOY }), cover: null });
    expect(plain.direction).not.toBe('vaporwave');
  });

  it('a soft, romantic-sounding song with NO genre evidence is not dressed as R&B', () => {
    const id = idOf({ lyrics: lyr(['Keep the lamp low I like how it finds you', 'Hold me like the evening holds the heat', 'I miss you when the morning comes', 'Soft in the dark like it belonged to you', 'Stay till the window turns amber', 'I remember the way that you said my name']) });
    const c = chooseDirection({ identity: id, cover: COVERS[1] ?? null });
    expect(['velvet', 'ether', 'nocturne']).not.toContain(c.direction);
  });
});

describe('themes represent the song, not just the genre', () => {
  const track = (id: string): Track => ({ id: `fixture:${id}`, provider: 'demo', title: id, artists: ['x'], durationMs: 200000 });
  const pick = (f: (typeof FIXTURES)[number]) => {
    const cover: CoverInfo = { palette: f.cover.palette, light: 0.4, vibrance: 0.5 };
    return songVisual({ track: { ...track(f.id), releaseYear: f.year }, doc: parseLrc(f.lrc), tags: tagsOf(f), cover });
  };

  it('each sample song gets the direction its evidence points to, and the set is varied', () => {
    const expected: Record<string, StyleId> = { 'amber-hours': 'velvet', 'static-garden': 'ether', 'parking-lot': 'nocturne', 'concrete-verses': 'rhythm', 'letters-block': 'broadsheet', 'glitter-math': 'graphic', 'rust-radio': 'analog', 'paper-boats': 'artbook', hum: 'stillness', 'fault-line': 'disorder', 'no-tags': 'stillness' };
    for (const f of FIXTURES) expect(pick(f).resolved.direction, f.id).toBe(expected[f.id]);
    expect(new Set(FIXTURES.map((f) => pick(f).resolved.direction)).size).toBeGreaterThanOrEqual(9);
  });

  it('two hip-hop songs get different directions when their delivery differs (fast and hard vs story-led)', () => {
    const rap = pick(FIXTURES.find((f) => f.id === 'concrete-verses')!);
    const story = pick(FIXTURES.find((f) => f.id === 'letters-block')!);
    expect(rap.resolved.direction).not.toBe(story.resolved.direction);
    expect(rap.identity.musical.delivery.kind).toBe('rapped');
    expect(story.identity.lyrical.stats!.narrativity).toBeGreaterThan(rap.identity.lyrical.stats!.narrativity);
  });

  it('every choice carries reasons, and the same song always gets the same look (stable across sessions)', () => {
    for (const f of FIXTURES) {
      const a = pick(f);
      const b = pick(f);
      expect(a.resolved.choice.reasons.length, f.id).toBeGreaterThan(0);
      expect(a.resolved.look.key, f.id).toBe(b.resolved.look.key);
      expect(JSON.stringify(a.resolved.look)).toBe(JSON.stringify(b.resolved.look));
    }
  });

  it('with too little evidence it says so and uses the calm default instead of guessing', () => {
    const c = chooseDirection({ identity: idOf({ trackId: 'blank' }), cover: null });
    expect(c.basis).toBe('default');
    expect(c.direction).toBe('stillness');
    expect(c.reasons.join(' ')).toMatch(/not enough information/);
  });

  it('a direction that needs genre evidence is not picked without it (mood and cover alone cannot make a song hip-hop)', () => {
    const id = idOf({ lyrics: lyr(['one two three four five six seven eight nine ten', 'one two three four five six seven eight nine ten', 'one two three four five six seven eight nine ten', 'one two three four five six seven eight nine ten', 'one two three four five six seven eight nine ten']) });
    expect(['rhythm', 'broadsheet', 'velvet', 'ether', 'disorder', 'analog']).not.toContain(chooseDirection({ identity: id, cover: null }).direction);
  });

  it('"more experimental" can make Ether / Disorder eligible, and corrections are part of the identity', () => {
    const base = idOf({ tags: [tag('indie')], lyrics: SAD });
    const steered = idOf({ tags: [tag('indie')], lyrics: SAD, corrections: applyCorrection(applyCorrection(null, 'moreExperimental'), 'moreExperimental') });
    expect(steered.taste.experimental).toBeGreaterThan(base.taste.experimental);
    expect(steered.key).not.toBe(base.key);
  });

  it('the family default the listener sets wins over Auto, and says so', () => {
    const id = idOf({ tags: [tag('alternative r&b')], lyrics: SAD });
    const c = chooseDirection({ identity: id, cover: null }, { familyDefaults: { rnb: 'nocturne' } });
    expect(c.direction).toBe('nocturne');
    expect(c.basis).toBe('family-default');
  });
});

describe('composed looks keep every colour readable', () => {
  const ids: (SongIdentity | null)[] = [null, idOf({ tags: [tag('alternative r&b')], lyrics: SAD, cover: { light: 0.2, vibrance: 0.4 } }), idOf({ tags: [tag('hip hop')], lyrics: JOY, bpm: 150 })];
  const TWEAKS: (Tweaks | undefined)[] = [undefined, { appearance: { contrast: 0.8 } }, { appearance: { brightness: 1.4 } }, { appearance: { brightness: 0.6, contrast: 1.4 } }, { colors: { ink: '#777777', ground: '#808080' } }, { colors: { ink: '#000000', ground: '#000000' } }];

  it('ink, dim ink, active word and accent clear their contrast floors against BOTH ends of the ground, for every direction, cover and adjustment', () => {
    let n = 0;
    for (const dirId of NEW_DIRECTION_IDS)
      for (const cover of COVERS)
        for (const identity of ids)
          for (const tweaks of TWEAKS) {
            const { look } = composeLook({ direction: DIRECTIONS[dirId]!, identity, cover, tweaks });
            expect(look.ground && look.colors, dirId).toBeTruthy();
            const C = look.colors!;
            for (const g of look.ground!) {
              const where = `${dirId} cover=${COVERS.indexOf(cover)} tweaks=${JSON.stringify(tweaks)}`;
              expect(contrastRatio(C.ink, g), `ink ${where}`).toBeGreaterThanOrEqual(4.5);
              expect(contrastRatio(C.inkDim, g), `inkDim ${where}`).toBeGreaterThanOrEqual(4.4);
              expect(contrastRatio(C.active, g), `active ${where}`).toBeGreaterThanOrEqual(4.5);
              expect(contrastRatio(C.accent, g), `accent ${where}`).toBeGreaterThanOrEqual(3.5);
            }
            n++;
          }
    expect(n).toBe(NEW_DIRECTION_IDS.length * COVERS.length * ids.length * TWEAKS.length);
  });

  it('the cover is held back under the words until its worst colour still leaves the ink at 4.5:1', () => {
    for (const dirId of NEW_DIRECTION_IDS)
      for (const cover of COVERS.filter((c): c is CoverInfo => !!c)) {
        const { look } = composeLook({ direction: DIRECTIONS[dirId]!, identity: null, cover });
        // a full-bleed cover is the ground itself: there is nothing to hold back, each word chooses its colour against it instead
        if (look.artwork.treatment === 'bleed') continue;
        const g = look.ground!;
        const mid = mix(g[0], g[1], 0.5);
        const lum = luminance(look.colors!.ink);
        const worst = [...cover.palette!, cover.light > 0.6 ? '#ffffff' : '#000000'].sort((a, b) => Math.abs(luminance(a) - lum) - Math.abs(luminance(b) - lum))[0]!;
        const factor = look.artwork.treatment === 'cinema' ? 1.6 : look.artwork.treatment === 'card' || look.artwork.treatment === 'collage' ? 0.8 : 1;
        expect(contrastRatio(look.colors!.ink, mix(mid, worst, Math.min(1, look.style.artwork! * factor))), `${dirId} cover ${cover.palette![0]}`).toBeGreaterThanOrEqual(4.4);
      }
  });

  it('cover colours only tint a palette inside the direction\'s own bounds (a loud cover cannot take over Velvet)', () => {
    const loud: CoverInfo = { palette: ['#00ff00', '#ff00ff', '#00ffff', '#ffff00'], light: 0.6, vibrance: 1 };
    const { look } = composeLook({ direction: DIRECTIONS.velvet!, identity: null, cover: loud });
    const base = composeLook({ direction: DIRECTIONS.velvet!, identity: null, cover: null }).look;
    expect(contrastRatio(look.colors!.accent, base.colors!.accent)).toBeLessThan(2.5);
    expect(look.ground![0]).not.toBe('#00ff00');
  });

  it('intimate songs get calmer motion, urgent hip-hop gets 7:1 ink, melancholy softens saturated colour (and says so)', () => {
    const intimate = composeLook({ direction: DIRECTIONS.rhythm!, identity: idOf({ tags: [tag('hip hop')], lyrics: lyr(['I hold my own hand in the dark', 'I whisper to myself and my mind', 'my heart is quiet and my room is small', 'I tell myself I am okay', 'I am here with me and my thoughts', 'my own voice is soft tonight']), cover: { light: 0.3, vibrance: 0.3 } }), cover: null });
    expect(intimate.look.motion.intensity).toBeLessThanOrEqual(0.75 + 1e-9);
    const urgent = composeLook({ direction: DIRECTIONS.rhythm!, identity: songVisual({ track: { id: 'u', provider: 'demo', title: 'u', artists: ['u'], durationMs: 1 }, doc: parseLrc(FIXTURES.find((f) => f.id === 'concrete-verses')!.lrc), tags: tagsOf(FIXTURES.find((f) => f.id === 'concrete-verses')!), cover: null }).identity, cover: null });
    for (const g of urgent.look.ground!) expect(contrastRatio(urgent.look.colors!.ink, g)).toBeGreaterThanOrEqual(7);
    expect(urgent.notes.join(' ')).toMatch(/7:1/);
  });
});

describe('the listener has the last word', () => {
  const identity = idOf({ tags: [tag('alternative r&b')], lyrics: SAD });
  const cover = COVERS[1] ?? null;
  const base = { identity, cover, saved: [], familyDefaults: {}, autoTheme: true, fallback: 'maximalist' as StyleId };

  it('Auto follows the song; a pin overrides it; the choice Auto would make is still reported', () => {
    const auto = resolveLook({ ...base, song: null });
    const pinned = resolveLook({ ...base, song: { pick: { kind: 'direction', id: 'analog' }, tweaks: {} } });
    expect(auto.basis).toBe('auto');
    expect(pinned.basis).toBe('pinned');
    expect(pinned.direction).toBe('analog');
    expect(pinned.choice.direction).toBe(auto.direction);
  });

  it('turning Auto off uses the default style for songs without their own pick', () => {
    expect(resolveLook({ ...base, autoTheme: false, fallback: 'film', song: null }).direction).toBe('film');
  });

  it('adjustments change the look, resetting one returns exactly to the direction\'s own value, and none are applied by default', () => {
    const plain = resolveLook({ ...base, song: null });
    const adj = resolveLook({ ...base, song: { pick: { kind: 'auto' }, tweaks: { appearance: { grain: 0.3, textScale: 0.9 }, motion: { smooth: 0.1 } } } });
    expect(adj.look.appearance.grain).toBe(0.3);
    expect(adj.look.layout.textScale).toBe(0.9);
    expect(adj.look.motion.smooth).toBe(0.1);
    expect(adj.look.key).not.toBe(plain.look.key);
    const reset = resolveLook({ ...base, song: { pick: { kind: 'auto' }, tweaks: {} } });
    expect(reset.look.key).toBe(plain.look.key);
  });

  it('a saved theme is reusable: its direction and adjustments apply to any song, and this song\'s own tweaks layer on top', () => {
    const saved = [{ id: 't1', name: 'My night', base: 'nocturne' as StyleId, tweaks: { appearance: { grain: 0.25 } } as Tweaks, createdAt: 1 }];
    const a = resolveLook({ ...base, saved, song: { pick: { kind: 'saved', id: 't1' }, tweaks: {} } });
    const other = resolveLook({ ...base, identity: idOf({ tags: [tag('hip hop')], lyrics: JOY }), saved, song: { pick: { kind: 'saved', id: 't1' }, tweaks: {} } });
    expect(a.direction).toBe('nocturne');
    expect(other.direction).toBe('nocturne');
    expect(a.basis).toBe('saved');
    expect(a.savedName).toBe('My night');
    expect(a.look.appearance.grain).toBe(0.25);
    const layered = resolveLook({ ...base, saved, song: { pick: { kind: 'saved', id: 't1' }, tweaks: { appearance: { grain: 0.05 } } } });
    expect(layered.look.appearance.grain).toBe(0.05);
    // a deleted theme falls back to Auto instead of breaking
    expect(resolveLook({ ...base, saved: [], song: { pick: { kind: 'saved', id: 't1' }, tweaks: {} } }).basis).toBe('auto');
  });

  it('typography, palette and artwork choices are honoured, and a custom colour cannot break readability', () => {
    const { look } = composeLook({ direction: DIRECTIONS.velvet!, identity, cover, tweaks: { typography: 'poster', paletteId: 'broadsheet-news', artwork: 'cinema', scene: 'none' } });
    expect(look.style.fonts[look.style.displayFont].family).toBe('Bebas Neue');
    expect(look.ground![0]).not.toBe(PALETTES.find((p) => p.id === 'velvet-night')!.ground[0]);
    expect(look.artwork.treatment).toBe('cinema');
    expect(look.style.scene).toBeUndefined();
    const bad = composeLook({ direction: DIRECTIONS.velvet!, identity, cover, tweaks: { colors: { ink: '#303030', ground: '#2a2a2a' } } }).look;
    for (const g of bad.ground!) expect(contrastRatio(bad.colors!.ink, g)).toBeGreaterThanOrEqual(4.5);
  });

  it('mergeTweaks layers groups instead of replacing them', () => {
    const m = mergeTweaks({ motion: { smooth: 0.3 }, appearance: { grain: 0.1 } }, { motion: { beat: 0.5 }, appearance: { grain: 0.2 } });
    expect(m).toEqual({ motion: { smooth: 0.3, beat: 0.5 }, appearance: { grain: 0.2 } });
  });
});

describe('the art directions are composed, not random', () => {
  it('every new direction has its own style, calm ones carry no decoration, and each keeps its promised character', () => {
    for (const id of NEW_DIRECTION_IDS) {
      expect(STYLES[id], id).toBeDefined();
      expect(DIRECTIONS[id]!.palettes.length, id).toBeGreaterThan(0);
    }
    for (const id of ['velvet', 'ether', 'nocturne', 'artbook', 'stillness', 'broadsheet'] as StyleId[]) {
      expect(STYLES[id]!.decor, id).toBe(0);
      expect(STYLES[id]!.presetPolicy, id).toBeTruthy();
      expect(STYLES[id]!.maskWords, id).toBe(false);
    }
    expect(STYLES.disorder!.fontMix).toBe(true);
    expect(STYLES.rhythm!.presetPolicy).toBeUndefined();
  });

  it('R&B directions are visually distinct from one another (ground, type and artwork all differ)', () => {
    const a = ['velvet', 'ether', 'nocturne'].map((id) => composeLook({ direction: DIRECTIONS[id as StyleId]!, identity: null, cover: null }).look);
    expect(new Set(a.map((l) => l.ground![0])).size).toBe(3);
    expect(new Set(a.map((l) => l.style.fonts[l.style.displayFont].family)).size).toBeGreaterThanOrEqual(2);
    expect(new Set(a.map((l) => l.style.scene)).size).toBe(3);
  });
});
