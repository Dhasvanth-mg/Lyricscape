import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { db } from './db';
import { HttpError, cleanText, rateLimit, sha256, signToken, verifyToken } from './security';
import { T, requireMod, type Ctx, type MediaRow } from './party';
import { publish } from './bus';
import { secret } from './config';
import { deleteObject, objectKey, objectSize } from './storage';
import { ACTIVE_STATUSES, createRecapSchema, type AssetAssessment, type ClaimedJob, type JobStatus, type JobType, type PlanResult, type SoundtrackRef } from '../recap/jobs';
import { recapTimelineSchema, validateTimeline, normalizeTimeline, type RecapTimeline } from '../recap/timeline';
import { regenerateRange, type PlanAsset } from '../recap/plan';

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------
export type RecapProjectRow = {
  id: string;
  eventId: string;
  hostMemberId: string;
  title: string;
  preset: RecapTimeline['preset'];
  aspect: RecapTimeline['aspect'];
  targetMs?: number;
  soundtrack: SoundtrackRef;
  status: 'planning' | 'ready' | 'failed';
  version: number;
  assessments: AssetAssessment[];
  analysis?: PlanResult['analysis'];
  error?: string;
  createdAt: string;
  updatedAt: string;
};
export type TimelineRow = { id: string; projectId: string; version: number; timeline: RecapTimeline; createdBy: string; createdAt: string };
export type JobRow = {
  id: string;
  projectId: string;
  eventId: string;
  type: JobType;
  status: JobStatus;
  progress: number;
  attempts: number;
  maxAttempts: number;
  notBefore: number;
  idempotencyKey: string;
  timelineVersion: number;
  error?: string;
  logs: string[];
  outputKey?: string;
  workerId?: string;
  heartbeatAt?: number;
  cancelRequested?: boolean;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
};

export const R = {
  projects: () => db().table<RecapProjectRow>('recap_projects'),
  timelines: () => db().table<TimelineRow>('recap_timelines'),
  jobs: () => db().table<JobRow>('render_jobs'),
};

const now = () => new Date().toISOString();
const LEASE_MS = 2 * 60_000;
const MAX_ATTEMPTS = 3;

export const DEMO_SOUNDTRACKS: Record<string, { title: string; license: string; file: string }> = {
  'neon-static': { title: 'Neon Static', license: 'CC0-1.0 (synthesized by Lyricscape)', file: 'neon-static.wav' },
  'paper-planets': { title: 'Paper Planets', license: 'CC0-1.0 (synthesized by Lyricscape)', file: 'paper-planets.wav' },
  'glass-hours': { title: 'Glass Hours', license: 'CC0-1.0 (synthesized by Lyricscape)', file: 'glass-hours.wav' },
};

// ---------------------------------------------------------------------------
// Worker authentication (shared secret; the worker runs as a separate process)
// ---------------------------------------------------------------------------
export function workerSecret(): string {
  return process.env.MEDIA_WORKER_SECRET || createHash('sha256').update(`worker:${secret()}`).digest('hex');
}
export function requireWorker(authHeader: string | null) {
  const expected = `Bearer ${workerSecret()}`;
  if (!authHeader || authHeader.length !== expected.length || sha256(authHeader) !== sha256(expected)) throw new HttpError(401, 'unauthorized_worker', 'Invalid worker credentials');
}
const g = globalThis as unknown as { __lyricscapeWorkerSeen?: number };
export const markWorkerSeen = () => void (g.__lyricscapeWorkerSeen = Date.now());
export const workerOnline = () => !!g.__lyricscapeWorkerSeen && Date.now() - g.__lyricscapeWorkerSeen < 15_000;

