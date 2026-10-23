import { ctxFor, readJson, withParams } from '@/lib/server/http';
import { voteSong } from '@/lib/server/party';

export const dynamic = 'force-dynamic';

export const POST = withParams<{ id: string; requestId: string }>(async (req, { id, requestId }) => {
  voteSong(id, await ctxFor(req, id), requestId, await readJson(req));
  return { ok: true };
});
