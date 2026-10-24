// Which entrance preset does each line of each fixture get under its Auto direction?  pnpm exec tsx tools/identity-report/presets.ts
import { parseLrc } from '../../lib/lyrics/parse';
import { FIXTURES, tagsOf } from '../../lib/theme/fixtures';
import { songVisual } from '../../lib/theme/pipeline';
import type { Track } from '../../lib/types';

for (const f of FIXTURES) {
  const track: Track = { id: `fixture:${f.id}`, provider: 'demo', title: f.title, artists: [f.artist], durationMs: 200000, releaseYear: f.year };
  const v = songVisual({ track, doc: parseLrc(f.lrc), tags: tagsOf(f), cover: { palette: f.cover.palette, light: 0.4, vibrance: 0.5 } });
  console.log(f.id.padEnd(16), v.resolved.direction.padEnd(11), v.timeline.scenes.map((s) => `${s.words.length}w:${s.preset}`).join(' '));
}
