// The art directions: ten composed ways of dressing a song, plus the classic styles as an explicit, opt-in shelf.
//
// A direction is NOT a mood filter and NOT a random bundle of effects. It fixes, together: a palette (with how far the cover may
// pull it), a type pairing, how the artwork is used, a motion personality, texture and scenery. The song's identity then decides
// WHICH direction fits and tunes it (calmer when intimate, harder when urgent). `fit()` is the whole reason a direction is picked,
// and it reports its reasons so the interface can show them.

import { STYLES } from '../kinetic/styles';
import type { ArtTreatment, Look } from '../kinetic/look';
import type { StyleId } from '../kinetic/types';
import { knownDim, type DimKey, type GenreFamily } from '../identity/types';
import type { Direction, DirectionFit, PaletteSpec, PickContext } from './types';

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const dv = (c: PickContext, k: DimKey | 'ambiguity'): number | null => knownDim(c.identity, k);
const share = (c: PickContext, f: GenreFamily) => c.identity?.musical.familyShare[f] ?? 0;
const taste = (c: PickContext, k: 'cinematic' | 'experimental' | 'minimal') => c.identity?.taste[k] ?? 0;
/** all the subgenre labels the tags support, as one string to test against */
const sub = (c: PickContext) => (c.identity?.musical.subgenres ?? []).join(' | ');
const coverLight = (c: PickContext) => c.cover?.light ?? null;
/** closeness of a known value to a target: +1 on target, 0 at half a unit away, negative beyond. Unknown counts for nothing. */
const near = (v: number | null, target: number) => (v === null ? 0 : Math.max(-0.5, 1 - 2 * Math.abs(v - target)));

type Term = [label: string, value: number];
function fit(terms: Term[]): DirectionFit {
  const score = terms.reduce((a, [, v]) => a + v, 0);
  const reasons = [...terms].filter(([, v]) => v >= 0.3).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([l]) => l);
  return { score: Math.round(score * 1000) / 1000, reasons };
}

