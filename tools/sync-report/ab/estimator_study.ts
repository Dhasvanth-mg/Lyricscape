// Where does the word-timing estimate for LINE-synced lyrics go wrong, and for which tempo? (human annotations, 20 songs)
//   pnpm exec tsx tools/sync-report/ab/estimator_study.ts
//
// Input is what a line-level LRC gives: exact line starts and nothing else. For every line, the estimator decides how far
// into the gap before the next line the words are spread. Candidates are fitted by LEAVE-ONE-SONG-OUT cross-validation,
// so a number is only reported for a song the parameters never saw.

import { readFileSync, readdirSync } from 'node:fs';
import { wordWeight } from '../../../lib/lyrics/words';

const DATA = new URL('../../aligner/data/words/', import.meta.url);
type Line = { song: string; n: number; weights: number[]; start: number; gap: number | null; trueStarts: number[]; trueEnd: number };
const lines: Line[] = [];
for (const name of readdirSync(DATA).filter((f) => f.endsWith('.words.txt')).map((f) => f.slice(0, -10))) {
  const words = readFileSync(new URL(`${name}.words.txt`, DATA), 'utf8').split(/\r?\n/).filter(Boolean);
  const rows = readFileSync(new URL(`${name}.csv`, DATA), 'utf8').trim().split(/\r?\n/).slice(1).map((r) => {
    const [s, e, le] = r.split(',');
    return { s: Number(s) * 1000, e: Number(e) * 1000, lineEnd: le !== '' && le !== 'nan' };
  });
  if (rows.length !== words.length) continue;
  const spans: { a: number; b: number }[] = [];
  let a = 0;
  rows.forEach((r, i) => {
    if (r.lineEnd || i === rows.length - 1) {
      spans.push({ a, b: i });
      a = i + 1;
    }
  });
  spans.forEach((sp, k) => {
    const n = sp.b - sp.a + 1;
    const next = spans[k + 1];
    lines.push({
      song: name,
      n,
      weights: words.slice(sp.a, sp.b + 1).map(wordWeight),
      start: rows[sp.a]!.s,
      gap: next ? rows[next.a]!.s - rows[sp.a]!.s : null,
      trueStarts: rows.slice(sp.a, sp.b + 1).map((r) => r.s),
      trueEnd: rows[sp.b]!.e,
    });
  });
}
const usable = lines.filter((l) => l.gap !== null && l.n >= 2 && l.gap > 0);
console.log(`${lines.length} lines, ${usable.length} with a following line and 2+ words, ${usable.reduce((a, l) => a + l.n, 0)} words\n`);

// how long a line is really sung, relative to the gap, and per word
const ratio = usable.map((l) => (l.trueEnd - l.start) / l.gap!).sort((a, b) => a - b);
const q = (a: number[], p: number) => a[Math.min(a.length - 1, Math.floor(p * a.length))]!;
console.log('share of the gap that is actually sung (last word END - line start) / gap: p10', q(ratio, 0.1).toFixed(2), 'median', q(ratio, 0.5).toFixed(2), 'p90', q(ratio, 0.9).toFixed(2));
const perWord = usable.map((l) => (l.trueEnd - l.start) / l.n).sort((a, b) => a - b);
console.log('sung ms per word: p10', Math.round(q(perWord, 0.1)), 'median', Math.round(q(perWord, 0.5)), 'p90', Math.round(q(perWord, 0.9)), '\n');

type Estimator = (l: Line, p: number) => number; // returns the spread span in ms
const estimators: Record<string, { fn: Estimator; grid: number[] }> = {
  'E0 old: min(gap, max(1.2s, 650ms*words))': { fn: (l) => Math.min(l.gap!, Math.max(1200, l.n * 650)), grid: [0] },
  'E1 whole gap': { fn: (l) => l.gap!, grid: [0] },
  'E2 rho * gap (rho fitted)': { fn: (l, p) => l.gap! * p, grid: [0.5, 0.6, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95] },
  'E3 gap - pause (pause fitted, ms)': { fn: (l, p) => Math.max(400, l.gap! - p), grid: [0, 150, 300, 450, 600, 800, 1000] },
};

