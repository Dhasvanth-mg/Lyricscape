import { z } from 'zod';
import { ctxFor, readJson, withParams } from '@/lib/server/http';
import { findEvent } from '@/lib/server/party';
import { R, restoreVersion, saveTimeline } from '@/lib/server/recap';
import { HttpError } from '@/lib/server/security';

export const dynamic = 'force-dynamic';

const eventKeyFor = (projectId: string) => {
  const p = R.projects().get(projectId);
  if (!p) throw new HttpError(404, 'not_found', 'Recap not found');
  return findEvent(p.eventId)!.id;
};

/** Save an edited timeline (optimistic concurrency via baseVersion; every save is a restorable version). */
export const PATCH = withParams<{ id: string }>(async (req, { id }) => {
  const body = z.object({ timeline: z.unknown(), baseVersion: z.number().int().min(0) }).parse(await readJson(req, 512 * 1024));
  const p = saveTimeline(id, await ctxFor(req, eventKeyFor(id)), { timeline: body.timeline, baseVersion: body.baseVersion });
  return { version: p.version };
});

/** Undo/redo: re-save an earlier version as the newest one. */
export const POST = withParams<{ id: string }>(async (req, { id }) => {
  const { version } = z.object({ version: z.number().int().min(1) }).parse(await readJson(req));
  const p = restoreVersion(id, await ctxFor(req, eventKeyFor(id)), version);
  return { version: p.version };
});