// ---------------------------------------------------------------------------------------------------------------------
// Palettes
// ---------------------------------------------------------------------------------------------------------------------
export const PALETTES: PaletteSpec[] = [
  { id: 'velvet-night', label: 'Oxblood & ivory', ground: ['#150a0c', '#26101a'], ink: '#f2e7d6', inkDim: '#a58f7d', active: '#e0b86a', accent: '#c4616c', support: '#8a6a58', palette: ['#b5424f', '#e0b86a', '#6a2a55', '#150a0c'], coverInfluence: 0.25, maxSat: 0.55 },
  { id: 'ether-bone', label: 'Bone & sage', ground: ['#ebe6da', '#d9dccd'], ink: '#272826', inkDim: '#6a6c66', active: '#6c5a94', accent: '#8a6f55', support: '#8f9a86', palette: ['#8fa38b', '#a99bc4', '#a08a74', '#272826'], coverInfluence: 0.3, maxSat: 0.4 },
  { id: 'ether-charcoal', label: 'Charcoal & lavender', ground: ['#1f211f', '#2c2e2a'], ink: '#ece7dc', inkDim: '#9b9d93', active: '#b7a9d6', accent: '#c2a98e', support: '#8fa38b', palette: ['#8fa38b', '#a99bc4', '#a08a74', '#1f211f'], coverInfluence: 0.3, maxSat: 0.4 },
  { id: 'nocturne-ink', label: 'Ink & amber', ground: ['#06080f', '#0e1424'], ink: '#e4e7ee', inkDim: '#8a91a3', active: '#f0a95e', accent: '#c8574a', support: '#7a7f94', palette: ['#f0a95e', '#8a78b5', '#c8574a', '#06080f'], coverInfluence: 0.2, maxSat: 0.5 },
  { id: 'rhythm-black', label: 'Black & signal', ground: ['#0a0a0b', '#151517'], ink: '#f4f2ea', inkDim: '#8d8b86', active: '#f5d00a', accent: '#ff3d2e', support: '#6c6a66', palette: ['#f5d00a', '#ff3d2e', '#ffffff', '#0a0a0b'], coverInfluence: 0.55, maxSat: 0.95 },
  { id: 'broadsheet-news', label: 'Newsprint & ink', ground: ['#efe9dc', '#e3dccb'], ink: '#191714', inkDim: '#6d675c', active: '#b3341f', accent: '#1f4a6b', support: '#8a8273', palette: ['#b3341f', '#1f4a6b', '#8a8273', '#191714'], coverInfluence: 0.3, maxSat: 0.6 },
  { id: 'broadsheet-night', label: 'Night edition', ground: ['#14120f', '#1d1a16'], ink: '#ece5d6', inkDim: '#9a9285', active: '#e0674f', accent: '#7fa3c4', support: '#8a8273', palette: ['#e0674f', '#7fa3c4', '#8a8273', '#14120f'], coverInfluence: 0.3, maxSat: 0.6 },
  { id: 'graphic-cover', label: 'Colour field', ground: 'cover', ink: '#ffffff', inkDim: '#f1e6ea', active: '#15131a', accent: '#ffe27a', support: '#ffffff', palette: ['#ff5e7a', '#ffe27a', '#7ad7ff', '#15131a'], coverInfluence: 1, maxSat: 0.85 },
  { id: 'analog-warm', label: 'Warm monochrome', ground: ['#100c08', '#1e1710'], ink: '#efe3cd', inkDim: '#a8977f', active: '#f2b05a', accent: '#d9694a', support: '#8a7a64', palette: ['#f2b05a', '#d9694a', '#e8d9b8', '#100c08'], coverInfluence: 0.2, maxSat: 0.6 },
  { id: 'analog-bw', label: 'Black & white print', ground: ['#0c0c0c', '#1a1a1a'], ink: '#cfcfca', inkDim: '#8a8a86', active: '#ffffff', accent: '#b9b9b3', support: '#6e6e6a', palette: ['#ffffff', '#b9b9b3', '#8a8a86', '#0c0c0c'], coverInfluence: 0.1, maxSat: 0.2 },
  { id: 'artbook-paper', label: 'Paper & terracotta', ground: ['#efe8da', '#e4dccb'], ink: '#26221d', inkDim: '#7a7367', active: '#b3472f', accent: '#46604f', support: '#9c9484', palette: ['#b3472f', '#46604f', '#c9a96b', '#26221d'], coverInfluence: 0.25, maxSat: 0.5 },
  { id: 'artbook-lamp', label: 'Lamplight', ground: ['#1c1915', '#262219'], ink: '#ebe0c9', inkDim: '#9c917c', active: '#e08a62', accent: '#8fb09a', support: '#7a7060', palette: ['#e08a62', '#8fb09a', '#c9a96b', '#1c1915'], coverInfluence: 0.25, maxSat: 0.5 },
  { id: 'still-night', label: 'Night, one light', ground: ['#080b10', '#10151d'], ink: '#e8eaee', inkDim: '#8a919d', active: '#fff1d6', accent: '#9db3cf', support: '#6c7480', palette: ['#9db3cf', '#fff1d6', '#6c7480', '#080b10'], coverInfluence: 0.15, maxSat: 0.35 },
  { id: 'still-morning', label: 'Morning', ground: ['#eef1f4', '#dde3ea'], ink: '#1d232b', inkDim: '#68717e', active: '#2f4a6b', accent: '#7a8fa8', support: '#98a3b1', palette: ['#7a8fa8', '#2f4a6b', '#98a3b1', '#1d232b'], coverInfluence: 0.15, maxSat: 0.35 },
  { id: 'coverpop-hot', label: 'Hot from the cover', ground: 'coverDark', vivid: true, ink: '#ffffff', inkDim: '#efe3ea', active: '#ff4f9a', accent: '#ffe27a', support: '#ffffff', palette: ['#ff4f9a', '#ffe27a', '#7ad7ff', '#1a0f1e'], coverInfluence: 1, maxSat: 1 },
  { id: 'disorder-signal', label: 'Acid signal', ground: ['#090909', '#131313'], ink: '#f2f2f2', inkDim: '#8a8a8a', active: '#d7ff3a', accent: '#ff3b2f', support: '#666666', palette: ['#d7ff3a', '#ff3b2f', '#ffffff', '#090909'], coverInfluence: 0.6, maxSat: 1 },
];
export const PALETTE: Record<string, PaletteSpec> = Object.fromEntries(PALETTES.map((p) => [p.id, p]));

