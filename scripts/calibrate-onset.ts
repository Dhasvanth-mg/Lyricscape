// Dev tool: measure how far detected beats sit from the true hit times on the demo songs.
import { readFileSync } from 'node:fs';
import { decodeWav } from '../lib/recap/wav';
import { analyzeAudio } from '../lib/recap/analyze';

const catalog = JSON.parse(readFileSync('public/demo/catalog.json', 'utf8')) as { id: string; bpm: number; beatTimesMs: number[] }[];
for (const t of catalog) {
  const { samples, sampleRate } = decodeWav(readFileSync(`public/demo/${t.id}.wav`));
  const a = analyzeAudio(samples, sampleRate);
  const errs = a.beatTimesMs.slice(4, 40).map((b) => {
    const gt = t.beatTimesMs.reduce((best, g) => (Math.abs(g - b) < Math.abs(best - b) ? g : best), t.beatTimesMs[0]!);
    return b - gt;
  });
  errs.sort((x, y) => x - y);
  console.log(t.id, 'gt bpm', t.bpm, 'est', a.bpm, 'conf', a.tempoConfidence, 'median err ms', errs[errs.length >> 1], 'min/max', errs[0], errs[errs.length - 1], 'downbeat', a.downbeatIndex, 'sections', a.sections.map((s) => s.label + '@' + Math.round(s.startMs / 1000)).join(','));
}
