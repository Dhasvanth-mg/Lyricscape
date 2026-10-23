import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { patternPng } from './helpers/png';

const dir = mkdtempSync(path.join(tmpdir(), 'lyricscape-recapjobs-'));
process.env.LYRICSCAPE_DATA_DIR = dir;
process.env.LYRICSCAPE_SECRET = 'test-secret-test-secret-test-secret';

const { Database, swapDatabase, db } = await import('@/lib/server/db');
const party = await import('@/lib/server/party');
const recap = await import('@/lib/server/recap');
const sec = await import('@/lib/server/security');
const storage = await import('@/lib/server/storage');

let n = 0;
beforeEach(() => {
  const d = path.join(dir, `db${++n}`);
  mkdirSync(d, { recursive: true });
  swapDatabase(new Database(d));
  sec.resetRateLimits();
});
afterAll(() => {
  db().dispose();
  rmSync(dir, { recursive: true, force: true });
});

const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return e instanceof sec.HttpError ? `${e.status}:${e.code}` : `ERR:${(e as Error).message}`;
  }
  return 'ok';
};

function setup(opts: { guestConsent?: boolean } = {}) {
  const host = party.loginLocalUser('recaphost', 'Host');
  const e = party.createEvent(host, { title: 'Recap Party', settings: { guestUploads: 'open' } });
  const hostCtx = { userId: host.id };
  const { token } = party.createInvite(e.id, hostCtx);
  const g = party.joinByToken({ ip: '1.1.1.1' }, { token, displayName: 'Guest' });
  const gCtx = { guestToken: g.guestToken };
  const upload = (ctx: typeof hostCtx | typeof gCtx, consent: boolean, seed: number) => {
    const png = patternPng(64, 64, seed);
    const { media } = party.createUploadIntent(e.id, ctx, { fileName: `p${seed}.png`, mime: 'image/png', size: png.length, recapConsent: consent });
    const p = storage.objectPath(media.objectKey);
    mkdirSync(path.dirname(p), { recursive: true });
    writeFileSync(p, png);
    return party.completeUpload(e.id, ctx, media.id);
  };
  const hostPhoto = upload(hostCtx, false, 1); // host uploads count as consented
  const consented = upload(gCtx, true, 2);
  const refused = upload(gCtx, opts.guestConsent ?? false, 3);
  return { host, e, hostCtx, gCtx, hostPhoto, consented, refused };
}
const demo = { kind: 'demo' as const, id: 'neon-static' };

describe('eligibility: rights and consent are enforced by the server', () => {
  it('only approved + consented media (or the host\'s own) can be used', () => {
    const { e, hostPhoto, consented, refused } = setup();
    const { rows, excluded } = recap.eligibleMedia(e.id);
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(hostPhoto.id);
    expect(ids).toContain(consented.id);
    expect(ids).not.toContain(refused.id);
    expect(excluded.find((x) => x.id === refused.id)?.reason).toMatch(/allow recap/);
  });

  it('removed uploaders and hidden media drop out', () => {
    const { e, hostCtx, gCtx, consented } = setup();
    party.moderateMedia(e.id, hostCtx, consented.id, { status: 'rejected' });
    expect(recap.eligibleMedia(e.id).rows.map((r) => r.id)).not.toContain(consented.id);
    void gCtx;
  });

  it('refuses Spotify soundtracks, guests, unknown demo songs, un-attested uploads, and empty parties', () => {
    const { e, hostCtx, gCtx } = setup();
    expect(code(() => recap.createRecap(e.id, hostCtx, { soundtrack: { kind: 'spotify', id: 'abc' } }))).toBe('422:spotify_not_eligible');
    expect(code(() => recap.createRecap(e.id, gCtx, { soundtrack: demo }))).toBe('403:forbidden');
    expect(code(() => recap.createRecap(e.id, hostCtx, { soundtrack: { kind: 'demo', id: 'nope-nope' } }))).toBe('404:not_found');
    expect(code(() => recap.createRecap(e.id, hostCtx, { soundtrack: { kind: 'upload', mediaId: '00000000-0000-4000-8000-000000000000', rightsAttested: false } }))).toMatch(/^ERR/);
    const lonely = party.createEvent(party.loginLocalUser('lonely1', 'L'), { title: 'Empty one' });
    expect(code(() => recap.createRecap(lonely.id, { userId: lonely.hostId }, { soundtrack: demo }))).toBe('422:no_media');
  });

  it('soundtrack uploads: host only, rights attestation required, never visible in galleries', () => {
    const { e, hostCtx, gCtx } = setup();
    const wav = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WAVE'), Buffer.alloc(40)]);
    const intent = { fileName: 'song.wav', mime: 'audio/wav' as const, size: wav.length };
    expect(code(() => party.createUploadIntent(e.id, gCtx, { ...intent, rightsAttested: true }))).toBe('403:forbidden');
    expect(code(() => party.createUploadIntent(e.id, hostCtx, intent))).toBe('422:rights_required');
    const { media } = party.createUploadIntent(e.id, hostCtx, { ...intent, rightsAttested: true });
    const p = storage.objectPath(media.objectKey);
    mkdirSync(path.dirname(p), { recursive: true });
    writeFileSync(p, wav);
    expect(party.completeUpload(e.id, hostCtx, media.id).status).toBe('approved');
    expect(party.snapshotFor(e.id, gCtx).media.some((m) => m.id === media.id)).toBe(false);
    expect(party.snapshotFor(e.id, hostCtx).media.some((m) => m.id === media.id)).toBe(false);
    expect(recap.listSoundtracks(e.id, hostCtx).uploads.map((u) => u.id)).toContain(media.id);
    expect(recap.listSoundtracks(e.id, hostCtx).spotify.eligible).toBe(false);
    // an upload soundtrack can be used once attested
    expect(code(() => recap.createRecap(e.id, hostCtx, { soundtrack: { kind: 'upload', mediaId: media.id, rightsAttested: true } }))).toBe('ok');
  });
});