// ---------------------------------------------------------------------------
// Eligibility: rights + consent are engineering requirements, not UI hints
// ---------------------------------------------------------------------------
export function eligibleMedia(eventId: string): { rows: MediaRow[]; excluded: { id: string; reason: string }[] } {
  const members = new Map(T.members().where((m) => m.eventId === eventId).map((m) => [m.id, m]));
  const rows: MediaRow[] = [];
  const excluded: { id: string; reason: string }[] = [];
  for (const m of T.media().where((m) => m.eventId === eventId && m.mediaType !== 'audio' && m.status !== 'uploading')) {
    const up = members.get(m.uploaderId);
    const mod = up?.role === 'host' || up?.role === 'cohost';
    if (up?.banned) excluded.push({ id: m.id, reason: 'uploader removed' });
    else if (m.status !== 'approved') excluded.push({ id: m.id, reason: 'not approved' });
    else if (!m.recapConsent && !mod) excluded.push({ id: m.id, reason: 'uploader did not allow recap use' });
    else rows.push(m);
  }
  return { rows, excluded };
}

function resolveSoundtrack(eventId: string, s: SoundtrackRef): { title: string; license: string } {
  if (s.kind === 'demo') {
    const d = DEMO_SOUNDTRACKS[s.id];
    if (!d) throw new HttpError(404, 'not_found', 'Unknown demo soundtrack');
    return { title: d.title, license: d.license };
  }
  const m = T.media().get(s.mediaId);
  if (!m || m.eventId !== eventId || m.mediaType !== 'audio' || m.status !== 'approved' || m.rightsAttested !== true) throw new HttpError(404, 'not_found', 'Soundtrack not found, or its rights were not confirmed');
  return { title: m.originalName.replace(/\.[^.]+$/, ''), license: 'Host attested they hold recap/sync rights' };
}

