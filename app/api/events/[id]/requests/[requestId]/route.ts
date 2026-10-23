import { ctxFor, readJson, withParams } from '@/lib/server/http';
import { moderateRequest, snapshotFor } from '@/lib/server/party';

export const dynamic = 'force-dynamic';

export const PATCH = withParams<{ id: string; requestId: string }>(async (req, { id, requestId }) => {
  const ctx = await ctxFor(req, id);
  moderateRequest(id, ctx, requestId, await readJson(req));
  return snapshotFor(id, ctx);
});
