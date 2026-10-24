// Lyric motion: when words land relative to their cue, readability rules for long lines, the contrast scrim.
import { describe, expect, it } from 'vitest';
import { compileTimeline } from '@/lib/kinetic/compile';
import { computeFrame } from '@/lib/kinetic/frame';
import { parseLrc } from '@/lib/lyrics/parse';
import { PRESET_IDS, STYLE_IDS, type FrameEnv, type PresetId } from '@/lib/kinetic/types';
import { STYLES } from '@/lib/kinetic/styles';

const env: FrameEnv = { width: 1280, height: 720, reducedMotion: false };
const opts = { trackId: 'land', durationMs: 60_000, palette: ['#ff2e63', '#ffd23f', '#08d9d6', '#1a1a2e'], bpm: 100, seed: 7 };
const doc = parseLrc('[00:10.00] <00:10.00>hello <00:10.60>there <00:11.20>my <00:11.70>friend\n[00:16.00] <00:16.00>next <00:16.50>line <00:17.00>of <00:17.40>words');

function timelineWith(preset: PresetId, style: (typeof STYLE_IDS)[number] = 'maximalist') {
  const tl = compileTimeline(doc, { ...opts, style });
  tl.scenes[0]!.preset = preset;
  return tl;
}

describe('entrance presets land on the cue, not after it', () => {
  // "landed" = reached its resting position, size and opacity (within 1 % of the frame, 12 % of size) and stayed there
  function landing(preset: PresetId) {
    const tl = timelineWith(preset);
    const target = tl.scenes[0]!.words[1]!;
    const T = target.startMs;
    const final = computeFrame(tl, T + 1300, env).words.find((w) => w.id === target.id)!;
    let first = NaN;
    let landed = NaN;
    for (let d = -400; d <= 1300; d += 10) {
      const w = computeFrame(tl, T + d, env).words.find((x) => x.id === target.id);
      const a = w?.alpha ?? 0;
      if (Number.isNaN(first) && a > 0.05) first = d;
      if (w && !Number.isNaN(first)) {
        const near = Math.abs(w.x - final.x) < 0.012 * env.width && Math.abs(w.y - final.y) < 0.012 * env.height && Math.abs(w.scaleX / final.scaleX - 1) < 0.12 && Math.abs(w.rotationDeg - final.rotationDeg) < 2 && a > 0.95;
        if (near && Number.isNaN(landed)) landed = d;
        if (!near) landed = NaN;
      }
    }
    return { first, landed };
  }

  for (const preset of PRESET_IDS.filter((p) => p !== 'wave' && p !== 'cut')) {
    it(`${preset}: first visible no more than 100 ms early, landed within 220 ms of the cue`, () => {
      const { first, landed } = landing(preset);
      expect(first).toBeGreaterThanOrEqual(-100);
      expect(landed).toBeLessThanOrEqual(220);
    });
  }

  it('drop used to land 350 ms late (a 460 ms fall); it now lands well inside that', () => {
    expect(landing('drop').landed).toBeLessThan(250);
  });
});

describe('long lines stay readable', () => {
  const short = parseLrc('[00:10.00] one two three four');
  const long = parseLrc('[00:10.00] ' + Array.from({ length: 14 }, (_, i) => `w${i}`).join(' '));
  const maxRot = (d: ReturnType<typeof parseLrc>) => {
    const tl = compileTimeline(d, { ...opts, style: 'maximalist' });
    tl.scenes[0]!.preset = 'burst';
    let m = 0;
    for (let t = 9900; t < 12500; t += 20) for (const w of computeFrame(tl, t, env).words) m = Math.max(m, Math.abs(w.rotationDeg));
    return m;
  };
  it('a 14-word line is rotated far less than a 4-word line on the same preset', () => {
    expect(maxRot(long)).toBeLessThan(maxRot(short) * 0.7);
  });
});

describe('readability scrim and the cover', () => {
  it('there is a soft scrim behind the words in every style, lighter in an instrumental break', () => {
    for (const style of STYLE_IDS) {
      const tl = compileTimeline(doc, { ...opts, style });
      const during = computeFrame(tl, 10_800, env).overlays;
      // full-bleed art (Cover Pop) deliberately carries almost no pool: its words pick their colour against the art itself
      const mult = STYLES[style].scrim ?? 1;
      expect(during.scrim).toBeGreaterThan(0.15 * mult - 1e-9);
      expect(during.scrim).toBeLessThan(0.4);
      const gap = computeFrame(tl, 4000, env).overlays; // intro: nobody singing
      expect(gap.scrim).toBeLessThanOrEqual(during.scrim);
    }
  });
  it('a dark pool for light text and a light pool for dark text', () => {
    const dark = compileTimeline(doc, { ...opts, style: 'neon' });
    const light = compileTimeline(doc, { ...opts, style: 'gloss' });
    expect(computeFrame(dark, 10_800, env).overlays.scrimDark).toBe(true);
    expect(computeFrame(light, 10_800, env).overlays.scrimDark).toBe(false);
  });
});