function errorsFor(ls: Line[], fn: Estimator, p: number) {
  const out: { err: number; last: number; cls: string }[] = [];
  for (const l of ls) {
    const span = fn(l, p);
    const sum = l.weights.reduce((a, b) => a + b, 0);
    let acc = 0;
    const perWordMs = (l.trueEnd - l.start) / l.n;
    const cls = perWordMs >= 700 ? 'slow (>=700 ms/word)' : perWordMs >= 350 ? 'normal (350-700)' : 'fast (<350)';
    l.weights.forEach((w, i) => {
      const est = l.start + (span * acc) / sum;
      acc += w;
      const e = est - l.trueStarts[i]!;
      out.push({ err: e, last: i === l.n - 1 ? e : NaN, cls });
    });
  }
  return out;
}
const score = (e: { err: number }[]) => e.map((x) => Math.abs(x.err)).sort((a, b) => a - b);

console.log('leave-one-song-out (each song scored with parameters fitted on the other 19); error = estimate - truth, negative = too early\n');
const songs = [...new Set(usable.map((l) => l.song))];
const results: Record<string, { err: number; last: number; cls: string }[]> = {};
const chosen: Record<string, number[]> = {};
for (const [name, { fn, grid }] of Object.entries(estimators)) {
  results[name] = [];
  chosen[name] = [];
  for (const held of songs) {
    const train = usable.filter((l) => l.song !== held);
    let best = grid[0]!;
    let bestScore = Infinity;
    for (const p of grid) {
      const s = score(errorsFor(train, fn, p));
      const m = s.reduce((a, b) => a + Math.min(b, 2000), 0) / s.length; // mean clipped |err|: stable objective
      if (m < bestScore) {
        bestScore = m;
        best = p;
      }
    }
    chosen[name]!.push(best);
    results[name]!.push(...errorsFor(usable.filter((l) => l.song === held), fn, best));
  }
}
const pad = (s: string, n: number) => s.padEnd(n);
console.log(pad('estimator', 44), 'median|e|  p90|e|  within200  signed med  LAST-word signed med');
for (const [name, e] of Object.entries(results)) {
  const a = score(e);
  const signed = e.map((x) => x.err).sort((x, y) => x - y);
  const last = e.filter((x) => !Number.isNaN(x.last)).map((x) => x.last).sort((x, y) => x - y);
  console.log(pad(name, 44), String(Math.round(q(a, 0.5))).padStart(7), String(Math.round(q(a, 0.9))).padStart(8), (((a.filter((x) => x <= 200).length / a.length) * 100).toFixed(1) + '%').padStart(9), String(Math.round(q(signed, 0.5))).padStart(10), String(Math.round(q(last, 0.5))).padStart(14), '  fitted:', [...new Set(chosen[name])].join('/'));
}
console.log('\nby how fast the line is really sung (E0 old vs E2 fitted):');
for (const cls of ['slow (>=700 ms/word)', 'normal (350-700)', 'fast (<350)']) {
  for (const name of ['E0 old: min(gap, max(1.2s, 650ms*words))', 'E2 rho * gap (rho fitted)']) {
    const e = results[name]!.filter((x) => x.cls === cls);
    const a = score(e);
    const last = e.filter((x) => !Number.isNaN(x.last)).map((x) => x.last).sort((x, y) => x - y);
    console.log(' ', cls.padEnd(22), pad(name.slice(0, 26), 28), 'words', String(e.length).padStart(5), '| median|e|', String(Math.round(q(a, 0.5))).padStart(5), '| within200', (((a.filter((x) => x <= 200).length / a.length) * 100).toFixed(1) + '%').padStart(6), '| last word signed median', Math.round(q(last, 0.5)));
  }
}

