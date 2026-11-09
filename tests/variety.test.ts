import { describe, expect, it } from 'vitest';
import { combos, hashKey, paperSet, seeded } from '@/lib/kinetic/variety';
import { doodleVariant, DOODLE_ORNAMENTS, DOODLE_TREATMENTS } from '@/lib/kinetic/doodles';
import { iconVariant, ICON_TREATMENTS } from '@/lib/kinetic/icons';
import { acidVariant, CREATURES } from '@/lib/kinetic/gl/scenes/acid';
import { BORDER_KINDS, DOODLE_KINDS, FONT_SETS, themeFor } from '@/lib/kinetic/gl/scenes/sketch';
import { CODE_THEMES, SHOT_ORDER, SHOT_ORDERS, shotFor, terminalVariant } from '@/lib/kinetic/gl/scenes/terminal';
import { ASCII_RAMPS, asciiVariant } from '@/lib/kinetic/gl/scenes/ascii';
import { APP_SCREEN_LOOKS, APP_SCREENS } from '@/lib/kinetic/gl/scenes/screens';

const songs = Array.from({ length: 60 }, (_, i) => `track-${i}`);

describe('generated-graphics variety', () => {
  it('every pick is a pure function of its seed (replays and exports match the screen)', () => {
    expect(JSON.stringify(paperSet(seeded(42), 0.3))).toBe(JSON.stringify(paperSet(seeded(42), 0.3)));
    expect(acidVariant(7, [0.2])).toEqual(acidVariant(7, [0.2]));
    expect(themeFor(9, [0.6])).toEqual(themeFor(9, [0.6]));
    expect(doodleVariant(5)).toEqual(doodleVariant(5));
    expect(iconVariant('a|3')).toBe(iconVariant('a|3'));
    expect(terminalVariant('t', 1, ['#ff0000'])).toEqual(terminalVariant('t', 1, ['#ff0000']));
    expect(asciiVariant('t', 1, ['#ff0000'])).toEqual(asciiVariant('t', 1, ['#ff0000']));
  });

  it('offers hundreds of options per family', () => {
    expect(combos(BORDER_KINDS.length, DOODLE_KINDS.length, FONT_SETS.length)).toBeGreaterThan(1000);
    expect(CREATURES.length).toBeGreaterThanOrEqual(10);
    expect(combos(DOODLE_TREATMENTS.length, DOODLE_ORNAMENTS.length)).toBeGreaterThanOrEqual(60);
    expect(ICON_TREATMENTS.length).toBeGreaterThanOrEqual(10);
    expect(combos(CODE_THEMES.length, SHOT_ORDERS.length)).toBeGreaterThan(100);
    expect(ASCII_RAMPS.length).toBeGreaterThanOrEqual(10);
  });

  it('different songs get different code screens and ASCII looks', () => {
    const themes = new Set(songs.map((s) => terminalVariant(s, 0, ['#3366ff']).theme.id));
    const orders = new Set(songs.map((s) => terminalVariant(s, 0, undefined).order));
    const ramps = new Set(songs.map((s) => asciiVariant(s, 0, ['#3366ff']).ramp));
    expect(themes.size).toBeGreaterThan(6);
    expect(orders.size).toBeGreaterThan(3);
    expect(ramps.size).toBeGreaterThan(4);
  });

  it('every cut order opens on the code editor and still uses every screen', () => {
    for (const o of SHOT_ORDERS) {
      expect(o[0]).toBe('code');
      for (const s of SHOT_ORDER) expect(o).toContain(s);
    }
    const v = terminalVariant('any', 0, undefined);
    for (const s of [...SHOT_ORDER, ...APP_SCREENS]) expect(v.order).toContain(s);
    expect(APP_SCREEN_LOOKS).toBeGreaterThan(100);
    const line = { i: 1, text: 'hi' } as Parameters<typeof shotFor>[0];
    expect(shotFor(line, SHOT_ORDERS[1])).toBe('errors');
  });

  it('a seed spreads across a family', () => {
    const seen = new Set(Array.from({ length: 200 }, (_, i) => iconVariant(`x|${hashKey(String(i))}`)));
    expect(seen.size).toBe(ICON_TREATMENTS.length);
  });
});

describe('ASCII pictures through a song', () => {
  it('changes picture every few lines, never the same twice running, and not always the eye', async () => {
    const { asciiSection } = await import('@/lib/kinetic/gl/scenes/ascii');
    const subs = Array.from({ length: 20 }, (_, k) => asciiSection('song-x', 3, ['#ff8800'], 'eye', k).subject);
    for (let k = 1; k < subs.length; k++) expect(subs[k]).not.toBe(subs[k - 1]);
    expect(new Set(subs).size).toBeGreaterThan(8);
    const openers = new Set(songs.map((s) => asciiSection(s, 0, undefined, 'eye', 0).subject));
    expect(openers.size).toBeGreaterThan(6);
    expect(asciiSection('a', 1, undefined, 'highway', 0).subject).toBe('highway');
  });
});

describe('shared art library', () => {
  it('holds 300+ distinct drawings in many families, picked by tag', async () => {
    const { ART_IDS, ART_FAMILIES, artWithTag, pickArt, artFamily } = await import('@/lib/kinetic/art/library');
    expect(ART_IDS.length).toBeGreaterThanOrEqual(300);
    expect(new Set(ART_IDS).size).toBe(ART_IDS.length);
    expect(Object.keys(ART_FAMILIES).length).toBeGreaterThanOrEqual(12);
    for (const id of artWithTag('love')) expect(['flower', 'heart']).toContain(artFamily(id));
    expect(pickArt(5, 'night')).toBe(pickArt(5, 'night'));
    expect(new Set(Array.from({ length: 400 }, (_, i) => pickArt(hashKey(String(i))))).size).toBeGreaterThan(150);
  });
  it('doodles mostly come from the library, fixed by their seed', async () => {
    const { doodleArt } = await import('@/lib/kinetic/doodles');
    const picks = Array.from({ length: 300 }, (_, i) => doodleArt('heart', i));
    expect(picks.filter(Boolean).length).toBeGreaterThan(150);
    expect(doodleArt('star', 9)).toBe(doodleArt('star', 9));
  });
});
