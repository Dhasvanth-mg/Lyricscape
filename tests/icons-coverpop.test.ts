// The custom icon set (no emoji anywhere) and the Cover Pop mode.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { compileTimeline, splitPhrases } from '@/lib/kinetic/compile';
import { EMOTION_DEFS, EMOTIONS } from '@/lib/kinetic/emotion';
import { computeFrame } from '@/lib/kinetic/frame';
import { ICON_IDS, ICONS, iconColors, iconForWord, iconKey } from '@/lib/kinetic/icons';
import { STYLES, estimateWidth } from '@/lib/kinetic/styles';
import type { FrameEnv, WordCue } from '@/lib/kinetic/types';
import { contrastRatio } from '@/lib/kinetic/util';
import { parseLrc } from '@/lib/lyrics/parse';
import { DIRECTIONS } from '@/lib/theme/directions';
import { songVisual } from '@/lib/theme/pipeline';
import type { Track } from '@/lib/types';

const ROLES = ['main', 'dark', 'light', 'white', 'ink'];

describe('the custom icon set', () => {
  it('every icon is a handful of valid shapes with a hue, on a 24-unit grid', () => {
    expect(ICON_IDS.length).toBeGreaterThanOrEqual(40);
    for (const id of ICON_IDS) {
      const def = ICONS[id];
      expect(def.hue, id).toMatch(/^#[0-9a-f]{6}$/i);
      expect(def.parts.length, id).toBeGreaterThan(0);
      for (const p of def.parts) {
        expect(ROLES, `${id} role`).toContain(p.r);
        expect(p.d, `${id} path`).toMatch(/^M[\d .,\-A-Za-z]+$/);
        expect(p.d, `${id} path has no NaN`).not.toMatch(/NaN|undefined|Infinity/);
        if (p.s !== undefined) expect(p.s).toBeGreaterThan(0);
        if (p.o !== undefined) expect(p.o).toBeGreaterThan(0);
      }
      // every number in the path stays on (or just off) the 24 grid: nothing drawn way outside its box
      const nums = (def.parts.map((p) => p.d).join(' ').match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
      expect(Math.max(...nums.map(Math.abs)), `${id} extent`).toBeLessThan(40);
    }
  });

  it('every word, mood and mood-shower entry resolves to an icon that exists', () => {
    for (const w of ['love', 'fire', 'moon', 'hours', 'ocean', 'wings', 'crown', 'money', 'signal', 'storm', 'broken', 'smile']) expect(ICON_IDS, w).toContain(iconForWord(w));
    expect(iconForWord('the')).toBeNull();
    expect(iconForWord('Love,')).toBe('heart');
    for (const e of EMOTIONS) {
      const d = EMOTION_DEFS[e];
      expect(ICON_IDS).toContain(d.icon);
      for (const i of d.iconSet) expect(ICON_IDS).toContain(i);
    }
  });

  it('tones come from the icon\'s own hue pulled toward the accent: dark is darker, light is lighter, and the same inputs give the same key', () => {
    const c = iconColors('heart', '#38c7ff');
    expect(contrastRatio(c.dark, '#000000')).toBeLessThan(contrastRatio(c.main, '#000000'));
    expect(contrastRatio(c.light, '#ffffff')).toBeLessThan(contrastRatio(c.main, '#ffffff'));
    expect(iconKey('heart', c)).toBe(iconKey('heart', iconColors('heart', '#38c7ff')));
    expect(iconKey('heart', c)).not.toBe(iconKey('heart', iconColors('heart', '#ffc21a')));
  });

  it('there is no emoji left anywhere in the app\'s source (every glyph is the custom set)', () => {
    const roots = ['app', 'components', 'lib', 'workers'];
    // emoji, emoji presentation selectors, and pictographic dingbats (stars, ticks, crosses); plain arrows are typography and fine
    const re = /[\u{1F000}-\u{1FAFF}\u{2300}-\u{23FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u;
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) {
          if (name !== 'node_modules' && name !== '.next') walk(p);
        } else if (/\.(ts|tsx|mjs|css|json)$/.test(name) && re.test(readFileSync(p, 'utf8'))) hits.push(p);
      }
    };
    for (const r of roots) {
      try {
        walk(r);
      } catch {
        /* folder absent */
      }
    }
    expect(hits).toEqual([]);
  });
});

describe('Cover Pop', () => {
  const COVER = { palette: ['#ff4f9a', '#ffe27a', '#7a4aff', '#2a0f3a'], light: 0.4, vibrance: 0.7 };
  const track: Track = { id: 'cp', provider: 'demo', title: 'cp', artists: ['x'], durationMs: 200000 };
  const LRC = [
    '[00:05.00] <00:05.00>I <00:05.20>know <00:05.70>you <00:06.10>love <00:06.60>to <00:07.00>show <00:07.40>off',
    '[00:09.00] <00:09.00>But <00:09.40>I <00:09.60>never <00:10.10>thought <00:10.60>that <00:10.90>you <00:11.20>would <00:11.50>take <00:11.80>it <00:12.00>this <00:12.30>far',
    '[00:15.00] <00:15.00>and <00:15.30>that <00:15.60>is <00:15.90>all',
  ].join('\n');
  const visual = (lrc = LRC, estimateWords = true) => songVisual({ track, doc: parseLrc(lrc), tags: [], cover: COVER, song: { pick: { kind: 'direction', id: 'coverpop' }, tweaks: {} }, estimateWords });
  const envFor = (v: ReturnType<typeof visual>): FrameEnv => ({ width: 1280, height: 720, reducedMotion: false, look: v.resolved.look, measure: (t, f, s) => estimateWidth(t, v.resolved.look.style.fonts[f], s) });

  it('is a mode you choose, never one Auto switches to by itself', () => {
    expect(DIRECTIONS.coverpop!.fit({ identity: null, cover: null }).score).toBe(0);
    expect(STYLES.coverpop!.adapt).toBe(true);
    expect(STYLES.coverpop!.fonts.body.family).toBe('Nunito');
  });

  it('shows the cover whole and undimmed, with hot type from the cover and almost no scrim', () => {
    const v = visual();
    const { look } = v.resolved;
    expect(look.artwork.treatment).toBe('bleed');
    expect(look.style.artwork).toBe(1);
    const f = computeFrame(v.timeline, 6000, envFor(v));
    expect(f.artwork.treatment).toBe('bleed');
    expect(f.overlays.scrim).toBeLessThan(0.05);
    expect(f.caption).toBeNull(); // no quiet next-line preview: the words are the show
    expect(f.doodles).toHaveLength(0);
    // the hot colour is saturated and bright (pushed from the cover's most vivid colour)
    const hot = look.colors!.active;
    expect(contrastRatio(hot, look.ground![0])).toBeGreaterThan(4.5);
  });

  it('splits lines with word times into short phrases of 1 to 3 big words (4 when tiny), covering every word once, in order', () => {
    const v = visual();
    const line1 = v.timeline.scenes.filter((s) => s.lineIndex === 0);
    expect(line1.length).toBeGreaterThanOrEqual(2);
    for (const s of v.timeline.scenes) {
      expect(s.words.length).toBeGreaterThanOrEqual(1);
      expect(s.words.length).toBeLessThanOrEqual(4);
    }
    const ids = v.timeline.scenes.flatMap((s) => s.words.map((w) => w.id));
    expect(ids).toEqual(v.timeline.cues.map((c) => c.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('hands the stage over before the next phrase lands, so two phrases never share it', () => {
    const v = visual();
    const s = v.timeline.scenes;
    for (let i = 0; i + 1 < s.length; i++) {
      if (s[i]!.lineIndex !== s[i + 1]!.lineIndex) continue;
      expect(s[i]!.endMs, `${s[i]!.id} -> ${s[i + 1]!.id}`).toBeLessThanOrEqual(s[i + 1]!.startMs - 70 + 1);
    }
  });

  it('never splits a line whose words have no times (that would invent timing), and cue times are unchanged', () => {
    const v = visual(LRC.replace(/<[^>]+>/g, ''), false);
    const perLine = new Map<number, number>();
    for (const sc of v.timeline.scenes) perLine.set(sc.lineIndex, (perLine.get(sc.lineIndex) ?? 0) + 1);
    expect([...perLine.values()].every((n) => n === 1)).toBe(true);
    const plain = songVisual({ track, doc: parseLrc(LRC), tags: [], cover: COVER, song: { pick: { kind: 'direction', id: 'maximalist' }, tweaks: {} } });
    expect(JSON.stringify(visual().timeline.cues.map((c) => [c.startMs, c.endMs]))).toBe(JSON.stringify(plain.timeline.cues.map((c) => [c.startMs, c.endMs])));
  });

  it('splitPhrases breaks at punctuation and at audible gaps', () => {
    const w = (text: string, s: number, e: number): WordCue => ({ id: text + s, text, startMs: s, endMs: e });
    const g = splitPhrases([w('hello,', 0, 300), w('my', 320, 500), w('dear', 520, 800), w('friend', 3000, 3400), w('yes', 3420, 3700)]);
    expect(g.map((x) => x.map((c) => c.text))).toEqual([['hello,'], ['my', 'dear'], ['friend', 'yes']]);
  });

  it('each phrase carries at most one white chip (the heaviest word), chips read, and the other words get colour candidates', () => {
    const v = visual();
    const env = envFor(v);
    let chips = 0;
    let adapt = 0;
    for (const sc of v.timeline.scenes) {
      const mid = (sc.startMs + sc.endMs) / 2 + 200;
      const f = computeFrame(v.timeline, Math.max(sc.startMs + 400, mid), env);
      const here = f.words.filter((w) => sc.words.some((c) => c.id === w.id));
      const c = here.filter((w) => w.chip);
      expect(c.length).toBeLessThanOrEqual(1);
      for (const w of c) expect(contrastRatio(w.fill, w.chip!)).toBeGreaterThanOrEqual(4.5);
      chips += c.length;
      for (const w of here.filter((x) => !x.chip)) {
        expect(w.adapt!.length).toBeGreaterThanOrEqual(2);
        adapt++;
      }
    }
    expect(chips).toBeGreaterThan(0);
    expect(adapt).toBeGreaterThan(0);
  });

  it('puts a custom icon next to words that have one (no emoji glyphs), and never decorative doodles', () => {
    const v = visual('[00:05.00] <00:05.00>my <00:05.50>love <00:06.20>is <00:06.60>fire <00:07.00>tonight\n[00:12.00] <00:12.00>end');
    const f = computeFrame(v.timeline, 6600, envFor(v));
    expect(f.icons.some((i) => i.icon === 'heart')).toBe(true);
    expect(f.icons.every((i) => ICON_IDS.includes(i.icon))).toBe(true);
    expect(f.doodles).toHaveLength(0);
  });

  it('stays readable in motion: no two landed words of a phrase overlap, at phone and desktop sizes', () => {
    const v = visual();
    for (const [W, H] of [[390, 844], [1280, 720], [1920, 1080]] as const) {
      const env: FrameEnv = { ...envFor(v), width: W, height: H };
      for (const sc of v.timeline.scenes) {
        const t = Math.min(sc.endMs - 20, Math.max(...sc.words.map((c) => c.startMs)) + 700);
        const f = computeFrame(v.timeline, t, env);
        const boxes = f.words.filter((w) => sc.words.some((c) => c.id === w.id) && w.alpha > 0.9).map((w) => {
          const width = estimateWidth(w.text, v.resolved.look.style.fonts[w.font], w.sizePx) * Math.abs(w.scaleX);
          return { id: w.id, x0: w.x - width / 2, x1: w.x + width / 2, y: w.y, h: w.sizePx * Math.abs(w.scaleY), w: width };
        });
        for (let i = 0; i < boxes.length; i++)
          for (let j = i + 1; j < boxes.length; j++) {
            const a = boxes[i]!;
            const b = boxes[j]!;
            if (Math.abs(a.y - b.y) > 0.55 * Math.min(a.h, b.h)) continue;
            expect(Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), `${W}x${H} ${a.id}/${b.id}`).toBeLessThanOrEqual(0.1 * Math.min(a.w, b.w));
          }
      }
    }
  });

  it('is deterministic and does not touch lyric timing', () => {
    expect(JSON.stringify(visual().timeline)).toBe(JSON.stringify(visual().timeline));
    const t = compileTimeline(parseLrc(LRC), { trackId: 'q', durationMs: 60000, palette: COVER.palette, style: 'coverpop' });
    expect(t.cues.map((c) => c.startMs)).toEqual(parseLrc(LRC).lines.flatMap((l) => l.words.map((w) => w.startMs)));
  });
});
