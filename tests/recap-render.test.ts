import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { analyzeAudio } from '@/lib/recap/analyze';
import { decodeWav } from '@/lib/recap/wav';
import { planRecap, type PlanAsset } from '@/lib/recap/plan';
import { buildRenderPlan, escapeDrawtext, parseProgressMs } from '@/lib/recap/ffmpeg';
import { validateTimeline } from '@/lib/recap/timeline';
import { patternPng } from './helpers/png';

const require_ = (await import('node:module')).createRequire(import.meta.url);
function tool(name: 'ffmpeg-static' | 'ffprobe-static'): string | null {
  try {
    const m = require_(name);
    const p: string = typeof m === 'string' ? m : m.path;
    return p && existsSync(p) ? p : null;
  } catch {
    return null;
  }
}
const FFMPEG = process.env.FFMPEG_PATH ?? tool('ffmpeg-static');
const FFPROBE = process.env.FFPROBE_PATH ?? tool('ffprobe-static');
const haveFfmpeg = !!FFMPEG && !!FFPROBE;
const font = ['C:/Windows/Fonts/arialbd.ttf', 'C:/Windows/Fonts/arial.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', '/System/Library/Fonts/Supplemental/Arial Bold.ttf'].find((f) => existsSync(f));

const dir = mkdtempSync(path.join(tmpdir(), 'lyricscape-render-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const wavPath = path.join(process.cwd(), 'public/demo/neon-static.wav');
const audio = decodeWav(readFileSync(wavPath));
const analysis = analyzeAudio(audio.samples, audio.sampleRate);

function assetsFor(n: number): { assets: PlanAsset[]; files: Record<string, { path: string; mediaType: 'image' | 'video' }> } {
  const assets: PlanAsset[] = [];
  const files: Record<string, { path: string; mediaType: 'image' | 'video' }> = {};
  for (let i = 0; i < n; i++) {
    const id = `img${i}`;
    const p = path.join(dir, `${id}.png`);
    writeFileSync(p, patternPng(i % 2 ? 640 : 480, i % 2 ? 480 : 640, i + 1));
    assets.push({ id, mediaType: 'image', takenAtMs: 1000 * i, uploaderId: `u${i % 3}`, uploaderName: `Guest ${i % 3}`, quality: 0.6 + (i % 4) * 0.1, pinned: false });
    files[id] = { path: p, mediaType: 'image' };
  }
  return { assets, files };
}

describe('render command builder (no FFmpeg needed)', () => {
  const { assets, files } = assetsFor(6);
  const tl = planRecap({ assets, analysis, audio: { source: { kind: 'demo', id: 'neon-static' }, license: 'CC0', title: 'Neon Static' }, preset: 'quick', aspect: '9:16', targetMs: 30_000, title: "Sam's Party: 100%" });

  it('produces a complete, well-formed argument list', () => {
    const plan = buildRenderPlan(tl, { files, audioPath: wavPath }, { quality: 'preview', outPath: path.join(dir, 'x.mp4'), fontFile: font });
    expect(plan.width % 2 === 0 && plan.height % 2 === 0).toBe(true);
    expect(Math.min(plan.width, plan.height)).toBe(540);
    expect(plan.args).toContain('-filter_complex');
    expect(plan.args).toContain('libx264');
    expect(plan.args[plan.args.length - 1]).toBe(path.join(dir, 'x.mp4'));
    const graph = plan.args[plan.args.indexOf('-filter_complex') + 1]!;
    expect(graph).toContain(`concat=n=${tl.clips.length}`);
    expect(graph).toContain('loudnorm');
    expect(plan.args.join(' ')).toContain('-map_metadata -1'); // EXIF/GPS stripped
    // one input per clip plus the soundtrack
    expect(plan.args.filter((a) => a === '-i')).toHaveLength(tl.clips.length + 1);
  });

  it('final quality renders at full resolution for each aspect ratio', () => {
    for (const aspect of ['9:16', '1:1', '16:9'] as const) {
      const p = buildRenderPlan({ ...tl, aspect }, { files, audioPath: wavPath }, { quality: 'final', outPath: 'o.mp4' });
      expect([p.width, p.height]).toEqual(aspect === '9:16' ? [1080, 1920] : aspect === '1:1' ? [1080, 1080] : [1920, 1080]);
    }
  });

  it('escapes caption text and skips captions without a font (reporting it)', () => {
    expect(escapeDrawtext("Sam's: 100% \\ party")).toBe('Sam\u2019s\\: 100\\% \\\\ party');
    const p = buildRenderPlan(tl, { files, audioPath: wavPath }, { quality: 'preview', outPath: 'o.mp4' });
    expect(p.skipped[0]).toMatch(/font/i);
    expect(p.args[p.args.indexOf('-filter_complex') + 1]).not.toContain('drawtext');
  });

  it('refuses to build when an input file is missing', () => {
    expect(() => buildRenderPlan(tl, { files: {}, audioPath: wavPath }, { quality: 'preview', outPath: 'o.mp4' })).toThrow(/Missing input/);
  });

  it('parses FFmpeg progress output', () => {
    expect(parseProgressMs('frame=10\nout_time_us=1500000\nprogress=continue\n')).toBe(1500);
    expect(parseProgressMs('nothing')).toBeNull();
  });
});

describe.skipIf(!haveFfmpeg)('real FFmpeg render', () => {
  const probe = (file: string) => JSON.parse(execFileSync(FFPROBE!, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file]).toString()) as {
    streams: { codec_type: string; codec_name: string; width?: number; height?: number; r_frame_rate?: string }[];
    format: { duration: string; tags?: Record<string, string> };
  };

  it('renders a 9:16 preview MP4 from photos, with beat-synced length, H.264 video and AAC audio', () => {
    const { assets, files } = assetsFor(8);
    const tl = planRecap({ assets, analysis, audio: { source: { kind: 'demo', id: 'neon-static' }, license: 'CC0' }, preset: 'quick', aspect: '9:16', targetMs: 30_000, title: 'Roof Party' });
    const out = path.join(dir, 'preview.mp4');
    const plan = buildRenderPlan(tl, { files, audioPath: wavPath }, { quality: 'preview', outPath: out, fontFile: font });
    const r = spawnSync(FFMPEG!, plan.args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    expect(r.status, r.stderr?.slice(-1500)).toBe(0);
    const info = probe(out);
    const v = info.streams.find((s) => s.codec_type === 'video')!;
    const a = info.streams.find((s) => s.codec_type === 'audio')!;
    expect(v.codec_name).toBe('h264');
    expect(a.codec_name).toBe('aac');
    expect([v.width, v.height]).toEqual([plan.width, plan.height]);
    expect(v.r_frame_rate).toBe('30/1');
    expect(Math.abs(Number(info.format.duration) - tl.durationMs / 1000)).toBeLessThan(0.35);
    expect(info.format.tags?.location).toBeUndefined(); // no GPS or source metadata carried over
  }, 240_000);

  it('handles videos (trim, hold last frame) mixed with photos in 16:9', () => {
    const vid = path.join(dir, 'clip.mp4');
    const g = spawnSync(FFMPEG!, ['-y', '-f', 'lavfi', '-i', 'testsrc=duration=3:size=320x240:rate=25', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', vid], { encoding: 'utf8' });
    expect(g.status, g.stderr?.slice(-500)).toBe(0);
    const { assets, files } = assetsFor(4);
    assets.push({ id: 'vid1', mediaType: 'video', durationMs: 3000, takenAtMs: 500, uploaderId: 'u9', uploaderName: 'Videographer', quality: 0.9, pinned: true });
    files.vid1 = { path: vid, mediaType: 'video' };
    const tl = planRecap({ assets, analysis, audio: { source: { kind: 'demo', id: 'neon-static' }, license: 'CC0' }, preset: 'quick', aspect: '16:9', targetMs: 30_000 });
    expect(tl.clips.some((c) => c.assetId === 'vid1')).toBe(true);
    expect(validateTimeline(tl, new Map(assets.map((x) => [x.id, { id: x.id, mediaType: x.mediaType, durationMs: x.durationMs }])))).toEqual([]);
    const out = path.join(dir, 'mixed.mp4');
    const plan = buildRenderPlan(tl, { files, audioPath: wavPath }, { quality: 'preview', outPath: out });
    const r = spawnSync(FFMPEG!, plan.args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    expect(r.status, r.stderr?.slice(-1500)).toBe(0);
    const info = probe(out);
    expect(info.streams.find((s) => s.codec_type === 'video')!.width).toBeGreaterThan(info.streams.find((s) => s.codec_type === 'video')!.height!);
    expect(Math.abs(Number(info.format.duration) - tl.durationMs / 1000)).toBeLessThan(0.35);
  }, 240_000);

  it('fails loudly (non-zero exit) when an input is corrupt, so the job can retry/fail', () => {
    const { assets, files } = assetsFor(3);
    const bad = path.join(dir, 'corrupt.png');
    writeFileSync(bad, Buffer.from('definitely not a png'));
    files.img0 = { path: bad, mediaType: 'image' };
    const tl = planRecap({ assets, analysis, audio: { source: { kind: 'demo', id: 'neon-static' }, license: 'CC0' }, preset: 'quick', aspect: '1:1', targetMs: 30_000 });
    const plan = buildRenderPlan(tl, { files, audioPath: wavPath }, { quality: 'preview', outPath: path.join(dir, 'bad.mp4') });
    const r = spawnSync(FFMPEG!, plan.args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    expect(r.status).not.toBe(0);
  }, 120_000);
});
