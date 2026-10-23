import { ctxFor, withParams } from '@/lib/server/http';
import { findEvent, mediaUrl } from '@/lib/server/party';
import { getProject, R, videoUrl, workerOnline } from '@/lib/server/recap';
import { HttpError } from '@/lib/server/security';

export const dynamic = 'force-dynamic';

export const GET = withParams<{ id: string }>(async (req, { id }) => {
  const p = R.projects().get(id);
  if (!p) throw new HttpError(404, 'not_found', 'Recap not found');
  const ev = findEvent(p.eventId)!;
  const d = getProject(id, await ctxFor(req, ev.id));
  const quality = new Map(d.project.assessments.map((a) => [a.id, a]));
  return {
    project: { ...d.project, assessments: undefined },
    timeline: d.timeline,
    versions: d.versions,
    analysis: d.project.analysis ?? null,
    workerOnline: workerOnline(),
    jobs: d.jobs.map((j) => ({ id: j.id, type: j.type, status: j.status, progress: j.progress, attempts: j.attempts, maxAttempts: j.maxAttempts, error: j.error, logs: j.logs.slice(-6), timelineVersion: j.timelineVersion, createdAt: j.createdAt, finishedAt: j.finishedAt, videoUrl: videoUrl(j) })),
    assets: d.eligible.map((m) => ({
      id: m.id,
      mediaType: m.mediaType,
      url: mediaUrl(m.id, m.eventId),
      mustInclude: m.mustInclude,
      quality: quality.get(m.id)?.quality ?? null,
      usable: quality.get(m.id)?.usable ?? true,
      reason: quality.get(m.id)?.reason ?? null,
      duplicateOf: quality.get(m.id)?.duplicateOf ?? null,
      durationMs: quality.get(m.id)?.durationMs ?? null,
    })),
    excluded: d.excluded,
  };
});
