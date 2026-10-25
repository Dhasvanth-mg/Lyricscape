// The six Turbo styles: the registry, what a style changes about a Look, and the pure parts of the reference scenes (no GPU needed).
import { describe, expect, it } from 'vitest';
import { TURBO_STYLES, TURBO_STYLE_IDS, isSceneStyle, isTurboStyle, planStage, turboLook } from '@/lib/kinetic/turbo';
import { SHOT_ORDER, shotFor } from '@/lib/kinetic/gl/scenes/terminal';
import { lineAt, typedChars } from '@/lib/kinetic/gl/scenes/common';
import { SUBJECTS, pickSubject, subjectIndex } from '@/lib/kinetic/gl/scenes/subject';
import { songVisual } from '@/lib/theme/pipeline';
import { parseLrc } from '@/lib/lyrics/parse';
import type { Track } from '@/lib/types';

const track: Track = { id: 'fixture:t', provider: 'demo', title: 't', artists: ['x'], durationMs: 120000 };
const vis = songVisual({ track, doc: parseLrc('[00:02.00] a b c d\n[00:06.00] e f g h\n[00:12.00] a long line of words to type into the screen'), tags: [], cover: { palette: ['#d98b3a', '#a8465a', '#5a2a4a', '#1a0d12'], light: 0.3, vibrance: 0.5 }, song: { pick: { kind: 'direction', id: 'maximalist' }, tweaks: {} } });
const look = vis.resolved.look;

describe('turbo styles', () => {
  it('has six, each described; all but liquid light are reference scenes', () => {
    expect(TURBO_STYLE_IDS).toHaveLength(6);
    for (const id of TURBO_STYLE_IDS) {
      expect(isTurboStyle(id)).toBe(true);
      expect(TURBO_STYLES[id].label).toBeTruthy();
      expect(TURBO_STYLES[id].tagline.length).toBeGreaterThan(30);
      expect(isSceneStyle(id)).toBe(id !== 'liquid');
    }
    expect(isTurboStyle('neon')).toBe(false);
    expect(new Set(TURBO_STYLE_IDS.map((i) => TURBO_STYLES[i].label)).size).toBe(6);
  });

  it('only the key changes with the style; colours, palette and layout are the direction’s; motion caps hold', () => {
    const keys = new Set<string>();
    for (const id of TURBO_STYLE_IDS) {
      const t = turboLook(look, id);
      keys.add(t.key);
      expect(t.colors).toEqual(look.colors);
      expect(t.palette).toEqual(look.palette);
      expect(t.layout).toEqual(look.layout);
      expect(t.motion.intensity).toBeLessThanOrEqual(2);
    }
    expect(keys.size).toBe(6);
  });

  it('the stage plan stays in range for every mood', () => {
    for (const arousal of [0, 0.4, 0.9]) {
      const p = planStage({ arousal, scene: null, hasCover: true, artAmount: 0.5, hook: arousal > 0.8 });
      expect(p.amount).toBeGreaterThan(0.5);
      expect(p.amount).toBeLessThan(1.4);
      expect(p.coverMix).toBeGreaterThan(0);
    }
    expect(planStage({ arousal: 0.5, scene: null, hasCover: false, artAmount: 0.5, hook: false }).coverMix).toBe(0);
  });
});

describe('reference scenes: the line that is on', () => {
  const tl = vis.timeline;
  it('finds the line, with a short lead, and nothing in the gaps', () => {
    expect(lineAt(tl, 500)).toBeNull();
    const a = lineAt(tl, 2100)!;
    expect(a.i).toBe(0);
    expect(a.text).toBe('a b c d');
    expect(a.p).toBeGreaterThanOrEqual(0);
    expect(a.p).toBeLessThanOrEqual(1);
    expect(lineAt(tl, 6100)!.i).toBe(1);
    // long after the last line has ended: nothing is shown
    expect(lineAt(tl, 90000)).toBeNull();
  });

  it('typing runs from nothing to everything and never overshoots', () => {
    const text = 'Feel like a brand new person';
    expect(typedChars(text, 0, 200, 1500)).toBe(0);
    expect(typedChars(text, 5000, 200, 1500)).toBe(text.length);
    let last = -1;
    for (let a = 0; a < 3000; a += 100) {
      const n = typedChars(text, a, 200, 1500);
      expect(n).toBeGreaterThanOrEqual(last);
      last = n;
    }
  });

  it('the code-screens clip cycles its shots in the order it was cut, and never puts a long line in big words', () => {
    expect(SHOT_ORDER[0]).toBe('code');
    expect(SHOT_ORDER).toContain('errors');
    expect(SHOT_ORDER).toContain('form');
    expect(SHOT_ORDER).toContain('banner');
    expect(SHOT_ORDER).toContain('console');
    const line = (i: number, text: string) => ({ i, text }) as Parameters<typeof shotFor>[0];
    expect(shotFor(line(0, 'hello'))).toBe('code');
    expect(shotFor(line(2, 'hello'))).toBe('errors');
    const bigIdx = SHOT_ORDER.indexOf('big');
    expect(shotFor(line(bigIdx, 'I know'))).toBe('big');
    expect(shotFor(line(bigIdx, 'this is a very long line that cannot be huge'))).toBe('console');
  });
});

describe('the ASCII scene picks its picture from the song', () => {
  it('a word in the title decides: E85 is a highway, whatever the verses say', () => {
    expect(pickSubject('E85 Don Toliver', 'light the night run the red light neon static light')).toBe('highway');
    expect(pickSubject('Flashing Lights', '')).toBe('lights');
    expect(pickSubject('Ocean Eyes', '')).toBe('ocean');
  });
  it('without a title word, the lyrics’ most frequent theme (three hits at least)', () => {
    expect(pickSubject('Untitled', 'drive drive the car down the road tonight')).toBe('highway');
    expect(pickSubject('Untitled', 'one stray star')).toBe('eye');
  });
  it('then the mood, then the eye', () => {
    expect(pickSubject('Untitled', 'la la', { arousal: 0.9, valence: 0.5 })).toBe('lights');
    expect(pickSubject('Untitled', 'la la', { arousal: 0.2, valence: -0.6 })).toBe('rain');
    expect(pickSubject('Untitled', 'la la', { arousal: 0.5, valence: 0 })).toBe('eye');
  });
  it('every subject has a shader index', () => {
    expect(new Set(SUBJECTS.map(subjectIndex)).size).toBe(SUBJECTS.length);
  });
});
