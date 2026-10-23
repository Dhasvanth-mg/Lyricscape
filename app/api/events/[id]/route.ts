import { ctxFor, readJson, withParams } from '@/lib/server/http';
import { deleteEvent, patchEvent, snapshotFor } from '@/lib/server/party';

export const dynamic = 'force-dynamic';

export const GET = withParams<{ id: string }>(async (req, { id }) => snapshotFor(id, await ctxFor(req, id)));

export const PATCH = withParams<{ id: string }>(async (req, { id }) => {
  const ctx = await ctxFor(req, id);
  patchEvent(id, ctx, await readJson(req));
  return snapshotFor(id, ctx);
});

export const DELETE = withParams<{ id: string }>(async (req, { id }) => {
  deleteEvent(id, await ctxFor(req, id));
  return { ok: true };
});
