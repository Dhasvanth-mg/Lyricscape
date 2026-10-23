import { ctxFor, readJson, withParams } from '@/lib/server/http';
import { deleteMedia, moderateMedia } from '@/lib/server/party';

export const dynamic = 'force-dynamic';

export const PATCH = withParams<{ id: string; assetId: string }>(async (req, { id, assetId }) => {
  moderateMedia(id, await ctxFor(req, id), assetId, await readJson(req));
  return { ok: true };
});

export const DELETE = withParams<{ id: string; assetId: string }>(async (req, { id, assetId }) => {
  deleteMedia(id, await ctxFor(req, id), assetId);
  return { ok: true };
});
