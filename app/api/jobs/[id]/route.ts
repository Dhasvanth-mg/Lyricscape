import { ctxFor, withParams } from '@/lib/server/http';
import { cancelJob, getJob, R, videoUrl } from '@/lib/server/recap';
import { findEvent } from '@/lib/server/party';
import { HttpError } from '@/lib/server/security';

export const dynamic = 'force-dynamic';

const dto = (j: ReturnType<typeof getJob>) => ({
  id: j.id,
  projectId: j.projectId,
  type: j.type,
  status: j.status,
  progress: j.progress,
  attempts: j.attempts,
  maxAttempts: j.maxAttempts,
  error: j.error,
  logs: j.logs.slice(-10),
  videoUrl: videoUrl(j),
});

const ctxForJob = async (req: Request, id: string) => {
  const j = R.jobs().get(id);
  if (!j) throw new HttpError(404, 'not_found', 'Job not found');
  return ctxFor(req, findEvent(j.eventId)!.id);
};

export const GET = withParams<{ id: string }>(async (req, { id }) => dto(getJob(id, await ctxForJob(req, id))));

/** POST /api/jobs/:id  -> cancel */
export const POST = withParams<{ id: string }>(async (req, { id }) => dto(cancelJob(id, await ctxForJob(req, id))));