// ---- how the sung share of the gap depends on the line's pace (gap per word) -----------------------------------------------
console.log('\nsung share of the gap, by gap-per-word (what a line-level LRC lets us observe):');
const bins: [number, number][] = [[0, 350], [350, 500], [500, 700], [700, 1000], [1000, 1500], [1500, 1e9]];
for (const [lo, hi] of bins) {
  const r = usable.filter((l) => l.gap! / l.n >= lo && l.gap! / l.n < hi);
  const share = r.map((l) => (l.trueEnd - l.start) / l.gap!).sort((a, b) => a - b);
  const pw = r.map((l) => (l.trueEnd - l.start) / l.n).sort((a, b) => a - b);
  if (r.length) console.log(`  gap/word ${String(lo).padStart(4)}-${hi > 1e8 ? 'inf' : String(hi).padEnd(4)} ms | lines ${String(r.length).padStart(3)} | sung share median ${q(share, 0.5).toFixed(2)} (p25 ${q(share, 0.25).toFixed(2)}, p75 ${q(share, 0.75).toFixed(2)}) | sung ms/word median ${Math.round(q(pw, 0.5))}`);
}

// ---- E5: pace-aware share of the gap (median share per gap-per-word bin, fitted on the other 19 songs) --------------------------
{
  const edges = [0, 350, 500, 700, 1000, 1500, 1e9];
  const interp = (table: number[], g: number) => {
    const mids = [200, 425, 600, 850, 1250, 2200]; // representative gap/word of each bin
    if (g <= mids[0]!) return table[0]!;
    for (let i = 1; i < mids.length; i++) if (g <= mids[i]!) return table[i - 1]! + ((table[i]! - table[i - 1]!) * (g - mids[i - 1]!)) / (mids[i]! - mids[i - 1]!);
    return table.at(-1)!;
  };
  const fit = (train: Line[]) =>
    edges.slice(0, -1).map((lo, i) => {
      const r = train.filter((l) => l.gap! / l.n >= lo && l.gap! / l.n < edges[i + 1]!).map((l) => (l.trueEnd - l.start) / l.gap!).sort((a, b) => a - b);
      return r.length >= 8 ? q(r, 0.5) : 0.85;
    });
  const all5: { err: number; last: number; cls: string }[] = [];
  for (const held of songs) {
    const table = fit(usable.filter((l) => l.song !== held));
    all5.push(...errorsFor(usable.filter((l) => l.song === held), (l) => l.gap! * interp(table, l.gap! / l.n), 0));
  }
  results['E5 pace-aware share of gap (LOSO)'] = all5;
  const full = fit(usable);
  console.log('\nE5 table fitted on all 20 songs (share of gap at gap/word 200, 425, 600, 850, 1250, 2200 ms):', full.map((x) => x.toFixed(2)).join(' '));
  console.log('\n' + pad('estimator', 44), 'median|e|  p90|e|  within200  signed med  LAST-word signed med');
  for (const name of ['E0 old: min(gap, max(1.2s, 650ms*words))', 'E2 rho * gap (rho fitted)', 'E5 pace-aware share of gap (LOSO)']) {
    const e = results[name]!;
    const a = score(e);
    const signed = e.map((x) => x.err).sort((x, y) => x - y);
    const last = e.filter((x) => !Number.isNaN(x.last)).map((x) => x.last).sort((x, y) => x - y);
    console.log(pad(name, 44), String(Math.round(q(a, 0.5))).padStart(7), String(Math.round(q(a, 0.9))).padStart(8), (((a.filter((x) => x <= 200).length / a.length) * 100).toFixed(1) + '%').padStart(9), String(Math.round(q(signed, 0.5))).padStart(10), String(Math.round(q(last, 0.5))).padStart(14));
  }
  console.log('\nby how fast the line is really sung (E0 old vs E5):');
  for (const cls of ['slow (>=700 ms/word)', 'normal (350-700)', 'fast (<350)']) {
    for (const name of ['E0 old: min(gap, max(1.2s, 650ms*words))', 'E5 pace-aware share of gap (LOSO)']) {
      const e = results[name]!.filter((x) => x.cls === cls);
      const a = score(e);
      const last = e.filter((x) => !Number.isNaN(x.last)).map((x) => x.last).sort((x, y) => x - y);
      console.log(' ', cls.padEnd(22), pad(name.slice(0, 26), 28), '| median|e|', String(Math.round(q(a, 0.5))).padStart(5), '| p90', String(Math.round(q(a, 0.9))).padStart(5), '| within200', (((a.filter((x) => x <= 200).length / a.length) * 100).toFixed(1) + '%').padStart(6), '| last word signed median', Math.round(q(last, 0.5)));
    }
  }
}