// ---------------------------------------------------------------------------------------------------------------------
// Motion personalities (before the song's own energy / intimacy / urgency tune them)
// ---------------------------------------------------------------------------------------------------------------------
const M = (m: Partial<Look['motion']>): Look['motion'] => ({ intensity: 1, smooth: 0, emphasis: 1, beat: 1, complexity: 0.6, reveal: 'word', transition: 'preset', progress: false, sections: true, ...m });
const CENTER: Look['layout'] = { align: 'center', textScale: 1, textY: 0 };

type Def = Omit<Direction, 'id' | 'family' | 'label' | 'tagline'> & { family: GenreFamily; label: string; tagline: string };
const dir = (id: StyleId, d: Def): [StyleId, Direction] => [id, { id, ...d }];

export const DIRECTIONS: Partial<Record<StyleId, Direction>> = Object.fromEntries([
  dir('velvet', {
    family: 'rnb',
    label: 'Velvet',
    tagline: 'Late-night R&B · warm shadow, soft light',
    palettes: [PALETTE['velvet-night']!],
    pickPalette: () => 0,
    artwork: { treatment: 'tonal', side: 'left', reflect: true, amount: 1, blur: 0.2 },
    layout: { align: 'center', textScale: 0.52, textY: 0 },
    motion: M({ intensity: 0.8, smooth: 0.85, emphasis: 0.45, beat: 0.2, complexity: 0.2, reveal: 'line', transition: 'rise', progress: true }),
    appearance: { glow: 1, density: 1 },
    requires: ['rnb'],
    treatmentFor: (c) => ((taste(c, 'cinematic') > 0.3 || ((coverLight(c) ?? 1) < 0.3 && (dv(c, 'intimacy') ?? 0) > 0.6)) ? 'cinema' : 'tonal'),
    fit: (c) =>
      fit([
        ['R&B tags', 2 * share(c, 'rnb')],
        ['soul-leaning tags', /soul|contemporary/i.test(sub(c)) ? 0.5 : 0],
        ['warm tone', 0.7 * near(dv(c, 'warmth') ?? c.cover?.warmth ?? null, 0.75)],
        ['intimate delivery', 0.8 * near(dv(c, 'intimacy'), 0.8)],
        ['low-key energy', 0.7 * near(dv(c, 'energy'), 0.3)],
        ['late-night mood', 0.4 * near(dv(c, 'valence'), 0.4)],
        ['you asked for cinematic', 0.5 * taste(c, 'cinematic')],
        ['tension (more Nocturne than Velvet)', -0.9 * Math.max(0, (dv(c, 'tension') ?? 0.4) - 0.55)],
      ]),
  }),
  dir('ether', {
    family: 'rnb',
    label: 'Ether',
    tagline: 'Alternative R&B · art book, light leaks',
    palettes: [PALETTE['ether-bone']!, PALETTE['ether-charcoal']!],
    pickPalette: (c) => ((coverLight(c) ?? 0.4) > 0.5 && (dv(c, 'valence') ?? 0.5) > 0.38 ? 0 : 1),
    artwork: { treatment: 'collage', side: 'left', reflect: false, amount: 1, blur: 0 },
    layout: { align: 'left', textScale: 0.58, textY: 0 },
    motion: M({ intensity: 0.8, smooth: 0.75, emphasis: 0.5, beat: 0.2, complexity: 0.35, reveal: 'line', transition: 'drift', progress: true }),
    appearance: { glow: 0, density: 1 },
    requires: ['rnb', 'indie', 'experimental'],
    treatmentFor: (c) => (taste(c, 'minimal') > 0.3 ? 'defocus' : 'collage'),
    fit: (c) =>
      fit([
        ['alt-R&B tags', 1.4 * share(c, 'rnb') * (/alt/i.test(sub(c)) ? 1 : 0.5) + (/alt/i.test(sub(c)) ? 0.8 : 0)],
        ['indie / experimental tags', 0.9 * share(c, 'indie') + 0.9 * share(c, 'experimental')],
        ['dreamy feel', 0.8 * near(dv(c, 'dreaminess'), 0.75)],
        ['mixed feelings', 0.6 * near(dv(c, 'ambiguity'), 0.6)],
        ['cool, even tone', 0.4 * near(dv(c, 'warmth') ?? c.cover?.warmth ?? null, 0.45)],
        ['intimate delivery', 0.5 * near(dv(c, 'intimacy'), 0.7)],
        ['you asked for experimental', 0.7 * taste(c, 'experimental')],
      ]),
  }),
  dir('nocturne', {
    family: 'rnb',
    label: 'Nocturne',
    tagline: 'Dark atmospheric R&B · night city, one accent',
    palettes: [PALETTE['nocturne-ink']!],
    pickPalette: () => 0,
    artwork: { treatment: 'defocus', side: 'left', reflect: false, amount: 1, blur: 0.3 },
    layout: { align: 'center', textScale: 0.56, textY: 0 },
    motion: M({ intensity: 0.8, smooth: 0.8, emphasis: 0.45, beat: 0.35, complexity: 0.2, reveal: 'line', transition: 'fade', progress: true }),
    appearance: { glow: 1, density: 1 },
    requires: ['rnb', 'hiphop', 'atmospheric'],
    treatmentFor: (c) => (taste(c, 'cinematic') > 0.3 ? 'cinema' : 'defocus'),
    fit: (c) =>
      fit([
        ['R&B / moody tags', 1.5 * share(c, 'rnb') + 0.7 * share(c, 'hiphop') + 0.9 * share(c, 'atmospheric') + 0.3 * share(c, 'electronic')],
        ['dark R&B tags', /dark/i.test(sub(c)) ? 0.9 : 0],
        ['dark mood', 0.8 * near(dv(c, 'valence'), 0.25)],
        ['tension', 0.5 * near(dv(c, 'tension'), 0.65)],
        ['cool tone', 0.5 * near(dv(c, 'warmth') ?? c.cover?.warmth ?? null, 0.3)],
        ['dark cover', 0.5 * (coverLight(c) === null ? 0 : clamp01(1 - coverLight(c)! * 2.2))],
        ['you asked for cinematic', 0.5 * taste(c, 'cinematic')],
      ]),
  }),
  dir('rhythm', {
    family: 'hiphop',
    label: 'Type as Rhythm',
    tagline: 'Hip-hop · structure, contrast, deliberate motion',
    palettes: [PALETTE['rhythm-black']!],
    pickPalette: () => 0,
    artwork: { treatment: 'split', side: 'right', reflect: false, amount: 1, blur: 0.15 },
    layout: { align: 'center', textScale: 1, textY: 0 },
    motion: M({ intensity: 1, smooth: 0.1, emphasis: 1, beat: 1, complexity: 0.6 }),
    appearance: { glow: 1, density: 1 },
    requires: ['hiphop'],
    fit: (c) =>
      fit([
        ['hip-hop tags', 2.2 * share(c, 'hiphop')],
        ['rapped delivery', c.identity?.musical.delivery.kind === 'rapped' ? 0.6 * c.identity.musical.delivery.conf + 0.3 : 0],
        ['high energy', 0.8 * near(dv(c, 'energy'), 0.8)],
        ['urgency', 0.6 * near(dv(c, 'urgency'), 0.75)],
        ['hard-edged tags', /hard/i.test(sub(c)) ? 0.5 : 0],
        ['not story-led', c.identity?.lyrical.stats ? 0.3 * (1 - c.identity.lyrical.stats.narrativity) : 0],
      ]),
  }),
  dir('broadsheet', {
    family: 'hiphop',
    label: 'Broadsheet',
    tagline: 'Reflective rap · newsprint, serif headlines',
    palettes: [PALETTE['broadsheet-news']!, PALETTE['broadsheet-night']!],
    pickPalette: (c) => ((coverLight(c) ?? 0.5) < 0.25 && (dv(c, 'valence') ?? 0.5) < 0.4 ? 1 : 0),
    artwork: { treatment: 'card', side: 'left', reflect: false, amount: 1, blur: 0 },
    layout: { align: 'left', textScale: 0.7, textY: 0 },
    motion: M({ intensity: 0.8, smooth: 0.45, emphasis: 0.6, beat: 0.4, complexity: 0.3, transition: 'fade' }),
    appearance: { glow: 0, density: 1 },
    requires: ['hiphop'],
    fit: (c) =>
      fit([
        ['hip-hop tags', 1.9 * share(c, 'hiphop')],
        ['story-led lyrics', c.identity?.lyrical.stats ? 1.0 * c.identity.lyrical.stats.narrativity : 0],
        ['reflective, close voice', 0.5 * near(dv(c, 'intimacy'), 0.65)],
        ['measured energy', 0.6 * near(dv(c, 'energy'), 0.4)],
        ['conscious / boom-bap tags', /conscious|boom/i.test(sub(c)) ? 0.6 : 0],
      ]),
  }),
  dir('graphic', {
    family: 'pop',
    label: 'Graphic',
    tagline: 'Pop · flat colour from the cover, clean type',
    palettes: [PALETTE['graphic-cover']!],
    pickPalette: () => 0,
    artwork: { treatment: 'card', side: 'right', reflect: false, amount: 1, blur: 0 },
    layout: CENTER,
    motion: M({ intensity: 0.95, smooth: 0.25, emphasis: 0.9, beat: 0.8, complexity: 0.5 }),
    appearance: { glow: 0, density: 1 },
    fit: (c) =>
      fit([
        ['pop tags', 2.2 * share(c, 'pop') + 0.8 * share(c, 'electronic')],
        ['upbeat mood', 0.8 * near(dv(c, 'valence'), 0.75)],
        ['energetic', 0.6 * near(dv(c, 'energy'), 0.7)],
        ['vivid cover', c.cover ? 0.6 * near(c.cover.vibrance, 0.65) : 0],
      ]),
  }),
  dir('analog', {
    family: 'rock',
    label: 'Analog Cinema',
    tagline: 'Alternative rock · grain, warm monochrome, poster type',
    palettes: [PALETTE['analog-warm']!, PALETTE['analog-bw']!],
    pickPalette: (c) => ((c.cover?.vibrance ?? 0.4) < 0.12 ? 1 : 0),
    artwork: { treatment: 'cinema', side: 'left', reflect: false, amount: 1, blur: 0.3 },
    layout: { align: 'center', textScale: 0.8, textY: 0 },
    motion: M({ intensity: 0.85, smooth: 0.5, emphasis: 0.6, beat: 0.6, complexity: 0.3, transition: 'fade' }),
    appearance: { glow: 1, density: 1 },
    requires: ['rock'],
    fit: (c) =>
      fit([
        ['rock tags', 2.2 * share(c, 'rock') + 0.8 * share(c, 'indie')],
        ['alternative / psychedelic tags', /alternative|psychedelic/i.test(sub(c)) ? 0.3 : 0],
        ['nostalgic', 0.7 * near(dv(c, 'nostalgia'), 0.7)],
        ['warm tone', 0.5 * near(dv(c, 'warmth') ?? c.cover?.warmth ?? null, 0.65)],
        ['driving energy', 0.5 * near(dv(c, 'energy'), 0.6)],
        ['muted cover', c.cover ? 0.4 * near(c.cover.vibrance, 0.2) : 0],
        ['you asked for cinematic', 0.5 * taste(c, 'cinematic')],
      ]),
  }),
  dir('artbook', {
    family: 'indie',
    label: 'Art Book',
    tagline: 'Indie · paper, framed cover, quiet serif',
    palettes: [PALETTE['artbook-paper']!, PALETTE['artbook-lamp']!],
    pickPalette: (c) => ((coverLight(c) ?? 0.5) < 0.3 ? 1 : 0),
    artwork: { treatment: 'card', side: 'left', reflect: false, amount: 1, blur: 0 },
    layout: { align: 'left', textScale: 0.58, textY: 0 },
    motion: M({ intensity: 0.7, smooth: 0.65, emphasis: 0.4, beat: 0.2, complexity: 0.25, reveal: 'line', transition: 'fade', progress: true, sections: false }),
    appearance: { glow: 0, density: 1 },
    treatmentFor: (c) => (taste(c, 'experimental') > 0.3 ? 'collage' : 'card'),
    fit: (c) =>
      fit([
        ['indie / folk tags', 2 * share(c, 'indie') + 1.6 * share(c, 'folk') + 0.5 * share(c, 'atmospheric')],
        ['intimate delivery', 0.8 * near(dv(c, 'intimacy'), 0.8)],
        ['muted cover', c.cover ? 0.5 * near(c.cover.vibrance, 0.2) : 0],
        ['nostalgic', 0.4 * near(dv(c, 'nostalgia'), 0.55)],
        ['you asked for minimal', 0.6 * taste(c, 'minimal')],
      ]),
  }),
  dir('coverpop', {
    family: 'pop',
    label: 'Cover Pop',
    tagline: 'The cover as the stage · big hot type, chips, icons',
    palettes: [PALETTE['coverpop-hot']!],
    pickPalette: () => 0,
    artwork: { treatment: 'bleed', side: 'left', reflect: false, amount: 1, blur: 0 },
    layout: CENTER,
    motion: M({ intensity: 1.1, smooth: 0.2, emphasis: 1.1, beat: 0.9, complexity: 0.7 }),
    appearance: { glow: 0, density: 1 },
    // a choice, not an automatic one: it is a different way of showing a song, so Auto never switches to it by itself
    fit: () => ({ score: 0, reasons: [] }),
  }),
  dir('stillness', {
    family: 'atmospheric',
    label: 'Stillness',
    tagline: 'Slow & atmospheric · negative space, one soft light',
    palettes: [PALETTE['still-night']!, PALETTE['still-morning']!],
    pickPalette: (c) => ((dv(c, 'valence') ?? 0.5) > 0.62 && (coverLight(c) ?? 0.4) > 0.55 ? 1 : 0),
    artwork: { treatment: 'defocus', side: 'left', reflect: false, amount: 0.9, blur: 0.5 },
    layout: { align: 'center', textScale: 0.46, textY: 0 },
    motion: M({ intensity: 0.6, smooth: 0.95, emphasis: 0.3, beat: 0, complexity: 0.1, reveal: 'line', transition: 'fade', progress: true, sections: false }),
    appearance: { glow: 1, density: 1 },
    fit: (c) =>
      fit([
        ['ambient / atmospheric tags', 2 * share(c, 'atmospheric') + 0.6 * share(c, 'folk')],
        ['calm', 0.9 * near(dv(c, 'energy'), 0.15)],
        ['dreamy', 0.6 * near(dv(c, 'dreaminess'), 0.75)],
        ['intimate', 0.4 * near(dv(c, 'intimacy'), 0.75)],
        ['slow delivery', c.identity?.musical.pacing.label === 'slow' ? 0.5 : 0],
        ['you asked for minimal', 0.8 * taste(c, 'minimal')],
      ]),
  }),
  dir('disorder', {
    family: 'experimental',
    label: 'Controlled Disorder',
    tagline: 'Experimental · mixed faces, brief disruption',
    palettes: [PALETTE['disorder-signal']!],
    pickPalette: () => 0,
    artwork: { treatment: 'split', side: 'left', reflect: false, amount: 1, blur: 0.2 },
    layout: { align: 'left', textScale: 1, textY: 0 },
    motion: M({ intensity: 0.95, smooth: 0.15, emphasis: 1.1, beat: 0.9, complexity: 0.8 }),
    appearance: { glow: 0, density: 1 },
    requires: ['experimental', 'electronic'],
    fit: (c) =>
      fit([
        ['experimental tags', 2.4 * share(c, 'experimental') + 0.8 * share(c, 'electronic')],
        ['tension', 0.5 * near(dv(c, 'tension'), 0.7)],
        ['mixed feelings', 0.5 * near(dv(c, 'ambiguity'), 0.65)],
        ['restless energy', 0.4 * near(dv(c, 'energy'), 0.65)],
        ['you asked for experimental', 1.0 * taste(c, 'experimental')],
      ]),
  }),
]) as Partial<Record<StyleId, Direction>>;

