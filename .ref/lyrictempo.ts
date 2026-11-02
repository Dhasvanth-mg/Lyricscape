import { readFileSync, readdirSync } from 'node:fs';
import { parseLrc } from '../lib/lyrics/parse';
import { estimateTempoFromLyrics } from '../lib/analysis/lyricTempo';
const dir = process.argv[2]!;
const known: Record<string, number> = { FlashingLights: 90.47, LetItHappen: 124.91, Superman: 0 };
for (const f of readdirSync(dir)) {
  const j = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'));
  if (!j.syncedLyrics) continue;
  const doc = parseLrc(j.syncedLyrics, 'LRCLIB');
  const t0 = Date.now();
  const r = estimateTempoFromLyrics(doc);
  const k = known[f.replace('.json', '')];
  console.log(f.replace('.json', '').padEnd(16), 'lines', doc.lines.length, '->', r ? `bpm ${r.bpm} phase ${r.phaseMs} conf ${r.confidence.toFixed(2)} z ${r.z} onsets ${r.onsets}` : 'too few', k ? `| known ${k}` : '', `${Date.now() - t0}ms`);
}
// the demo song (ground truth 112 BPM; its lyrics are authored)
const demo = parseLrc(readFileSync('public/demo/neon-static.lrc', 'utf8'), 'demo');
const d = estimateTempoFromLyrics(demo);
console.log('demo neon-static'.padEnd(16), 'lines', demo.lines.length, '->', d ? `bpm ${d.bpm} phase ${d.phaseMs} conf ${d.confidence.toFixed(2)} z ${d.z}` : 'too few', '| known 112');
