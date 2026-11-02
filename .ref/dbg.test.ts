import { it } from 'vitest';
import { FeatureTrack } from '@/lib/analysis/features';
it('dbg', () => {
  const sr = 48000;
  const out = new Float32Array(40 * sr);
  for (let i = 0; i < out.length; i++) out[i] = 0.05 * Math.sin((2 * Math.PI * 220 * i) / sr);
  const t = new FeatureTrack(40000);
  for (let i = 0; i < out.length; i += 2 * sr) t.pushPcm(out.subarray(i, i + 2 * sr), sr, (i * 1000) / sr);
  let h = 0; for (const v of t.heard) h += v;
  console.log('heard bins', h, 'of', t.heard.length, 'runs', JSON.stringify(t.coveredRuns()));
  const f = t.toFeatures('file');
  console.log(f.bpm, f.bpmConfidence);
});