// ---- E6: pace-aware share of the gap, each bin fitted directly on ONSET error (leave-one-song-out) -----------------------------
{
  const edges = [0, 350, 500, 700, 1000, 1500, 1e9];
  const mids = [200, 425, 600, 850, 1250, 2200];
  const grid = [0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 1.0];
  const interp = (table: number[], g: number) => {
    if (g <= mids[0]!) return table[0]!;
    for (let i = 1; i < mids.length; i++) if (g <= mids[i]!) return table[i - 1]! + ((table[i]! - table[i - 1]!) * (g - mids[i - 1]!)) / (mids[i]! - mids[i - 1]!);
    return table.at(-1)!;
  };
  const fit = (train: Line[]) =>
    edges.slice(0, -1).map((lo, i) => {
      const r = train.filter((l) => l.gap! / l.n >= lo && l.gap! / l.n < edges[i + 1]!);
      if (r.length < 8) return 0.8;
      let best = 0.8;
      let bestScore = Infinity;
      for (const rho of grid) {
        const s = score(errorsFor(r, (l) => l.gap! * rho, 0));
        const m = s.reduce((a, b) => a + Math.min(b, 2000), 0) / s.length;
        if (m < bestScore) {
          bestScore = m;
          best = rho;
        }
      }
      return best;
    });
  const all6: { err: number; last: number; cls: string }[] = [];
  for (const held of songs) {
    const table = fit(usable.filter((l) => l.song !== held));
    all6.push(...errorsFor(usable.filter((l) => l.song === held), (l) => l.gap! * interp(table, l.gap! / l.n), 0));
  }
  results['E6 pace-aware, fitted on onsets (LOSO)'] = all6;
  console.log('\nE6 table fitted on all 20 songs (share of gap for the SPREAD at gap/word 200, 425, 600, 850, 1250, 2200 ms):', fit(usable).map((x) => x.toFixed(2)).join(' '));
  console.log('\n' + pad('estimator', 44), 'median|e|  p90|e|  within100  within200  within500  signed med  LAST-word signed med');
  for (const name of ['E0 old: min(gap, max(1.2s, 650ms*words))', 'E2 rho * gap (rho fitted)', 'E6 pace-aware, fitted on onsets (LOSO)']) {
    const e = results[name]!;
    const a = score(e);
    const signed = e.map((x) => x.err).sort((x, y) => x - y);
    const last = e.filter((x) => !Number.isNaN(x.last)).map((x) => x.last).sort((x, y) => x - y);
    const w = (t: number) => (((a.filter((x) => x <= t).length / a.length) * 100).toFixed(1) + '%').padStart(9);
    console.log(pad(name, 44), String(Math.round(q(a, 0.5))).padStart(7), String(Math.round(q(a, 0.9))).padStart(8), w(100), w(200), w(500), String(Math.round(q(signed, 0.5))).padStart(10), String(Math.round(q(last, 0.5))).padStart(14));
  }
  console.log('\nby how fast the line is really sung (E0 old vs E2 vs E6):');
  for (const cls of ['slow (>=700 ms/word)', 'normal (350-700)', 'fast (<350)']) {
    for (const name of ['E0 old: min(gap, max(1.2s, 650ms*words))', 'E2 rho * gap (rho fitted)', 'E6 pace-aware, fitted on onsets (LOSO)']) {
      const e = results[name]!.filter((x) => x.cls === cls);
      const a = score(e);
      const last = e.filter((x) => !Number.isNaN(x.last)).map((x) => x.last).sort((x, y) => x - y);
      console.log(' ', cls.padEnd(22), pad(name.slice(0, 26), 28), '| median|e|', String(Math.round(q(a, 0.5))).padStart(5), '| p90', String(Math.round(q(a, 0.9))).padStart(5), '| within200', (((a.filter((x) => x <= 200).length / a.length) * 100).toFixed(1) + '%').padStart(6), '| last word signed median', Math.round(q(last, 0.5)));
    }
  }
}

