import { readFileSync } from 'node:fs';
import { parseLrc as parseOld } from './parse_main';
import { compileTimeline as compileOld } from './compile_main';
const { parseLrc: parseNew } = await import('../../../lib/lyrics/parse');
const { compileTimeline: compileNew } = await import('../../../lib/kinetic/compile');
const records = JSON.parse(readFileSync(new URL('./mine_records.json', import.meta.url), 'utf8'));
const rec = records.find((r: { id: number }) => r.id === 37533857);
const lrc: string = rec.syncedLyrics;
const opts = { trackId: 'mine', durationMs: 131_000, palette: ['#ff2e63', '#ffd23f', '#08d9d6', '#1a1a2e'], bpm: 100 };
const dOld = parseOld(lrc);
const dNew = parseNew(lrc);
const tOld = compileOld(dOld, opts);
const tNew = compileNew(dNew, opts);
console.log('lines old/new', dOld.lines.length, dNew.lines.length, '| scenes', tOld.scenes.length, tNew.scenes.length);
let lineDiff = 0;
dOld.lines.forEach((l: { startMs: number }, i: number) => { lineDiff = Math.max(lineDiff, Math.abs(l.startMs - dNew.lines[i]!.startMs)); });
console.log('max |line start old - new| =', lineDiff, 'ms   (the lyric TIMESTAMPS are unchanged)');
const deltas: number[] = [];
const perPos: Record<string, number[]> = { first: [], middle: [], last: [] };
tOld.scenes.forEach((s, i) => {
  const n = tNew.scenes[i]!;
  s.words.forEach((w, k) => {
    const d = n.words[k]!.startMs - w.startMs; // negative = the word now appears EARLIER than before
    deltas.push(d);
    perPos[k === 0 ? 'first' : k === s.words.length - 1 ? 'last' : 'middle']!.push(d);
  });
});
const q = (a: number[], p: number) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(p * (s.length - 1))]!; };
const row = (n: string, a: number[]) => console.log(n.padEnd(14), 'n', String(a.length).padStart(3), '| median', String(q(a, .5)).padStart(6), 'ms | p10', String(q(a, .1)).padStart(6), '| p90', String(q(a, .9)).padStart(6));
console.log('\nwhen each WORD appears: NEW minus OLD (negative = earlier now)');
row('all words', deltas); row('first word', perPos.first!); row('middle words', perPos.middle!); row('last word', perPos.last!);
const shown = tOld.scenes[2]!;
console.log('\nexample line:', shown.words.map((w) => w.text).join(' '));
console.log('  OLD word starts (rel. line):', shown.words.map((w) => w.startMs - shown.startMs).join(', '));
console.log('  NEW word starts (rel. line):', tNew.scenes[2]!.words.map((w) => w.startMs - tNew.scenes[2]!.startMs).join(', '));
