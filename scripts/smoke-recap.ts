// End-to-end recap smoke test (needs: web app running + `pnpm worker` running).
//   npx tsx scripts/smoke-recap.ts [baseUrl]
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { patternPng } from '../tests/helpers/png';

const require = createRequire(import.meta.url);
const BASE = process.argv[2] ?? 'http://127.0.0.1:3000';

class Client {
  jar = new Map<string, string>();
  async req(method: string, p: string, body?: unknown, raw?: Buffer) {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (raw) headers['content-type'] = 'image/png';
    const cookie = [...this.jar].map(([k, v]) => `${k}=${v}`).join('; ');
    if (cookie) headers.cookie = cookie;
    const res = await fetch(BASE + p, { method, headers, body: raw ? new Uint8Array(raw) : body !== undefined ? JSON.stringify(body) : undefined });
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [pair] = c.split(';');
      const i = pair!.indexOf('=');
      this.jar.set(pair!.slice(0, i), pair!.slice(i + 1));
    }
    const text = await res.text();
    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
    return { status: res.status, json };
  }
}

let failures = 0;
const check = (label: string, ok: boolean, detail = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${label}${ok ? '' : ' ' + detail}`);
  if (!ok) failures++;
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const host = new Client();
const guestA = new Client();
const guestB = new Client();
const dir = mkdtempSync(path.join(tmpdir(), 'recap-smoke-'));

async function uploadPhoto(c: Client, eventId: string, seed: number, consent: boolean) {
  const png = patternPng(seed % 2 ? 640 : 480, seed % 2 ? 480 : 640, seed);
  const i = await c.req('POST', `/api/events/${eventId}/media/upload-intent`, { fileName: `p${seed}.png`, mime: 'image/png', size: png.length, recapConsent: consent });
  if (i.status !== 201) throw new Error('intent ' + JSON.stringify(i.json));
  const put = await new Client().req('PUT', i.json.uploadUrl, undefined, png);
  if (put.status !== 200) throw new Error('put ' + JSON.stringify(put.json));
  const done = await c.req('POST', `/api/events/${eventId}/media/complete`, { mediaId: i.json.mediaId });
  return { id: i.json.mediaId as string, status: done.json.status as string };
}

console.log('setup: party with photos from the host and two guests');
await host.req('POST', '/api/auth/local', { handle: 'rc_' + Math.random().toString(36).slice(2, 8), displayName: 'Recap Host' });
const created = await host.req('POST', '/api/events', { title: 'Recap Smoke', settings: { guestUploads: 'approval' } });
const eventId = created.json.event.id as string;
const token = created.json.inviteToken as string;
await host.req('PATCH', `/api/events/${eventId}`, { status: 'live' });
await guestA.req('POST', `/api/events/${eventId}/join`, { token, displayName: 'Ana' });
await guestB.req('POST', `/api/events/${eventId}/join`, { token, displayName: 'Ben' });

const hostIds: string[] = [];
for (let s = 1; s <= 4; s++) hostIds.push((await uploadPhoto(host, eventId, s, true)).id);
const ana = await Promise.all([5, 6, 7, 8].map((s) => uploadPhoto(guestA, eventId, s, true)));
const ben = await Promise.all([9, 10].map((s) => uploadPhoto(guestB, eventId, s, false))); // NO recap consent
for (const m of [...ana, ...ben]) await host.req('PATCH', `/api/events/${eventId}/media/${m.id}`, { status: 'approved' });
check('guest uploads wait for approval', ana.every((m) => m.status === 'pending'));

console.log('creating the recap');
let r = await guestA.req('POST', `/api/events/${eventId}/recaps`, { soundtrack: { kind: 'demo', id: 'neon-static' } });
check('guests cannot create recaps (404/403)', r.status === 404 || r.status === 403, String(r.status));
r = await host.req('POST', `/api/events/${eventId}/recaps`, { soundtrack: { kind: 'spotify', id: 'x' } });
check('Spotify soundtracks are refused (422)', r.status === 422 && r.json.code === 'spotify_not_eligible', JSON.stringify(r.json));
r = await host.req('POST', `/api/events/${eventId}/recaps`, { preset: 'quick', aspect: '9:16', targetMs: 30000, soundtrack: { kind: 'demo', id: 'neon-static' } });
check('recap accepted (202)', r.status === 202, JSON.stringify(r.json));
const { projectId, jobId } = r.json;
check('worker is online', r.json.workerOnline === true, '(start `pnpm worker`)');

const waitJob = async (id: string, label: string, ms = 180000) => {
  const t0 = Date.now();
  let last = '';
  for (;;) {
    const j = await host.req('GET', `/api/jobs/${id}`);
    const s = `${j.json.status} ${j.json.progress}%`;
    if (s !== last) console.log(`    ${label}: ${s}`);
    last = s;
    if (['complete', 'failed', 'canceled'].includes(j.json.status)) return j.json;
    if (Date.now() - t0 > ms) throw new Error(`${label} timed out`);
    await sleep(1000);
  }
};
const plan = await waitJob(jobId, 'plan');
check('plan job completes', plan.status === 'complete', JSON.stringify(plan));

let d = await host.req('GET', `/api/recaps/${projectId}`);
const tl = d.json.timeline;
check('timeline exists with clips', !!tl && tl.clips.length > 3, JSON.stringify(d.json).slice(0, 300));
const used = new Set<string>(tl.clips.map((c: any) => c.assetId));
check('guest media WITHOUT recap consent is never used', ben.every((m) => !used.has(m.id)));
check('consented guest + host media are used', ana.some((m) => used.has(m.id)) && hostIds.some((id) => used.has(id)));
check('cuts sit on the beat grid', tl.clips.every((c: any) => tl.audio.beatTimesMs.includes(c.timelineStartMs)));
check('analysis reports the tempo of the real song', Math.abs(d.json.analysis.bpm - 112) < 1.5, String(d.json.analysis?.bpm));
console.log(`    ${tl.clips.length} clips, ${(tl.durationMs / 1000).toFixed(1)}s, ${d.json.analysis.bpm} BPM`);

console.log('editing');
const edited = structuredClone(tl);
edited.clips[0].pinned = true;
let s = await host.req('PATCH', `/api/recaps/${projectId}/timeline`, { timeline: edited, baseVersion: d.json.project.version });
check('timeline saved as version 2', s.status === 200 && s.json.version === 2, JSON.stringify(s.json));
s = await host.req('PATCH', `/api/recaps/${projectId}/timeline`, { timeline: edited, baseVersion: 1 });
check('stale edit rejected (409)', s.status === 409);
const bad = structuredClone(edited);
bad.clips[0].assetId = ben[0]!.id; // a non-consented photo
s = await host.req('PATCH', `/api/recaps/${projectId}/timeline`, { timeline: bad, baseVersion: 2 });
check('timeline cannot reference non-consented media (422)', s.status === 422, JSON.stringify(s.json));
s = await host.req('POST', `/api/recaps/${projectId}/regenerate`, { fromMs: 0, toMs: tl.clips[3].timelineStartMs });
check('regenerate a section', s.status === 200 && s.json.version === 3, JSON.stringify(s.json));
s = await host.req('POST', `/api/recaps/${projectId}/timeline`, { version: 1 });
check('restore the original (undo)', s.status === 200 && s.json.version === 4, JSON.stringify(s.json));

console.log('rendering a preview');
r = await host.req('POST', `/api/recaps/${projectId}/render`, { type: 'preview' });
check('render queued (202)', r.status === 202);
const again = await host.req('POST', `/api/recaps/${projectId}/render`, { type: 'preview' });
check('same request is idempotent (same job)', again.json.jobId === r.json.jobId);
const done = await waitJob(r.json.jobId, 'preview');
check('preview renders', done.status === 'complete' && !!done.videoUrl, JSON.stringify(done));
if (done.videoUrl) {
  const vr = await fetch(BASE + done.videoUrl);
  const buf = Buffer.from(await vr.arrayBuffer());
  const f = path.join(dir, 'out.mp4');
  writeFileSync(f, buf);
  const probe = JSON.parse(spawnSync(require('ffprobe-static').path, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', f], { encoding: 'utf8' }).stdout);
  const v = probe.streams.find((x: any) => x.codec_type === 'video');
  const a = probe.streams.find((x: any) => x.codec_type === 'audio');
  const timelineNow = (await host.req('GET', `/api/recaps/${projectId}`)).json.timeline;
  check('downloaded MP4 has H.264 video + AAC audio', v?.codec_name === 'h264' && a?.codec_name === 'aac');
  check('9:16 portrait output', v.height > v.width, `${v.width}x${v.height}`);
  check('length matches the timeline', Math.abs(Number(probe.format.duration) - timelineNow.durationMs / 1000) < 0.4, `${probe.format.duration} vs ${timelineNow.durationMs / 1000}`);
  console.log(`    ${(buf.length / 1024).toFixed(0)} KB  ${v.width}x${v.height}  ${Number(probe.format.duration).toFixed(1)}s  saved: ${f}`);
  const bad = await fetch(BASE + done.videoUrl.replace(/t=[^&]+/, 't=forged'));
  check('forged video link rejected (403)', bad.status === 403);
  const guestTry = await guestA.req('GET', `/api/recaps/${projectId}`);
  check('guests cannot read the recap project', guestTry.status === 404 || guestTry.status === 403);
}

console.log('cancel');
await host.req('PATCH', `/api/events/${eventId}/media/${ben[0]!.id}`, { status: 'approved' });
const fin = await host.req('POST', `/api/recaps/${projectId}/render`, { type: 'final' });
const canc = await host.req('POST', `/api/jobs/${fin.json.jobId}`);
check('final render can be canceled', ['canceled', 'queued', 'rendering', 'analyzing'].includes(canc.json.status));
await sleep(2500);
const afterCancel = await host.req('GET', `/api/jobs/${fin.json.jobId}`);
check('job ends as canceled (not left running)', afterCancel.json.status === 'canceled', afterCancel.json.status);

await host.req('DELETE', `/api/events/${eventId}`);
console.log(failures ? `\n${failures} check(s) FAILED` : '\nall recap smoke checks passed');
process.exit(failures ? 1 : 0);
