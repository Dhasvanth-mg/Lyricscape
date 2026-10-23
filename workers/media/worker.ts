// Lyricscape media worker: a SEPARATE process that does the heavy lifting (analysis, planning, FFmpeg).
//
//   pnpm worker                      (web app must be running)
//   WORKER_BASE_URL=http://127.0.0.1:3000 MEDIA_WORKER_SECRET=... pnpm worker
//
// It talks to the web app only over HTTP with a shared secret, exactly how a deployed worker
// (container / VM) would. Nothing here runs inside a Vercel-style request handler.

import { spawn, spawnSync } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, createReadStream } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import os from 'node:os';
import path from 'node:path';
import { analyzeAudio } from '../../lib/recap/analyze';
import { decodeWav } from '../../lib/recap/wav';
import { assessQuality, dedupe, type GrayImage } from '../../lib/recap/mediaScore';
import { PlanError, planRecap, type PlanAsset } from '../../lib/recap/plan';
import { buildRenderPlan, parseProgressMs } from '../../lib/recap/ffmpeg';
import type { AssetAssessment, ClaimedJob, PlanResult } from '../../lib/recap/jobs';

const require = createRequire(import.meta.url);

// ---------------------------------------------------------------------------
// config
// ---------------------------------------------------------------------------
const BASE = (process.env.WORKER_BASE_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '');
const WORKER_ID = `${os.hostname()}-${randomUUID().slice(0, 6)}`;

function secret(): string {
  if (process.env.MEDIA_WORKER_SECRET) return process.env.MEDIA_WORKER_SECRET;
  // local dev: derive from the web app's secret file, same as the server does
  const dataDir = path.resolve(process.cwd(), process.env.LYRICSCAPE_DATA_DIR ?? '.data');
  const fromEnv = process.env.LYRICSCAPE_SECRET;
  const file = path.join(dataDir, 'secret.key');
  const s = fromEnv ?? (existsSync(file) ? readFileSync(file, 'utf8').trim() : null);
  if (!s) throw new Error('No worker secret. Start the web app once (creates .data/secret.key) or set MEDIA_WORKER_SECRET.');
  return createHash('sha256').update(`worker:${s}`).digest('hex');
}

function findTool(envName: string, pkg: 'ffmpeg-static' | 'ffprobe-static', fallback: string): string {
  if (process.env[envName]) return process.env[envName]!;
  try {
    const m = require(pkg);
    const p: string = typeof m === 'string' ? m : m.path;
    if (p && existsSync(p)) return p;
  } catch {
    /* fall through to PATH */
  }
  return fallback;
}
const FFMPEG = findTool('FFMPEG_PATH', 'ffmpeg-static', 'ffmpeg');
const FFPROBE = findTool('FFPROBE_PATH', 'ffprobe-static', 'ffprobe');
const FONT = process.env.RECAP_FONT ?? ['C:/Windows/Fonts/arialbd.ttf', 'C:/Windows/Fonts/arial.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', '/System/Library/Fonts/Supplemental/Arial Bold.ttf'].find((f) => existsSync(f));
const WORK_ROOT = path.join(os.tmpdir(), 'lyricscape-worker');
const log = (...a: unknown[]) => console.log(`[worker ${new Date().toISOString().slice(11, 19)}]`, ...a);

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------
const headers = () => ({ Authorization: `Bearer ${secret()}` });

