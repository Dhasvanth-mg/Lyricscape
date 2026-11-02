import { readFileSync } from 'node:fs';
import { analysePcm } from '../lib/analysis/features';
function wav(path: string) {
  const b = readFileSync(path);
  let o = 12; let sr = 44100; let data = new Int16Array(0);
  while (o < b.length - 8) {
    const id = b.toString('ascii', o, o + 4); const size = b.readUInt32LE(o + 4);
    if (id === 'fmt ') sr = b.readUInt32LE(o + 12);
    if (id === 'data') { const n = Math.floor(Math.min(size, b.length - o - 8) / 2); data = new Int16Array(n); for (let i = 0; i < n; i++) data[i] = b.readInt16LE(o + 8 + i * 2); break; }
    o += 8 + size + (size & 1);
  }
  const f = new Float32Array(data.length); for (let i = 0; i < f.length; i++) f[i] = data[i]! / 32768;
  return { pcm: f, sr };
}
const names: Record<string, string> = { '694fa714': 'code-edit reel', '72e21f11': 'sketch-card reel', cc727550: 'Flashing Lights reel', efd517ab: 'Let It Happen reel', f4981a96: 'We Are The People reel' };
(async () => {
  for (const id of Object.keys(names)) {
    const { pcm, sr } = wav(`${process.argv[2]}/${id}.wav`);
    const t0 = Date.now();
    const f = await analysePcm(pcm, sr);
    let peak = 0; for (let i = 0; i < pcm.length; i += 97) peak = Math.max(peak, Math.abs(pcm[i]!));
    console.log(names[id]!.padEnd(24), `${(pcm.length / sr).toFixed(1)}s`.padEnd(7), 'bpm', String(f.bpm).padEnd(7), 'conf', f.bpmConfidence.toFixed(2), 'beats', f.beatTimesMs.length, 'loud', f.loudnessDb, 'peak', peak.toFixed(2), `${Date.now() - t0}ms`);
  }
})();