// The classic styles stay available on an explicit shelf. Only two can be chosen automatically, and only on real evidence.
const CLASSIC: { id: StyleId; family: GenreFamily; auto?: (c: PickContext) => DirectionFit }[] = [
  { id: 'gloss', family: 'pop', auto: (c) => fit([['pop tags', 1.5 * share(c, 'pop')], ['bright cover', 0.6 * near(coverLight(c), 0.7)], ['soft energy', 0.5 * near(dv(c, 'energy'), 0.45)], ['upbeat mood', 0.5 * near(dv(c, 'valence'), 0.65)]]) },
  { id: 'vaporwave', family: 'experimental', auto: (c) => (c.identity?.cultural.aesthetics.includes('retro-futurist') ? fit([['tagged retro-futurist (synthwave / vaporwave)', 3]]) : { score: 0, reasons: [] }) },
  { id: 'maximalist', family: 'pop' },
  { id: 'editorial', family: 'hiphop' },
  { id: 'psychedelic', family: 'rock' },
  { id: 'minimal', family: 'atmospheric' },
  { id: 'y2k', family: 'pop' },
  { id: 'neon', family: 'electronic' },
  { id: 'vhs', family: 'electronic' },
  { id: 'notebook', family: 'indie' },
  { id: 'aurora', family: 'atmospheric' },
  { id: 'popart', family: 'pop' },
  { id: 'film', family: 'rock' },
];
for (const c of CLASSIC) {
  DIRECTIONS[c.id] = {
    id: c.id,
    family: c.family,
    label: STYLES[c.id].label,
    tagline: STYLES[c.id].description,
    palettes: [],
    pickPalette: () => 0,
    artwork: { treatment: 'wash', side: 'left', reflect: false, amount: 1, blur: 0 },
    layout: CENTER,
    motion: M({}),
    appearance: { glow: 1, density: 1 },
    fit: c.auto ?? (() => ({ score: 0, reasons: [] })),
  };
}

