import { z } from 'zod';
import { handle, readJson, requireUser } from '@/lib/server/http';
import { createPost, feed } from '@/lib/server/social';

export const dynamic = 'force-dynamic';

export const GET = handle(async (req) => {
  const me = await requireUser();
  const q = new URL(req.url).searchParams;
  const scope = z.enum(['friends', 'public', 'mine']).catch('friends').parse(q.get('scope'));
  return feed(me, { scope, before: q.get('before') ?? undefined, limit: Number(q.get('limit') ?? 20) });
});

export const POST = handle(async (req) => {
  const me = await requireUser();
  const p = createPost(me, await readJson(req));
  return Response.json({ id: p.id }, { status: 201 });
});
