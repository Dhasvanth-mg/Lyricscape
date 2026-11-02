import { readFileSync } from 'node:fs';
import { parseLrc } from '../lib/lyrics/parse';
import { onsetsOf } from '../lib/analysis/lyricTempo';
const demo = parseLrc(readFileSync('public/demo/neon-static.lrc', 'utf8'), 'demo');
const on = onsetsOf(demo);
console.log('lines', demo.lines.length, 'onsets', on.length, 'wordTiming', demo.lines.slice(0, 3).map((l) => l.wordTiming), 'words/line', demo.lines[0]!.words.length);
console.log(on.slice(0, 12).map((o) => `${o.t}(${o.w})`).join(' '));
