import { ctxFor, readJson, withParams } from '@/lib/server/http';
import { createUploadIntent } from '@/lib/server/party';

export const dynamic = 'force-dynamic';

/** Step 1 of the direct-upload flow: returns a short-lived signed URL the browser PUTs the bytes to. */
export const POST = withParams<{ id: string }>(async (req, { id }) => {
  const r = createUploadIntent(id, await ctxFor(req, id), await readJson(req));
  return Response.json(
    { mediaId: r.media.id, uploadUrl: r.uploadUrl, maxBytes: r.maxBytes, expiresInMs: r.expiresInMs, method: 'PUT', headers: { 'Content-Type': r.media.declaredMime } },
    { status: 201 },
  );
});
