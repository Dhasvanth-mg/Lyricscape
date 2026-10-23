import { ctxFor, readJson, withParams } from '@/lib/server/http';
import { suggestSong } from '@/lib/server/party';

export const dynamic = 'force-dynamic';

export const POST = withParams<{ id: string }>(async (req, { id }) => {
  const { request, duplicate } = suggestSong(id, await ctxFor(req, id), await readJson(req));
  return Response.json({ id: request.id, status: request.status, duplicate }, { status: duplicate ? 200 : 201 });
});
