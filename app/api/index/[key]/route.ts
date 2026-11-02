// One song in the index. Keys are track ids (spotify:track:..., demo:..., licensed:...), URL-encoded.
//   GET    /api/index/<key>?title=&artists=&duration=   everything known (audio features may come from another copy of the recording)
//   PUT    /api/index/<key>                             store derived data { song, features: { audio?, palette?, lyrics? } }
//   POST   /api/index/<key>                             count a play
//   DELETE /api/index/<key>                             forget this song (or only ?kind=audio|palette|lyrics)

import { z } from 'zod';
import { readJson, withParams } from '@/lib/server/http';
import { HttpError } from '@/lib/server/security';
import { songIndex } from '@/lib/server/songIndex';
import { FEATURE_KINDS, putBodySchema } from '@/lib/index/types';

export const dynamic = 'force-dynamic';

const keySchema = z.string().trim().min(1).max(300);
const getQuery = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  artists: z.string().max(1000).optional(),
  duration: z.coerce.number().int().min(1000).max(3 * 3600_000).optional(),
});

const needIndex = () => {
  if (!songIndex.available()) throw new HttpError(503, 'index_unavailable', 'The song index needs Node 22.5 or newer (node:sqlite). The app works without it.');
};

export const GET = withParams<{ key: string }>(async (req, { key }) => {
  const k = keySchema.parse(decodeURIComponent(key));
  if (!songIndex.available()) return { available: false, entry: null };
  const q = getQuery.parse(Object.fromEntries(new URL(req.url).searchParams));
  const meta = q.title && q.duration ? { title: q.title, artists: (q.artists ?? '').split('\n').filter(Boolean), durationMs: q.duration } : undefined;
  return { available: true, entry: songIndex.get(k, meta) };
});

export const PUT = withParams<{ key: string }>(async (req, { key }) => {
  needIndex();
  const k = keySchema.parse(decodeURIComponent(key));
  const body = putBodySchema.parse(await readJson(req, 1_200_000));
  songIndex.put(k, body);
  return { ok: true };
});

export const POST = withParams<{ key: string }>(async (_req, { key }) => {
  needIndex();
  songIndex.touch(keySchema.parse(decodeURIComponent(key)));
  return { ok: true };
});

export const DELETE = withParams<{ key: string }>(async (req, { key }) => {
  needIndex();
  const k = keySchema.parse(decodeURIComponent(key));
  const kind = new URL(req.url).searchParams.get('kind');
  if (kind) return { removed: songIndex.removeFeature(k, z.enum(FEATURE_KINDS).parse(kind)) };
  return { removed: songIndex.remove(k) };
});
