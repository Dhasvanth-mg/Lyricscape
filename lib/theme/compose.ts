// composeLook(): an art direction + the song's identity + the cover + the listener's adjustments -> one resolved Look.
//
// Constraints are applied here, not hoped for later:
//   - ink reaches 5:1 against BOTH ends of the ground (7:1 for urgent, hard-hitting material); the dimmer inks keep their own floors;
//   - the cover may tint the palette only within the direction's saturation and lightness bounds;
//   - the cover's strength under the words is capped so the worst colour in the cover still leaves the ink at 4.5:1;
//   - intimate songs get calmer motion; melancholy ones lose their most saturated colours.
// The listener's adjustments are applied before the floors, so no slider can take a look below readable.

import { STYLES } from '../kinetic/styles';
import type { StyleDef } from '../kinetic/styleBase';
import type { Look } from '../kinetic/look';
import { hashString, luminance } from '../kinetic/util';
import { knownDim, type SongIdentity } from '../identity/types';
import { capSat, contrastRatio, ensureContrast, harmonize, hslOf, hslToHex, mix, pushGround, scaleLightness } from './color';
import { PALETTE, treatmentOf } from './directions';
import { TYPE_PAIR } from './typography';
import type { CoverInfo, Direction, PaletteSpec, PickContext, Tweaks } from './types';

const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const known = (id: SongIdentity | null, k: keyof SongIdentity['emotional'], conf = 0.3): number | null => knownDim(id, k, conf);

export type ComposeInput = {
  direction: Direction;
  secondary?: { direction: Direction; weight: number } | null;
  identity: SongIdentity | null;
  cover: CoverInfo | null;
  tweaks?: Tweaks;
};
export type Composed = { look: Look; notes: string[] };

/** A flat field taken from a cover colour: moderately saturated, mid-light, so white or near-black type both have a chance. */
function field(color: string): string {
  const [h, s, l] = hslOf(color);
  return hslToHex(h, Math.min(s, 0.8), clamp(l, 0.34, 0.5));
}

function resolvePalette(spec: PaletteSpec, cover: CoverInfo | null, T: Tweaks) {
  const a = cover?.palette ?? [];
  const k = spec.coverInfluence;
  let ground: [string, string];
  if (spec.ground === 'coverDark') {
    // the art IS the ground: this is only the dark colour under it, used for contrast bookkeeping
    const g0 = a[0] ? hslToHex(hslOf(a[0])[0], Math.min(hslOf(a[0])[1], 0.55), 0.14) : '#1a0f1e';
    ground = [g0, a[1] ? hslToHex(hslOf(a[1])[0], Math.min(hslOf(a[1])[1], 0.5), 0.2) : mix(g0, '#ffffff', 0.08)];
  } else if (spec.ground === 'cover') {
    const g0 = field(a[0] ?? '#ff5e7a');
    ground = [g0, mix(g0, field(a[1] ?? mix(g0, '#ffffff', 0.15)), 0.35)];
  } else {
    const dark = a[3];
    ground = spec.ground.map((c) => {
      if (!dark) return c;
      const m = mix(c, dark, k * 0.35);
      const [, , l0] = hslOf(c);
      const [h, s, l] = hslOf(m);
      return hslToHex(h, s, clamp(l, l0 - 0.05, l0 + 0.05));
    }) as [string, string];
  }
  if (T.colors?.ground) ground = [T.colors.ground, mix(T.colors.ground, '#000000', 0.18)];
  let ink = T.colors?.ink ?? spec.ink;
  let inkDim = T.colors?.ink ? mix(ink, ground[0], 0.45) : spec.inkDim;
  let active = harmonize(a[1] ?? a[0], T.colors?.active ?? spec.active, T.colors?.active ? 0 : k * 0.5, spec.maxSat);
  const accent = harmonize(a[0], T.colors?.accent ?? spec.accent, T.colors?.accent ? 0 : k, spec.maxSat);
  if (spec.ground === 'cover' && !T.colors?.ink) {
    // type on a colour field: white or near-black, whichever reads better; the active word takes the other
    const worst = (c: string) => Math.min(...ground.map((g) => contrastRatio(c, g)));
    const light = '#ffffff';
    const dark = '#15131a';
    ink = worst(light) >= worst(dark) ? light : dark;
    active = ink === light ? dark : light;
    inkDim = mix(ink, ground[0], 0.28);
  }
  const palette = spec.palette.map((c, i) => (i < 3 ? harmonize(a[i], c, k, spec.maxSat) : ground[0])) as [string, string, string, string];
  let hotAccent = accent;
  if (spec.vivid) {
    // hot type: the cover's own most vivid colour, pushed bright and saturated so it pops off the art
    const hot = (c: string | undefined, fallback: string) => {
      const [h, s, l] = hslOf(c ?? fallback);
      return hslToHex(h, Math.max(s, 0.82), Math.min(0.66, Math.max(l, 0.55)));
    };
    active = hot(a[0], spec.active);
    hotAccent = hot(a[1] ?? a[0], spec.accent);
  }
  return { ground, ink, inkDim, active, accent: hotAccent, support: spec.support, palette };
}