/** Directions in the order the studio shows them, grouped by family. */
export const DIRECTION_GROUPS: { label: string; ids: StyleId[] }[] = [
  { label: 'R&B', ids: ['velvet', 'ether', 'nocturne'] },
  { label: 'Hip-hop', ids: ['rhythm', 'broadsheet'] },
  { label: 'Pop', ids: ['graphic', 'gloss'] },
  { label: 'Cover-forward', ids: ['coverpop'] },
  { label: 'Rock & indie', ids: ['analog', 'artbook'] },
  { label: 'Atmospheric & experimental', ids: ['stillness', 'disorder'] },
  { label: 'Classic looks', ids: ['maximalist', 'editorial', 'minimal', 'aurora', 'film', 'notebook', 'neon', 'vaporwave', 'vhs', 'y2k', 'psychedelic', 'popart'] },
];

export const NEW_DIRECTION_IDS: StyleId[] = ['velvet', 'ether', 'nocturne', 'rhythm', 'broadsheet', 'graphic', 'analog', 'artbook', 'stillness', 'disorder', 'coverpop'];

export const directionOf = (id: StyleId): Direction => DIRECTIONS[id] ?? DIRECTIONS.stillness!;

export const treatmentOf = (d: Direction, c: PickContext): ArtTreatment => d.treatmentFor?.(c) ?? d.artwork.treatment;
