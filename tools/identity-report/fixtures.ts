// What does Auto choose for each sample song, and why?   pnpm exec tsx tools/identity-report/fixtures.ts
//
// Runs the real pipeline (identity -> direction -> look) on the original fixtures in lib/theme/fixtures.ts. The cover numbers here are
// approximated from the fixture palettes; the /looks gallery measures the real generated covers in a browser.

import { parseLrc } from '../../lib/lyrics/parse';
import { FIXTURES, tagsOf } from '../../lib/theme/fixtures';
import { songVisual } from '../../lib/theme/pipeline';
import { hslOf, paletteWarmth } from '../../lib/theme/color';
import { luminance } from '../../lib/kinetic/util';
import { DIM_KEYS } from '../../lib/identity/types';
import type { Track } from '../../lib/types';

const f2 = (n: number | null) => (n === null ? '  ? ' : n.toFixed(2));
console.log('song'.padEnd(22), 'direction'.padEnd(12), 'headline');
for (const f of FIXTURES) {
  const lum = f.cover.palette.slice(0, 3).reduce((a, c) => a + luminance(c), 0) / 3;
  const sat = f.cover.palette.slice(0, 3).reduce((a, c) => a + hslOf(c)[1], 0) / 3;
  const cover = { palette: f.cover.palette, light: Math.min(1, Math.sqrt(lum)), vibrance: Math.min(1, sat * 0.9), warmth: paletteWarmth(f.cover.palette) };
  const track: Track = { id: `fixture:${f.id}`, provider: 'demo', title: f.title, artists: [f.artist], durationMs: 200000, releaseYear: f.year };
  const v = songVisual({ track, doc: parseLrc(f.lrc), tags: tagsOf(f), cover });
  console.log(f.id.padEnd(22), v.resolved.direction.padEnd(12), v.described.headline);
  console.log('   dims', DIM_KEYS.map((k) => `${k.slice(0, 4)}=${f2(v.identity.emotional[k].v)}(${v.identity.emotional[k].conf.toFixed(1)})`).join(' '), `amb=${f2(v.identity.emotional.ambiguity.v)}`);
  console.log('   why ', v.resolved.choice.reasons.join(' | '), `| conf ${v.resolved.choice.confidence}`, '| top', v.resolved.choice.scores.slice(0, 3).map((s) => `${s.id}:${s.score.toFixed(2)}`).join(' '));
  console.log('   look', `treatment=${v.resolved.look.artwork.treatment}`, `motion=${v.resolved.look.motion.intensity.toFixed(2)}/${v.resolved.look.motion.smooth.toFixed(2)}`, v.resolved.notes.join('; '));
}