async function call<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(BASE + url, { method, headers: { ...headers(), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${url} -> ${res.status} ${text.slice(0, 200)}`);
  return (text ? JSON.parse(text) : {}) as T;
}

async function download(url: string, dest: string, auth = true) {
  const res = await fetch(BASE + url, { headers: auth ? headers() : undefined });
  if (!res.ok || !res.body) throw new Error(`download ${url} -> ${res.status}`);
  await pipeline(Readable.fromWeb(res.body as never), createWriteStream(dest));
}

// ---------------------------------------------------------------------------
// FFmpeg helpers
// ---------------------------------------------------------------------------
type Probe = { ok: boolean; width?: number; height?: number; durationMs?: number; hasVideo: boolean; hasAudio: boolean };
function probe(file: string): Probe {
  const r = spawnSync(FFPROBE, ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', file], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (r.status !== 0) return { ok: false, hasVideo: false, hasAudio: false };
  try {
    const j = JSON.parse(r.stdout) as { streams?: { codec_type: string; width?: number; height?: number; duration?: string; side_data_list?: { rotation?: number }[]; tags?: { rotate?: string } }[]; format?: { duration?: string } };
    const v = j.streams?.find((s) => s.codec_type === 'video');
    const rot = Math.abs(Number(v?.side_data_list?.find((d) => d.rotation !== undefined)?.rotation ?? v?.tags?.rotate ?? 0)) % 180 === 90;
    const dur = Number(j.format?.duration ?? v?.duration ?? NaN);
    return { ok: !!v || !!j.streams?.some((s) => s.codec_type === 'audio'), width: rot ? v?.height : v?.width, height: rot ? v?.width : v?.height, durationMs: Number.isFinite(dur) ? Math.round(dur * 1000) : undefined, hasVideo: !!v, hasAudio: !!j.streams?.some((s) => s.codec_type === 'audio') };
  } catch {
    return { ok: false, hasVideo: false, hasAudio: false };
  }
}

function grayThumb(file: string, isVideo: boolean, durationMs?: number): GrayImage | null {
  const seek = isVideo ? ['-ss', String(Math.min(1, (durationMs ?? 2000) / 2000))] : [];
  const r = spawnSync(FFMPEG, ['-v', 'error', ...seek, '-i', file, '-frames:v', '1', '-vf', 'scale=160:-2,format=gray', '-f', 'rawvideo', '-'], { maxBuffer: 16 * 1024 * 1024 });
  if (r.status !== 0 || !r.stdout || r.stdout.length < 160 * 3) return null;
  const w = 160;
  const h = Math.floor(r.stdout.length / w);
  return { w, h, data: new Uint8Array(r.stdout.buffer, r.stdout.byteOffset, w * h) };
}

function decodeAnyAudio(file: string): { samples: Float32Array; sampleRate: number } {
  try {
    const d = decodeWav(readFileSync(file));
    return { samples: d.samples, sampleRate: d.sampleRate };
  } catch {
    /* not a plain WAV: let FFmpeg decode it */
  }
  const r = spawnSync(FFMPEG, ['-v', 'error', '-i', file, '-f', 'f32le', '-ac', '1', '-ar', '22050', '-'], { maxBuffer: 1024 * 1024 * 1024 });
  if (r.status !== 0 || !r.stdout?.length) throw new PlanError('no_audio', 'The soundtrack could not be decoded');
  const buf = r.stdout;
  const samples = new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length - (buf.length % 4)));
  return { samples, sampleRate: 22050 };
}

// ---------------------------------------------------------------------------
// job handlers
// ---------------------------------------------------------------------------
class Canceled extends Error {}

async function progress(jobId: string, body: { status?: string; progress?: number; log?: string }) {
  const r = await call<{ cancel: boolean }>('POST', `/api/worker/jobs/${jobId}/progress`, body);
  if (r.cancel) throw new Canceled();
}

async function fetchAudio(c: ClaimedJob, dir: string): Promise<string> {
  const dest = path.join(dir, 'soundtrack.bin');
  if (c.audio.kind === 'demo') await download(c.audio.path, dest, false);
  else await download(`/api/worker/media/${c.audio.mediaId}`, dest);
  return dest;
}

async function handlePlan(c: ClaimedJob, dir: string): Promise<PlanResult> {
  const id = c.job.id;
  await progress(id, { status: 'analyzing', progress: 3, log: 'Downloading soundtrack' });
  const audioPath = await fetchAudio(c, dir);
  const audio = decodeAnyAudio(audioPath);
  await progress(id, { progress: 12, log: 'Analysing music (tempo, beats, sections)' });
  const analysis = analyzeAudio(audio.samples, audio.sampleRate);
  log(`analysis: ${analysis.bpm} BPM (confidence ${analysis.tempoConfidence}), ${analysis.barStartsMs.length} bars`);

  const assessments: AssetAssessment[] = [];
  const candidates: (PlanAsset & { hash: string })[] = [];
  let i = 0;
  for (const a of c.assets) {
    i++;
    await progress(id, { progress: 15 + (60 * i) / Math.max(1, c.assets.length), log: i === 1 || i % 10 === 0 ? `Checking media ${i}/${c.assets.length}` : undefined });
    const file = path.join(dir, `asset-${a.id}`);
    try {
      await download(`/api/worker/media/${a.id}`, file);
    } catch (e) {
      assessments.push({ id: a.id, usable: false, reason: `download failed: ${(e as Error).message}`, quality: 0 });
      continue;
    }
    const p = probe(file);
    if (!p.ok || (a.mediaType === 'video' && !p.hasVideo)) {
      assessments.push({ id: a.id, usable: false, reason: 'corrupt or unreadable file', quality: 0 });
      continue;
    }
    const thumb = grayThumb(file, a.mediaType === 'video', p.durationMs);
    if (!thumb) {
      assessments.push({ id: a.id, usable: false, reason: 'could not decode a frame (unsupported format?)', quality: 0 });
      continue;
    }
    const q = assessQuality(thumb);
    let reason: string | undefined;
    if (!a.pinned) {
      if (q.tooDark) reason = 'too dark';
      else if (q.tooBright) reason = 'overexposed';
      else if (q.blurry) reason = 'too blurry';
    }
    assessments.push({ id: a.id, usable: !reason, reason, quality: q.score, sharpness: q.sharpness, durationMs: a.mediaType === 'video' ? p.durationMs : undefined, width: p.width, height: p.height });
    if (!reason) candidates.push({ id: a.id, mediaType: a.mediaType, durationMs: a.mediaType === 'video' ? p.durationMs : undefined, takenAtMs: Date.parse(a.takenAt), uploaderId: a.uploaderId, uploaderName: a.uploaderName, quality: q.score, pinned: a.pinned, hash: q.hash });
  }

  await progress(id, { status: 'planning', progress: 80, log: 'Removing near-duplicates and planning the edit' });
  const dd = dedupe(candidates.map((x) => ({ id: x.id, hash: x.hash, score: x.quality, pinned: x.pinned })));
  for (const d of dd.dropped) {
    const a = assessments.find((x) => x.id === d.id);
    if (a) Object.assign(a, { usable: false, reason: 'near-duplicate', duplicateOf: d.duplicateOf });
  }
  const keep = new Set(dd.kept);
  const assets = candidates.filter((x) => keep.has(x.id));
  const timeline = planRecap({
    assets,
    analysis,
    audio: { source: c.project.soundtrack, title: c.audio.title, license: c.audio.license },
    preset: c.project.preset,
    aspect: c.project.aspect,
    targetMs: c.project.targetMs,
    title: c.project.title,
    seed: (parseInt(c.job.id.slice(0, 8), 16) >>> 0) % 2 ** 31,
  });
  const dropped = assessments.filter((x) => !x.usable);
  if (dropped.length) timeline.notes.push(`${dropped.length} item(s) were skipped automatically (${[...new Set(dropped.map((d) => d.reason))].join(', ')}). You can pin an item to force it in.`);
  return {
    timeline,
    assessments,
    analysis: { bpm: analysis.bpm, tempoConfidence: analysis.tempoConfidence, durationMs: analysis.durationMs, highlights: analysis.highlights, sections: analysis.sections.map((s) => ({ startMs: s.startMs, endMs: s.endMs, label: s.label })), analysisVersion: analysis.analysisVersion },
  };
}

async function handleRender(c: ClaimedJob, dir: string, type: 'preview' | 'final') {
  const id = c.job.id;
  const tl = c.timeline!;
  await progress(id, { progress: 2, log: 'Downloading media' });
  const files: Record<string, { path: string; mediaType: 'image' | 'video' }> = {};
  let n = 0;
  for (const a of c.assets) {
    const dest = path.join(dir, `asset-${a.id}`);
    await download(`/api/worker/media/${a.id}`, dest);
    files[a.id] = { path: dest, mediaType: a.mediaType };
    await progress(id, { progress: 2 + (13 * ++n) / c.assets.length });
  }
  const audioPath = await fetchAudio(c, dir);
  const out = path.join(dir, `recap-${type}.mp4`);
  const plan = buildRenderPlan(tl, { files, audioPath }, { quality: type, outPath: out, fontFile: FONT });
  for (const s of plan.skipped) await progress(id, { log: s });
  await progress(id, { status: type === 'preview' ? 'preview' : 'rendering', progress: 15, log: `Rendering ${plan.width}x${plan.height} with FFmpeg` });

  await new Promise<void>((resolve, reject) => {
    const proc = spawn(FFMPEG, plan.args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    let lastSent = 0;
    let canceled = false;
    proc.stderr.on('data', (d) => (stderr = (stderr + d).slice(-4000)));
    proc.stdout.on('data', async (d: Buffer) => {
      const ms = parseProgressMs(d.toString());
      if (ms === null || Date.now() - lastSent < 1200) return;
      lastSent = Date.now();
      try {
        await progress(id, { progress: 15 + (80 * Math.min(ms, tl.durationMs)) / tl.durationMs });
      } catch (e) {
        if (e instanceof Canceled && !canceled) {
          canceled = true;
          proc.kill('SIGKILL');
        }
      }
    });
    proc.on('error', reject);
    proc.on('close', (code) => (canceled ? reject(new Canceled()) : code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${stderr.split('\n').slice(-6).join(' | ')}`))));
  });

  const size = statSync(out).size;
  if (size < 1024) throw new Error('FFmpeg produced an empty file');
  await progress(id, { progress: 96, log: `Uploading ${(size / 1048576).toFixed(1)} MB` });
  const res = await fetch(`${BASE}/api/worker/jobs/${id}/output`, { method: 'PUT', headers: { ...headers(), 'Content-Type': 'video/mp4', 'Content-Length': String(size) }, body: Readable.toWeb(createReadStream(out)) as never, duplex: 'half' } as RequestInit);
  if (!res.ok) throw new Error(`upload failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
  await call('POST', `/api/worker/jobs/${id}/complete`, {});
}

// ---------------------------------------------------------------------------
// main loop
// ---------------------------------------------------------------------------
async function runJob(c: ClaimedJob) {
  const dir = path.join(WORK_ROOT, c.job.id);
  mkdirSync(dir, { recursive: true });
  log(`job ${c.job.id.slice(0, 8)} (${c.job.type}, attempt ${c.job.attempt})`);
  try {
    if (c.job.type === 'plan') {
      const result = await handlePlan(c, dir);
      await call('POST', `/api/worker/jobs/${c.job.id}/complete`, result);
    } else {
      await handleRender(c, dir, c.job.type);
    }
    log(`job ${c.job.id.slice(0, 8)} complete`);
  } catch (e) {
    if (e instanceof Canceled) {
      log(`job ${c.job.id.slice(0, 8)} canceled`);
      await call('POST', `/api/worker/jobs/${c.job.id}/fail`, { error: 'Canceled', retryable: false }).catch(() => undefined);
    } else {
      const retryable = !(e instanceof PlanError);
      log(`job ${c.job.id.slice(0, 8)} failed (${retryable ? 'will retry' : 'final'}):`, (e as Error).message);
      await call('POST', `/api/worker/jobs/${c.job.id}/fail`, { error: (e as Error).message, retryable }).catch(() => undefined);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function main() {
  log(`media worker ${WORKER_ID} -> ${BASE}`);
  log(`ffmpeg: ${FFMPEG}${existsSync(FFMPEG) || FFMPEG === 'ffmpeg' ? '' : ' (NOT FOUND)'}  font: ${FONT ?? 'none (captions off)'}`);
  mkdirSync(WORK_ROOT, { recursive: true });
  // clean stale scratch dirs from a previous crash
  for (const d of readdirSync(WORK_ROOT)) rmSync(path.join(WORK_ROOT, d), { recursive: true, force: true });
  let warned = false;
  for (;;) {
    try {
      const { job } = await call<{ job: ClaimedJob | null }>('POST', '/api/worker/claim', { workerId: WORKER_ID });
      warned = false;
      if (job) await runJob(job);
      else await new Promise((r) => setTimeout(r, 2000));
    } catch (e) {
      if (!warned) log('cannot reach the web app (will keep trying):', (e as Error).message);
      warned = true;
      await new Promise((r) => setTimeout(r, 4000));
    }
  }
}

if (process.argv.includes('--once-selftest')) {
  console.log(JSON.stringify({ ffmpeg: FFMPEG, ffprobe: FFPROBE, font: FONT ?? null }));
} else {
  void main();
}