// ---- E7: E6 plus the song's own cadence: a long gap is a PAUSE if it is long for this song, slow SINGING if every line is -----------
{
  const songPace = new Map<string, number>();
  for (const s of songs) {
    const g = usable.filter((l) => l.song === s).map((l) => l.gap! / l.n).sort((a, b) => a - b);
    songPace.set(s, g[g.length >> 1]!);
  }
  const rel = (l: Line) => l.gap! / l.n / songPace.get(l.song)!;
  const edges = [0, 0.8, 1.0, 1.25, 1.6, 2.5, 1e9];
  const mids = [0.65, 0.9, 1.12, 1.4, 2.0, 3.5];
  const grid = [0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 1.0];
  const interp = (table: number[], x: number) => {
    if (x <= mids[0]!) return table[0]!;
    for (let i = 1; i < mids.length; i++) if (x <= mids[i]!) return table[i - 1]! + ((table[i]! - table[i - 1]!) * (x - mids[i - 1]!)) / (mids[i]! - mids[i - 1]!);
    return table.at(-1)!;
  };
  const fit = (train: Line[]) =>
    edges.slice(0, -1).map((lo, i) => {
      const r = train.filter((l) => rel(l) >= lo && rel(l) < edges[i + 1]!);
      if (r.length < 8) return 0.8;
      let best = 0.8;
      let bestScore = Infinity;
      for (const rho of grid) {
        const s = score(errorsFor(r, (l) => l.gap! * rho, 0));
        const m = s.reduce((a, b) => a + Math.min(b, 2000), 0) / s.length;
        if (m < bestScore) {
          bestScore = m;
          best = rho;
        }
      }
      return best;
    });
  const all7: { err: number; last: number; cls: string }[] = [];
  for (const held of songs) {
    const table = fit(usable.filter((l) => l.song !== held));
    all7.push(...errorsFor(usable.filter((l) => l.song === held), (l) => l.gap! * interp(table, rel(l)), 0));
  }
  results['E7 + song cadence (LOSO)'] = all7;
  console.log('\nE7 table fitted on all 20 songs (share for the spread at relative pace 0.65, 0.9, 1.1, 1.4, 2.0, 3.5 x the song median):', fit(usable).map((x) => x.toFixed(2)).join(' '));
  console.log('\n' + pad('estimator', 44), 'median|e|  p90|e|  within100  within200  within500  signed med  LAST-word signed med');
  for (const name of ['E0 old: min(gap, max(1.2s, 650ms*words))', 'E6 pace-aware, fitted on onsets (LOSO)', 'E7 + song cadence (LOSO)']) {
    const e = results[name]!;
    const a = score(e);
    const signed = e.map((x) => x.err).sort((x, y) => x - y);
    const last = e.filter((x) => !Number.isNaN(x.last)).map((x) => x.last).sort((x, y) => x - y);
    const w = (t: number) => (((a.filter((x) => x <= t).length / a.length) * 100).toFixed(1) + '%').padStart(9);
    console.log(pad(name, 44), String(Math.round(q(a, 0.5))).padStart(7), String(Math.round(q(a, 0.9))).padStart(8), w(100), w(200), w(500), String(Math.round(q(signed, 0.5))).padStart(10), String(Math.round(q(last, 0.5))).padStart(14));
  }
  console.log('\nby how fast the line is really sung (E0 old vs E6 vs E7):');
  for (const cls of ['slow (>=700 ms/word)', 'normal (350-700)', 'fast (<350)']) {
    for (const name of ['E0 old: min(gap, max(1.2s, 650ms*words))', 'E6 pace-aware, fitted on onsets (LOSO)', 'E7 + song cadence (LOSO)']) {
      const e = results[name]!.filter((x) => x.cls === cls);
      const a = score(e);
      const last = e.filter((x) => !Number.isNaN(x.last)).map((x) => x.last).sort((x, y) => x - y);
      console.log(' ', cls.padEnd(22), pad(name.slice(0, 26), 28), '| median|e|', String(Math.round(q(a, 0.5))).padStart(5), '| p90', String(Math.round(q(a, 0.9))).padStart(5), '| within200', (((a.filter((x) => x <= 200).length / a.length) * 100).toFixed(1) + '%').padStart(6), '| last word signed median', Math.round(q(last, 0.5)));
    }
  }
}

