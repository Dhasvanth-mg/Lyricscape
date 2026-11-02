import { readFileSync, existsSync } from 'node:fs';
import { parseLyrics } from '../lib/lyrics/parse';
import { estimateTempoFromLyrics, onsetsOf } from '../lib/analysis/lyricTempo';
const dir = process.argv[2]!;
for (const [n, bpm] of [['FlashingLights', 90.47], ['LetItHappen', 124.91]] as const) {
  const f = `${dir}/${n}.word.lrc`; if (!existsSync(f)) { console.log(n, 'no word-synced file'); continue; }
  const doc = parseLyrics(readFileSync(f, 'utf8'), { durationMs: 240000 });
  const auth = doc.lines.filter((l) => (l.wordTiming ?? 'authored') === 'authored' && l.words.length > 1).length;
  const free = estimateTempoFromLyrics(doc);
  const fixed = estimateTempoFromLyrics(doc, { fixedBpm: bpm });
  console.log(n, 'lines', doc.lines.length, 'authored-word lines', auth, 'onsets', onsetsOf(doc).length, '\n  free  :', free && `bpm ${free.bpm} phase ${free.phaseMs} conf ${free.confidence.toFixed(2)} z ${free.z}`, '\n  fixed :', fixed && `phase ${fixed.phaseMs} conf ${fixed.confidence.toFixed(2)} z ${fixed.z}`, `(known ${bpm})`);
}
