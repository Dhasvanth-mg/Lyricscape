import { readFileSync } from 'node:fs';
import { FFT } from '../lib/analysis/fft';
const dir = process.argv[2]!;
const cap = new Float32Array(readFileSync(dir + '/captured.f32').buffer.slice(0));
const sr = Number(readFileSync(dir + '/captured.sr', 'utf8'));
// file at 44.1k
const b = readFileSync(dir + '/efd517ab.wav'); const n = (b.length - 44) / 2; const file = new Float32Array(n); for (let i = 0; i < n; i++) file[i] = b.readInt16LE(44 + i * 2) / 32768;
function bands(x: Float32Array, rate: number, from: number, secs: number) {
  const N = 4096, f = new FFT(N); const out = [0, 0, 0, 0, 0]; let frames = 0; const edges = [30, 200, 1000, 4000, 8000, 20000];
  for (let p = Math.round(from * rate); p + N < Math.min(x.length, Math.round((from + secs) * rate)); p += N) {
    const re = new Float32Array(N), im = new Float32Array(N); for (let i = 0; i < N; i++) re[i] = x[p + i]! * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)));
    f.transform(re, im);
    for (let k = 1; k < N / 2; k++) { const hz = (k * rate) / N; for (let e = 0; e < 5; e++) if (hz >= edges[e]! && hz < edges[e + 1]!) out[e] += (re[k]! ** 2 + im[k]! ** 2); }
    frames++;
  }
  return out.map((v) => (10 * Math.log10(v / frames + 1e-12)).toFixed(1));
}
console.log('captured samples', cap.length, 'sr', sr, 'secs', (cap.length / sr).toFixed(1));
console.log('band energy dB (30-200, 200-1k, 1-4k, 4-8k, 8-20k)');
// find where the capture's content starts, then align by cross-correlating coarse envelopes
const env = (x: Float32Array, rate: number) => { const st = Math.round(rate * 0.01); const e: number[] = []; for (let i = 0; i + st < x.length; i += st) { let s = 0; for (let k = 0; k < st; k++) s += x[i + k]! ** 2; e.push(Math.sqrt(s / st)); } return e; };
const ce = env(cap, sr), fe = env(file, 44100);
const norm = (e: number[]) => { const m = e.reduce((a, b) => a + b, 0) / e.length; const sd = Math.sqrt(e.reduce((a, b) => a + (b - m) ** 2, 0) / e.length) || 1; return e.map((v) => (v - m) / sd); };
const cn = norm(ce.slice(0, 800)), fn = norm(fe.slice(0, 1600));
let best = -1, lag = 0; for (let L = 0; L < 800; L++) { let s = 0; for (let i = 0; i < 700; i++) s += cn[i]! * fn[i + L]!; if (s > best) { best = s; lag = L; } }
console.log('best envelope correlation', (best / 700).toFixed(2), 'at file offset', lag * 10, 'ms (capture starts', lag * 10, 'ms into the file)');
const from = lag * 0.01 + 1;
console.log('file    ', bands(file, 44100, from, 6).join(' | '));
console.log('captured', bands(cap, sr, 1, 6).join(' | '));