describe('job queue: claiming, progress, idempotency', () => {
  it('queues a plan job and a worker claims it exactly once (oldest first)', () => {
    const { e, hostCtx } = setup();
    const { job } = recap.createRecap(e.id, hostCtx, { soundtrack: demo });
    expect(job.status).toBe('queued');
    const claimed = recap.claimJob('w1')!;
    expect(claimed.job.id).toBe(job.id);
    expect(claimed.job.attempt).toBe(1);
    expect(claimed.assets.map((a) => a.id)).toHaveLength(2); // the consented guest photo + the host's
    expect(claimed.audio).toMatchObject({ kind: 'demo', path: '/demo/neon-static.wav' });
    expect(recap.claimJob('w2')).toBeNull(); // nothing else to claim
    expect(recap.R.jobs().get(job.id)!.status).toBe('analyzing');
  });

  it('authenticates the worker with the shared secret only', () => {
    expect(() => recap.requireWorker(null)).toThrow();
    expect(() => recap.requireWorker('Bearer nope')).toThrow();
    expect(() => recap.requireWorker(`Bearer ${recap.workerSecret()}`)).not.toThrow();
    expect(() => recap.requireWorker(`Bearer ${recap.workerSecret()}x`)).toThrow();
  });

  it('render requests are idempotent per timeline version and type', async () => {
    const { e, hostCtx } = setup();
    const { project, job } = recap.createRecap(e.id, hostCtx, { soundtrack: demo });
    recap.claimJob('w');
    const { analyzeAudio } = await import('@/lib/recap/analyze');
    const { decodeWav } = await import('@/lib/recap/wav');
    const { planRecap } = await import('@/lib/recap/plan');
    const { readFileSync } = await import('node:fs');
    const wav = decodeWav(readFileSync(path.join(process.cwd(), 'public/demo/neon-static.wav')));
    const analysis = analyzeAudio(wav.samples, wav.sampleRate);
    const assets = recap.eligibleMedia(e.id).rows.map((m) => ({ id: m.id, mediaType: 'image' as const, takenAtMs: 1, uploaderId: m.uploaderId, uploaderName: 'x', quality: 0.7, pinned: false }));
    const timeline = planRecap({ assets, analysis, audio: { source: demo, license: 'CC0' }, preset: 'quick', aspect: '9:16', targetMs: 30_000 });
    recap.completePlan(job.id, { timeline, assessments: assets.map((a) => ({ id: a.id, usable: true, quality: 0.7 })), analysis: { bpm: analysis.bpm, tempoConfidence: analysis.tempoConfidence, durationMs: analysis.durationMs, highlights: [], sections: [], analysisVersion: analysis.analysisVersion } });
    expect(recap.R.projects().get(project.id)!.status).toBe('ready');
    const a = recap.startRender(project.id, hostCtx, 'preview');
    const b = recap.startRender(project.id, hostCtx, 'preview');
    expect(b.id).toBe(a.id);
    const f = recap.startRender(project.id, hostCtx, 'final');
    expect(f.id).not.toBe(a.id);
    expect(recap.R.jobs().where((j) => j.projectId === project.id && j.type === 'preview')).toHaveLength(1);
    // editing makes a new version, so the next render is a new job
    const cur = recap.getProject(project.id, hostCtx).timeline!;
    const saved = recap.saveTimeline(project.id, hostCtx, { timeline: { ...cur, notes: ['edited'] }, baseVersion: 1 });
    expect(saved.version).toBe(2);
    expect(recap.startRender(project.id, hostCtx, 'preview').id).not.toBe(a.id);
    // render-time re-check: media hidden after planning blocks the render instead of leaking into the video
    const used = cur.clips[0]!.assetId;
    party.moderateMedia(e.id, hostCtx, used, { status: 'rejected' });
    recap.R.jobs().where((j) => j.type !== 'plan').forEach((j) => recap.R.jobs().update(j.id, { status: j.id === a.id ? 'queued' : 'canceled' }));
    expect(recap.claimJob('w3')).toBeNull();
    expect(recap.R.jobs().get(a.id)!.status).toBe('failed');
    expect(recap.R.jobs().get(a.id)!.error).toMatch(/no longer approved/);
  });
});