/** The cover's strength under the words, reduced until even the cover colour that hurts the ink most still leaves 4.5:1. */
function capArt(alpha: number, ink: string, grounds: string[], cover: CoverInfo | null, factor: number): number {
  if (!cover?.palette?.length) return alpha;
  const mid = mix(grounds[0]!, grounds[1] ?? grounds[0]!, 0.5);
  const lum = luminance(ink);
  const worst = [...cover.palette, cover.light > 0.6 ? '#ffffff' : '#000000'].sort((x, y) => Math.abs(luminance(x) - lum) - Math.abs(luminance(y) - lum))[0]!;
  let a = alpha;
  for (let i = 0; i < 14 && contrastRatio(ink, mix(mid, worst, Math.min(1, a * factor))) < 4.5; i++) a *= 0.8;
  return a;
}

export function composeLook(input: ComposeInput): Composed {
  const { direction: d, identity, cover } = input;
  const T = input.tweaks ?? {};
  const A = T.appearance ?? {};
  const notes: string[] = [];
  const ctx: PickContext = { identity, cover };
  const base = STYLES[d.id];
  const style: StyleDef = { ...base, fonts: { ...base.fonts }, text: base.text ? { ...base.text } : undefined };

  // ---- typography ---------------------------------------------------------------------------------------------------------
  const pair = TYPE_PAIR[T.typography ?? 'direction'];
  if (pair.display && pair.accent) {
    style.fonts = { ...style.fonts, body: pair.display, serif: pair.accent };
    style.displayFont = 'body';
    style.accentFont = 'serif';
    style.fontMix = false;
  }

  // ---- palette & colour hierarchy -----------------------------------------------------------------------------------------------
  let ground: Look['ground'] = null;
  let colors: Look['colors'] = null;
  let palette: Look['palette'] = null;
  const spec = T.paletteId ? PALETTE[T.paletteId] : d.palettes[clamp(d.pickPalette(ctx), 0, Math.max(0, d.palettes.length - 1))];
  if (spec) {
    const p = resolvePalette(spec, cover, T);
    let g = p.ground;
    const b = A.brightness ?? 1;
    if (b !== 1) g = g.map((c) => scaleLightness(c, b)) as [string, string];
    let { ink, inkDim, active, accent, support } = p;
    const urgent = known(identity, 'urgency');
    const melancholic = known(identity, 'melancholy');
    if (melancholic !== null && melancholic > 0.6) {
      accent = capSat(accent, 0.5);
      active = capSat(active, 0.55);
      notes.push('melancholy: most saturated colours softened');
    }
    const cm = A.contrast ?? 1;
    const lumMid = luminance(mix(g[0], g[1], 0.5));
    const extreme = lumMid > 0.4 ? '#000000' : '#ffffff';
    if (cm > 1) {
      ink = mix(ink, extreme, Math.min(0.6, cm - 1));
      active = mix(active, extreme, Math.min(0.3, (cm - 1) * 0.5));
    } else if (cm < 1) ink = mix(ink, mix(g[0], g[1], 0.5), (1 - cm) * 0.45);
    // floors: whatever the song, the direction or the sliders ask for
    const inkFloor = urgent !== null && urgent > 0.65 && (d.family === 'hiphop' || d.family === 'rock') ? 7 : 5;
    if (inkFloor === 7) notes.push('urgent delivery: ink contrast raised to 7:1');
    ink = ensureContrast(ink, g, inkFloor);
    g = pushGround(ink, g, inkFloor);
    inkDim = ensureContrast(inkDim, g, 4.5);
    active = ensureContrast(active, g, 4.6);
    accent = ensureContrast(accent, g, 3.6);
    support = ensureContrast(support, g, 3);
    ground = g;
    colors = { ink, inkDim, active, accent, support };
    palette = p.palette.map((c, i) => (i < 3 ? ensureContrast(c, g, 2.2) : g[0]));
  }

  // ---- artwork -----------------------------------------------------------------------------------------------------------------------
  const treatment = T.artwork ?? treatmentOf(d, ctx);
  const factor = treatment === 'cinema' ? 1.6 : treatment === 'card' || treatment === 'collage' ? 0.8 : 1;
  const artBase = (style.artwork ?? 0.3) * d.artwork.amount;
  // a full-bleed cover IS the ground: the words choose their colour against it (renderer), so there is nothing to cap
  style.artwork = treatment === 'bleed' ? 1 : colors && ground ? capArt(artBase, colors.ink, ground, cover, factor) : artBase;
  if (colors && style.artwork < artBase * 0.99) notes.push('cover kept softer so the words stay readable over it');

  // ---- texture, glow, scenery ---------------------------------------------------------------------------------------------------------
  if (A.grain !== undefined) style.grain = clamp(A.grain, 0, 0.5);
  if (A.glow !== undefined) style.text = { ...(style.text ?? {}), glow: A.glow > 0.02 ? clamp(A.glow, 0, 1.5) : undefined };
  if (T.scene !== undefined) style.scene = T.scene === 'none' ? undefined : T.scene;
  const density = clamp(A.density ?? 1, 0, 1.5);
  if ((base.decor ?? 1) === 0 && density > 1.05) style.decor = Math.min(0.6, (density - 1) * 1.2);

  // ---- motion: the direction's personality, tuned by the song, then the listener's own values ---------------------------------------------------
  const energy = known(identity, 'energy');
  const intimacy = known(identity, 'intimacy');
  const urgency = known(identity, 'urgency');
  const rhythm = identity?.musical.rhythm.v ?? null;
  const dm = d.motion;
  let intensity = dm.intensity * (energy === null ? 1 : lerp(0.78, 1.2, energy));
  let smooth = clamp(dm.smooth + (intimacy === null ? 0 : (intimacy - 0.5) * 0.2) + (energy === null ? 0 : (0.5 - energy) * 0.2), 0, 1);
  let emphasis = dm.emphasis * (urgency === null ? 1 : lerp(0.8, 1.15, urgency));
  let beat = dm.beat * (rhythm === null ? 1 : lerp(0.6, 1.2, rhythm));
  const sec = input.secondary;
  if (sec) {
    const w = clamp(sec.weight, 0, 0.35);
    intensity = lerp(intensity, sec.direction.motion.intensity, w);
    emphasis = lerp(emphasis, sec.direction.motion.emphasis, w);
    beat = lerp(beat, sec.direction.motion.beat, w);
    smooth = lerp(smooth, sec.direction.motion.smooth, w);
    style.grain = lerp(style.grain, STYLES[sec.direction.id].grain, w);
    notes.push(`a touch of ${sec.direction.label} in the motion`);
  }
  if (intimacy !== null && intimacy > 0.65) {
    intensity = Math.min(intensity, 0.75);
    emphasis = Math.min(emphasis, 0.5);
    notes.push('intimate song: motion kept low');
  }
  const TM = T.motion ?? {};
  const complexity = clamp(TM.complexity ?? dm.complexity, 0, 1);
  if (TM.complexity !== undefined) {
    style.disrupt = (base.disrupt ?? 0) * (complexity / 0.6);
    if (base.fontMix && complexity < 0.35) style.fontMix = false;
    if ((base.decor ?? 1) === 0 && complexity > 0.7) style.decor = Math.max(style.decor ?? 0, (complexity - 0.7) * 1.2);
  }
  const motion: Look['motion'] = {
    intensity: clamp(TM.intensity ?? intensity, 0, 2),
    smooth: clamp(TM.smooth ?? smooth, 0, 1),
    emphasis: clamp(TM.emphasis ?? emphasis, 0, 2),
    beat: clamp(TM.beat ?? beat, 0, 2),
    complexity,
    reveal: dm.reveal,
    transition: TM.transition ?? dm.transition,
    exit: TM.exit ?? dm.exit,
    speed: TM.speed ?? dm.speed,
    lineTransition: TM.lineTransition ?? dm.lineTransition,
    lineOn: TM.lineOn ?? dm.lineOn,
    progress: dm.progress,
    sections: dm.sections,
  };

  const look: Look = {
    key: '',
    style,
    ground,
    colors,
    palette,
    artwork: { treatment, amount: d.artwork.amount, side: d.artwork.side, reflect: d.artwork.reflect, blur: clamp(A.blur ?? d.artwork.blur, 0, 1) },
    layout: { align: A.align ?? d.layout.align, textScale: clamp(A.textScale ?? d.layout.textScale, 0.4, 1.5), textY: clamp(A.textY ?? d.layout.textY, -0.3, 0.3) },
    motion,
    appearance: { grain: style.grain, glow: style.text?.glow ?? 0, density, scene: style.scene ?? null },
  };
  look.key = hashString(JSON.stringify({ ...look, key: 0 })).toString(36);
  return { look, notes };
}