// ---- E8: E6 with an asymmetric loss (a word that appears EARLY is worse than one that is a little late) -------------------------
{
  const EARLY_WEIGHT = 2;
  const edges = [0, 350, 500, 700, 1000, 1500, 1e9];
  const mids = [200, 425, 600, 850, 1250, 2200];
  const grid = [0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 1.0];
  const interp = (table: number[], g: number) => {
    if (g <= mids[0]!) return table[0]!;
    for (let i = 1; i < mids.length; i++) if (g <= mids[i]!) return table[i - 1]! + ((table[i]! - table[i - 1]!) * (g - mids[i - 1]!)) / (mids[i]! - mids[i - 1]!);
    return table.at(-1)!;
  };
  const fit = (train: Line[]) =>
    edges.slice(0, -1).map((lo, i) => {
      const r = train.filter((l) => l.gap! / l.n >= lo && l.gap! / l.n < edges[i + 1]!);
      if (r.length < 8) return 0.8;
      let best = 0.8;
      let bestScore = Infinity;
      for (const rho of grid) {
        const errs = errorsFor(r, (l) => l.gap! * rho, 0);
        const m = errs.reduce((a, x) => a + Math.min(Math.abs(x.err), 2000) * (x.err < 0 ? EARLY_WEIGHT : 1), 0) / errs.length;
        if (m < bestScore) {
          bestScore = m;
          best = rho;
        }
      }
      return best;
    });
  const all8: { err: number; last: number; cls: string }[] = [];
  for (const held of songs) {
    const table = fit(usable.filter((l) => l.song !== held));
    all8.push(...errorsFor(usable.filter((l) => l.song === held), (l) => l.gap! * interp(table, l.gap! / l.n), 0));
  }
  results['E8 pace-aware, early errors x2 (LOSO)'] = all8;
  console.log('\nE8 table fitted on all 20 songs (share for the spread at gap/word 200, 425, 600, 850, 1250, 2200 ms):', fit(usable).map((x) => x.toFixed(2)).join(' '));
  console.log('\n' + pad('estimator', 44), 'median|e|  within200  early>300ms  late>300ms  signed med  LAST-word signed med  slow-class LAST');
  for (const name of ['E0 old: min(gap, max(1.2s, 650ms*words))', 'E6 pace-aware, fitted on onsets (LOSO)', 'E8 pace-aware, early errors x2 (LOSO)']) {
    const e = results[name]!;
    const a = score(e);
    const signed = e.map((x) => x.err).sort((x, y) => x - y);
    const last = e.filter((x) => !Number.isNaN(x.last)).map((x) => x.last).sort((x, y) => x - y);
    const slowLast = e.filter((x) => x.cls.startsWith('slow') && !Number.isNaN(x.last)).map((x) => x.last).sort((x, y) => x - y);
    const early = (e.filter((x) => x.err < -300).length / e.length) * 100;
    const late = (e.filter((x) => x.err > 300).length / e.length) * 100;
    console.log(pad(name, 44), String(Math.round(q(a, 0.5))).padStart(7), (((a.filter((x) => x <= 200).length / a.length) * 100).toFixed(1) + '%').padStart(9), (early.toFixed(1) + '%').padStart(11), (late.toFixed(1) + '%').padStart(11), String(Math.round(q(signed, 0.5))).padStart(10), String(Math.round(q(last, 0.5))).padStart(14), String(Math.round(q(slowLast, 0.5))).padStart(15));
  }
}
