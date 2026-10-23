import { z } from 'zod';
import { ctxFor, readJson, withParams } from '@/lib/server/http';
import { findEvent } from '@/lib/server/party';
import { R, startRender, workerOnline } from '@/lib/server/recap';
import { HttpError } from '@/lib/server/security';

export const dynamic = 'force-dynamic';

/**
 * Queue a render. Idempotent per (project, timeline version, type): repeating the request returns the
 * same job instead of starting duplicate work. Rendering happens in the media worker, never here.
 */
export const POST = withParams<{ id: string }>(async (req, { id }) => {
  const p = R.projects().get(id);
  if (!p) throw new HttpError(404, 'not_found', 'Recap not found');
  const { type } = z.object({ type: z.enum(['preview', 'final']) }).parse(await readJson(req));
  const job = startRender(id, await ctxFor(req, findEvent(p.eventId)!.id), type);
  return Response.json({ jobId: job.id, status: job.status, workerOnline: workerOnline() }, { status: 202 });
});