describe('job retries', () => {
  const queuedJob = () => {
    const s = setup();
    const { job } = recap.createRecap(s.e.id, s.hostCtx, { soundtrack: demo });
    return { ...s, job };
  };

  it('retries retryable failures with exponential backoff, then fails for good', () => {
    const { job } = queuedJob();
    let t = 1_000_000;
    recap.claimJob('w', t);
    let j = recap.failJob(job.id, 'ffmpeg crashed', true, t);
    expect(j.status).toBe('queued');
    expect(j.notBefore).toBe(t + 4000); // 2s * 2^attempts(1)
    expect(recap.claimJob('w', t + 100)).toBeNull(); // still backing off
    t += 5000;
    expect(recap.claimJob('w', t)?.job.attempt).toBe(2);
    j = recap.failJob(job.id, 'again', true, t);
    expect(j.status).toBe('queued');
    expect(j.notBefore).toBe(t + 8000);
    t += 9000;
    expect(recap.claimJob('w', t)?.job.attempt).toBe(3);
    j = recap.failJob(job.id, 'third strike', true, t);
    expect(j.status).toBe('failed');
    expect(j.error).toBe('third strike');
    expect(j.logs.length).toBeGreaterThan(0);
  });

  it('non-retryable failures fail immediately and mark a plan project as failed', () => {
    const { job } = queuedJob();
    recap.claimJob('w');
    const j = recap.failJob(job.id, 'no beat found', false);
    expect(j.status).toBe('failed');
    expect(recap.R.projects().get(job.projectId)!.status).toBe('failed');
  });

  it('re-queues jobs whose worker went silent (lease expiry) and keeps heartbeats alive', () => {
    const { job } = queuedJob();
    const t = 5_000_000;
    recap.claimJob('crashy', t);
    recap.jobProgress(job.id, { progress: 10 }, t + 60_000); // heartbeat
    recap.reapStaleJobs(t + 120_000 + 1000); // < 2 min since last heartbeat: still leased
    expect(recap.R.jobs().get(job.id)!.status).toBe('analyzing');
    recap.reapStaleJobs(t + 60_000 + 2 * 60_000 + 1000);
    const re = recap.R.jobs().get(job.id)!;
    expect(re.status).toBe('queued');
    expect(re.error).toMatch(/stopped responding/);
  });

  it('cancel: queued jobs cancel immediately; running jobs are told to stop on the next progress call', () => {
    const { job, hostCtx } = queuedJob();
    expect(recap.cancelJob(job.id, hostCtx).status).toBe('canceled');
    const second = queuedJob();
    recap.claimJob('w');
    recap.cancelJob(second.job.id, second.hostCtx);
    expect(recap.jobProgress(second.job.id, { progress: 20 }).cancel).toBe(true);
    expect(recap.failJob(second.job.id, 'Canceled', false).status).toBe('canceled');
  });

  it('progress only moves forward in status and is capped below 100 until completion', () => {
    const { job } = queuedJob();
    recap.claimJob('w');
    recap.jobProgress(job.id, { progress: 250, status: 'planning', log: 'x'.repeat(1000) });
    const j = recap.R.jobs().get(job.id)!;
    expect(j.progress).toBe(99);
    expect(j.status).toBe('planning');
    expect(j.logs[0]!.length).toBeLessThanOrEqual(300);
  });

  it('video links are signed, short-lived and job-bound; deleting the party removes everything', () => {
    const { job, e, hostCtx } = queuedJob();
    expect(code(() => recap.authorizeVideo(job.id, null))).toBe('403:bad_signature');
    const forged = sec.signToken({ t: 'recap', jid: job.id }, 60_000);
    expect(code(() => recap.authorizeVideo(job.id, forged))).toBe('403:bad_signature'); // no output yet
    party.deleteEvent(e.id, hostCtx);
    expect(recap.R.jobs().all()).toHaveLength(0);
    expect(recap.R.projects().all()).toHaveLength(0);
  });
});
