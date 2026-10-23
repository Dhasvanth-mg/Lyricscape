// Dev tool: renders a sample recap (synthetic photos + a demo song) so you can eyeball the result.
//   npx tsx scripts/render-sample.ts <outDir> [demoTrackId] [aspect]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { analyzeAudio } from '../lib/recap/analyze';
import { decodeWav } from '../lib/recap/wav';
import { planRecap, type PlanAsset } from '../lib/recap/plan';
import { buildRenderPlan } from '../lib/recap/ffmpeg';
import { patternPng } from '../tests/helpers/png';

const require = createRequire(import.meta.url);
const out = path.resolve(process.argv[2] ?? 'recap-sample');
const trackId = process.argv[3] ?? 'glass-hours';
const aspect = (process.argv[4] ?? '9:16') as '9:16' | '1:1' | '16:9';
mkdirSync(out, { recursive: true });

const wav = path.resolve(`public/demo/${trackId}.wav`);
const audio = decodeWav(readFileSync(wav));
const analysis = analyzeAudio(audio.samples, audio.sampleRate);
const files: Record<string, { path: string; mediaType: 'image' }> = {};
const assets: PlanAsset[] = [];
for (let i = 0; i < 10; i++) {
  const p = path.join(out, `img${i}.png`);
  writeFileSync(p, patternPng(i % 2 ? 800 : 600, i % 2 ? 600 : 800, i + 3));
  files[`i${i}`] = { path: p, mediaType: 'image' };
  assets.push({ id: `i${i}`, mediaType: 'image', takenAtMs: i * 1000, uploaderId: `u${i % 3}`, uploaderName: `Guest ${i % 3}`, quality: 0.7, pinned: i === 2 });
}
const tl = planRecap({ assets, analysis, audio: { source: { kind: 'demo', id: trackId }, license: 'CC0' }, preset: 'quick', aspect, targetMs: 30000, title: 'Roof Party' });
console.log(`bpm ${analysis.bpm}  window ${tl.audio.sourceInMs}-${tl.audio.sourceOutMs}ms  clips ${tl.clips.length}`);
console.log('cut lengths (ms):', tl.clips.map((c) => c.durationMs).join(', '));
console.log('transitions:', tl.clips.map((c) => c.transition.type[0]).join(''));
console.log('notes:', tl.notes);
const ff = require('ffmpeg-static') as string;
const plan = buildRenderPlan(tl, { files, audioPath: wav }, { quality: 'preview', outPath: path.join(out, 'sample.mp4'), fontFile: 'C:/Windows/Fonts/arialbd.ttf' });
const r = spawnSync(ff, plan.args, { encoding: 'utf8', maxBuffer: 1 << 28 });
console.log('ffmpeg exit', r.status);
if (r.status) console.log((r.stderr ?? '').slice(-600));