export function listSoundtracks(eventKey: string, ctx: Ctx) {
  const { event } = requireMod(eventKey, ctx);
  return {
    demo: Object.entries(DEMO_SOUNDTRACKS).map(([id, d]) => ({ id, title: d.title, license: d.license })),
    uploads: T.media()
      .where((m) => m.eventId === event.id && m.mediaType === 'audio' && m.status === 'approved' && m.rightsAttested === true)
      .map((m) => ({ id: m.id, title: m.originalName, size: m.size })),
    spotify: { eligible: false, reason: 'Spotify recordings cannot be used in rendered videos (Spotify Developer Policy). Suggestions from guests are references only. Upload audio you have rights to, or use a demo song.' },
  };
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------
const publishProgress = (job: JobRow) => publish(job.eventId, 'render.progress', { jobId: job.id, projectId: job.projectId, type: job.type, status: job.status, progress: job.progress });

export function createRecap(eventKey: string, ctx: Ctx, raw: unknown) {
  const { event, member } = requireMod(eventKey, ctx);
  if (raw && typeof raw === 'object' && (raw as { soundtrack?: { kind?: string } }).soundtrack?.kind === 'spotify') {
    throw new HttpError(422, 'spotify_not_eligible', 'Spotify recordings cannot be used as a recap soundtrack. Choose a demo song or upload audio you have rights to.');
  }
  rateLimit(`recap:${member.id}`, 10, 60 * 60_000);
  const input = createRecapSchema.parse(raw);
  resolveSoundtrack(event.id, input.soundtrack);
  const { rows } = eligibleMedia(event.id);
  if (rows.length === 0) throw new HttpError(422, 'no_media', 'There are no eligible photos or videos yet. Media must be approved, and guests must allow recap use.');
  const t = now();
  const project = R.projects().insert({
    id: randomUUID(),
    eventId: event.id,
    hostMemberId: member.id,
    title: event.title,
    preset: input.preset,
    aspect: input.aspect,
    targetMs: input.targetMs,
    soundtrack: input.soundtrack,
    status: 'planning',
    version: 0,
    assessments: [],
    createdAt: t,
    updatedAt: t,
  });
  const job = enqueueJob(project, 'plan', 0);
  return { project, job };
}

function enqueueJob(project: RecapProjectRow, type: JobType, timelineVersion: number): JobRow {
  const key = sha256(`${project.id}|${type}|${timelineVersion}|${type === 'plan' ? project.createdAt : ''}`);
  const existing = R.jobs().find((j) => j.projectId === project.id && j.idempotencyKey === key && j.status !== 'failed' && j.status !== 'canceled');
  if (existing) return existing; // idempotent: never duplicate expensive work
  const job = R.jobs().insert({
    id: randomUUID(),
    projectId: project.id,
    eventId: project.eventId,
    type,
    status: 'queued',
    progress: 0,
    attempts: 0,
    maxAttempts: MAX_ATTEMPTS,
    notBefore: 0,
    idempotencyKey: key,
    timelineVersion,
    logs: [],
    createdAt: now(),
  });
  publishProgress(job);
  return job;
}

export function getProject(projectId: string, ctx: Ctx) {
  const project = R.projects().get(projectId);
  if (!project) throw new HttpError(404, 'not_found', 'Recap not found');
  const { event } = requireMod(project.eventId, ctx);
  const current = R.timelines().find((t) => t.projectId === project.id && t.version === project.version);
  const jobs = R.jobs().where((j) => j.projectId === project.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 12);
  const { rows, excluded } = eligibleMedia(event.id);
  return { project, timeline: current?.timeline ?? null, versions: R.timelines().where((t) => t.projectId === project.id).map((t) => t.version).sort((a, b) => a - b), jobs, eligible: rows, excluded };
}

export function listProjects(eventKey: string, ctx: Ctx) {
  const { event } = requireMod(eventKey, ctx);
  return R.projects().where((p) => p.eventId === event.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function assetRefs(eventId: string) {
  const { rows } = eligibleMedia(eventId);
  return new Map(rows.map((m) => [m.id, { id: m.id, mediaType: m.mediaType as 'image' | 'video', durationMs: undefined as number | undefined }]));
}

export function saveTimeline(projectId: string, ctx: Ctx, raw: { timeline: unknown; baseVersion: number }) {
  const project = R.projects().get(projectId);
  if (!project) throw new HttpError(404, 'not_found', 'Recap not found');
  const { member } = requireMod(project.eventId, ctx);
  if (raw.baseVersion !== project.version) throw new HttpError(409, 'version_conflict', 'Someone else edited this recap. Reload to see the latest.');
  const tl = recapTimelineSchema.parse(raw.timeline);
  // edits may only reference media that is currently eligible (approved + consented)
  const refs = new Map(assetRefs(project.eventId));
  for (const a of project.assessments) if (a.durationMs && refs.has(a.id)) refs.set(a.id, { ...refs.get(a.id)!, durationMs: a.durationMs });
  const problems = validateTimeline(tl, refs);
  if (problems.length) throw new HttpError(422, 'invalid_timeline', problems[0]!);
  return commitTimeline(project, tl, member.id);
}

function commitTimeline(project: RecapProjectRow, tl: RecapTimeline, by: string) {
  const version = project.version + 1;
  R.timelines().insert({ id: randomUUID(), projectId: project.id, version, timeline: tl, createdBy: by, createdAt: now() });
  const updated = R.projects().update(project.id, { version, status: 'ready', updatedAt: now() });
  // cap history
  const all = R.timelines().where((t) => t.projectId === project.id).sort((a, b) => a.version - b.version);
  for (const old of all.slice(0, Math.max(0, all.length - 50))) R.timelines().delete(old.id);
  return updated;
}

export function restoreVersion(projectId: string, ctx: Ctx, version: number) {
  const project = R.projects().get(projectId);
  if (!project) throw new HttpError(404, 'not_found', 'Recap not found');
  const { member } = requireMod(project.eventId, ctx);
  const row = R.timelines().find((t) => t.projectId === project.id && t.version === version);
  if (!row) throw new HttpError(404, 'not_found', 'That version no longer exists');
  return commitTimeline(project, row.timeline, member.id);
}

export function regenerateSection(projectId: string, ctx: Ctx, body: { fromMs: number; toMs: number; seed?: number }) {
  const project = R.projects().get(projectId);
  if (!project) throw new HttpError(404, 'not_found', 'Recap not found');
  const { member } = requireMod(project.eventId, ctx);
  const cur = R.timelines().find((t) => t.projectId === project.id && t.version === project.version);
  if (!cur) throw new HttpError(409, 'not_ready', 'The recap is still being planned');
  const { rows } = eligibleMedia(project.eventId);
  const quality = new Map(project.assessments.map((a) => [a.id, a]));
  const members = new Map(T.members().where((m) => m.eventId === project.eventId).map((m) => [m.id, m.displayName]));
  const assets: PlanAsset[] = rows
    .filter((m) => quality.get(m.id)?.usable !== false)
    .map((m) => ({
      id: m.id,
      mediaType: m.mediaType as 'image' | 'video',
      durationMs: quality.get(m.id)?.durationMs,
      takenAtMs: Date.parse(m.takenAt ?? m.createdAt),
      uploaderId: m.uploaderId,
      uploaderName: members.get(m.uploaderId) ?? 'Guest',
      quality: quality.get(m.id)?.quality ?? 0.5,
      pinned: m.mustInclude,
    }));
  if (assets.length === 0) throw new HttpError(422, 'no_media', 'No eligible media to choose from');
  const next = regenerateRange(cur.timeline, assets, body.fromMs, body.toMs, body.seed ?? Math.floor(Math.random() * 1e9));
  return commitTimeline(project, normalizeTimeline(next), member.id);
}

// ---------------------------------------------------------------------------
// Render jobs
// ---------------------------------------------------------------------------
export function startRender(projectId: string, ctx: Ctx, type: 'preview' | 'final') {
  const project = R.projects().get(projectId);
  if (!project) throw new HttpError(404, 'not_found', 'Recap not found');
  const { member } = requireMod(project.eventId, ctx);
  if (project.status !== 'ready' || project.version < 1) throw new HttpError(409, 'not_ready', 'The recap has no timeline yet');
  rateLimit(`render:${member.id}`, 20, 60 * 60_000);
  const tl = R.timelines().find((t) => t.projectId === project.id && t.version === project.version)!.timeline;
  const refs = assetRefs(project.eventId);
  const problems = validateTimeline(tl, refs);
  if (problems.length) throw new HttpError(422, 'invalid_timeline', problems[0]!);
  return enqueueJob(project, type, project.version);
}

export function getJob(jobId: string, ctx: Ctx) {
  const job = R.jobs().get(jobId);
  if (!job) throw new HttpError(404, 'not_found', 'Job not found');
  requireMod(job.eventId, ctx);
  return job;
}

export function cancelJob(jobId: string, ctx: Ctx) {
  const job = getJob(jobId, ctx);
  if (!ACTIVE_STATUSES.includes(job.status)) return job;
  if (job.status === 'queued') {
    const j = R.jobs().update(job.id, { status: 'canceled', finishedAt: now() });
    publishProgress(j);
    return j;
  }
  return R.jobs().update(job.id, { cancelRequested: true }); // running: the worker sees it on its next progress call
}

export function videoUrl(job: JobRow): string | null {
  if (!job.outputKey || job.status !== 'complete') return null;
  return `/api/recaps/${job.projectId}/video/${job.id}?t=${encodeURIComponent(signToken({ t: 'recap', jid: job.id }, 10 * 60_000))}`;
}
export function authorizeVideo(jobId: string, token: string | null) {
  const p = verifyToken<{ t: string; jid: string }>(token);
  const job = R.jobs().get(jobId);
  if (!p || p.t !== 'recap' || p.jid !== jobId || !job?.outputKey) throw new HttpError(403, 'bad_signature', 'This link has expired');
  return job;
}

// ---------------------------------------------------------------------------
// Worker-facing operations
// ---------------------------------------------------------------------------
/** Re-queue jobs whose worker went silent (crash, closed laptop): safe retry instead of a stuck job. */
export function reapStaleJobs(nowMs = Date.now()) {
  for (const j of R.jobs().where((j) => ACTIVE_STATUSES.includes(j.status) && j.status !== 'queued' && (j.heartbeatAt ?? 0) < nowMs - LEASE_MS)) {
    failJob(j.id, 'Worker stopped responding', true, nowMs);
  }
}

export function claimJob(workerId: string, nowMs = Date.now()): ClaimedJob | null {
  reapStaleJobs(nowMs);
  const job = R.jobs()
    .where((j) => j.status === 'queued' && j.notBefore <= nowMs)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
  if (!job) return null;
  const project = R.projects().get(job.projectId);
  if (!project || !T.events().get(project.eventId)) {
    R.jobs().update(job.id, { status: 'failed', error: 'Project no longer exists', finishedAt: now() });
    return null;
  }
  const status: JobStatus = job.type === 'plan' ? 'analyzing' : job.type === 'preview' ? 'preview' : 'rendering';
  const updated = R.jobs().update(job.id, { status, attempts: job.attempts + 1, workerId, heartbeatAt: nowMs, startedAt: job.startedAt ?? now(), progress: 0, error: undefined, cancelRequested: false });
  publishProgress(updated);

  const members = new Map(T.members().where((m) => m.eventId === project.eventId).map((m) => [m.id, m.displayName]));
  let assets: ClaimedJob['assets'];
  let timeline: RecapTimeline | undefined;
  if (job.type === 'plan') {
    assets = eligibleMedia(project.eventId).rows.map((m) => ({ id: m.id, mediaType: m.mediaType as 'image' | 'video', takenAt: m.takenAt ?? m.createdAt, uploaderId: m.uploaderId, uploaderName: members.get(m.uploaderId) ?? 'Guest', pinned: m.mustInclude }));
  } else {
    timeline = R.timelines().find((t) => t.projectId === project.id && t.version === job.timelineVersion)?.timeline;
    const used = new Set(timeline?.clips.map((c) => c.assetId));
    // re-check eligibility at render time: a photo hidden after planning must not be rendered
    const ok = new Map(eligibleMedia(project.eventId).rows.map((m) => [m.id, m]));
    const missing = [...used].filter((id) => !ok.has(id));
    if (missing.length || !timeline) {
      const j = R.jobs().update(job.id, { status: 'failed', error: missing.length ? `${missing.length} photo(s)/video(s) in the timeline are no longer approved. Edit the recap and render again.` : 'Timeline missing', finishedAt: now() });
      publishProgress(j);
      return null;
    }
    assets = [...used].map((id) => {
      const m = ok.get(id)!;
      return { id, mediaType: m.mediaType as 'image' | 'video', takenAt: m.takenAt ?? m.createdAt, uploaderId: m.uploaderId, uploaderName: members.get(m.uploaderId) ?? 'Guest', pinned: m.mustInclude };
    });
  }
  const st = resolveSoundtrack(project.eventId, project.soundtrack);
  const audio: ClaimedJob['audio'] = project.soundtrack.kind === 'demo' ? { kind: 'demo', path: `/demo/${DEMO_SOUNDTRACKS[project.soundtrack.id]!.file}`, ...st } : { kind: 'upload', mediaId: project.soundtrack.mediaId, ...st };
  return {
    job: { id: job.id, type: job.type, attempt: updated.attempts, projectId: project.id, eventId: project.eventId },
    project: { id: project.id, preset: project.preset, aspect: project.aspect, targetMs: project.targetMs, title: project.title, soundtrack: project.soundtrack },
    assets,
    timeline,
    audio,
  };
}

export function jobProgress(jobId: string, body: { status?: JobStatus; progress?: number; log?: string }, nowMs = Date.now()): { cancel: boolean } {
  const job = R.jobs().get(jobId);
  if (!job) throw new HttpError(404, 'not_found', 'Job not found');
  if (!ACTIVE_STATUSES.includes(job.status)) return { cancel: true }; // already finished/canceled elsewhere
  const patch: Partial<JobRow> = { heartbeatAt: nowMs };
  if (body.status && ACTIVE_STATUSES.includes(body.status)) patch.status = body.status;
  if (typeof body.progress === 'number') patch.progress = Math.max(0, Math.min(99, Math.round(body.progress)));
  if (body.log) patch.logs = [...job.logs, cleanText(body.log, 300)].slice(-40);
  const j = R.jobs().update(job.id, patch);
  publishProgress(j);
  return { cancel: !!job.cancelRequested };
}

export function completePlan(jobId: string, result: PlanResult) {
  const job = R.jobs().get(jobId);
  if (!job || job.type !== 'plan') throw new HttpError(404, 'not_found', 'Job not found');
  const project = R.projects().get(job.projectId)!;
  const tl = recapTimelineSchema.parse(result.timeline);
  const refs = new Map(assetRefs(project.eventId));
  for (const a of result.assessments) if (a.durationMs && refs.has(a.id)) refs.set(a.id, { ...refs.get(a.id)!, durationMs: a.durationMs });
  const problems = validateTimeline(tl, refs);
  if (problems.length) return failJob(jobId, `Planner produced an invalid timeline: ${problems[0]}`, false);
  R.projects().update(project.id, { assessments: result.assessments, analysis: result.analysis, error: undefined });
  commitTimeline(R.projects().get(project.id)!, tl, 'worker');
  const j = R.jobs().update(job.id, { status: 'complete', progress: 100, finishedAt: now() });
  publishProgress(j);
  return j;
}

export function outputKeyFor(job: JobRow) {
  return objectKey(job.eventId, job.id, 'mp4');
}

export function completeRender(jobId: string) {
  const job = R.jobs().get(jobId);
  if (!job || job.type === 'plan') throw new HttpError(404, 'not_found', 'Job not found');
  const key = outputKeyFor(job);
  const size = objectSize(key);
  if (!size) return failJob(jobId, 'Worker finished but no video was uploaded', true);
  const j = R.jobs().update(job.id, { status: 'complete', progress: 100, outputKey: key, finishedAt: now() });
  publishProgress(j);
  return j;
}

/** Retryable failures re-queue with exponential backoff until `maxAttempts`, then fail for good. */
export function failJob(jobId: string, error: string, retryable: boolean, nowMs = Date.now()) {
  const job = R.jobs().get(jobId);
  if (!job) throw new HttpError(404, 'not_found', 'Job not found');
  if (job.status === 'canceled' || job.status === 'complete') return job;
  const msg = cleanText(error, 400);
  let j: JobRow;
  if (job.cancelRequested) j = R.jobs().update(job.id, { status: 'canceled', error: undefined, finishedAt: now() });
  else if (retryable && job.attempts < job.maxAttempts) {
    j = R.jobs().update(job.id, { status: 'queued', error: msg, notBefore: nowMs + 2000 * 2 ** job.attempts, workerId: undefined, logs: [...job.logs, `attempt ${job.attempts} failed: ${msg}`].slice(-40) });
  } else {
    j = R.jobs().update(job.id, { status: 'failed', error: msg, finishedAt: now() });
    if (job.type === 'plan') R.projects().update(job.projectId, { status: 'failed', error: msg });
    if (job.outputKey) deleteObject(job.outputKey);
  }
  publishProgress(j);
  return j;
}

export function projectsForEventDelete(eventId: string) {
  for (const p of R.projects().where((p) => p.eventId === eventId)) {
    for (const j of R.jobs().where((j) => j.projectId === p.id)) if (j.outputKey) deleteObject(j.outputKey);
    R.jobs().deleteWhere((j) => j.projectId === p.id);
    R.timelines().deleteWhere((t) => t.projectId === p.id);
    R.projects().delete(p.id);
  }
}

export function demoSoundtrackPath(id: string): string {
  const d = DEMO_SOUNDTRACKS[id];
  if (!d) throw new HttpError(404, 'not_found', 'Unknown demo soundtrack');
  return path.join(process.cwd(), 'public', 'demo', d.file);
}
