import { readFileSync } from 'node:fs';
import { parseLrc } from '../lib/lyrics/parse';
import { estimateTempoFromLyrics, onsetsOf } from '../lib/analysis/lyricTempo';
const dir = process.argv[2]!;
const cases: [string, number][] = [['FlashingLights', 90.47], ['LetItHappen', 124.91]];
for (const [n, bpm] of cases) {
  const doc = parseLrc(JSON.parse(readFileSync(`${dir}/${n}.json`, 'utf8')).syncedLyrics, 'LRCLIB');
  const r = estimateTempoFromLyrics(doc, { fixedBpm: bpm });
  const P = 60000 / bpm;
  const on = onsetsOf(doc);
  // histogram of onset position within the beat, 8 bins
  const h = new Array(8).fill(0); const ph = r ? r.phaseMs : 0;
  for (const o of on) h[Math.floor((((o.t - ph) % P) + P) % P / (P / 8))]++;
  console.log(n, 'fixed bpm', bpm, '->', r ? `phase ${r.phaseMs} conf ${r.confidence.toFixed(2)} z ${r.z}` : 'none', '| onset position in beat (8 bins from the beat):', h.join(' '));
}
const demo = parseLrc(readFileSync('public/demo/neon-static.lrc', 'utf8'), 'demo');
const d = estimateTempoFromLyrics(demo, { fixedBpm: 112, minOnsets: 8 });
console.log('demo fixed 112 ->', d ? `phase ${d.phaseMs} conf ${d.confidence.toFixed(2)} z ${d.z}` : 'none');
console.log(demo.lines.map((l) => l.startMs).join(' '));
