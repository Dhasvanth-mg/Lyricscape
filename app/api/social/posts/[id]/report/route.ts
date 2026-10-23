import { z } from 'zod';
import { readJson, requireUser, withParams } from '@/lib/server/http';
import { reportPost } from '@/lib/server/social';

export const dynamic = 'force-dynamic';

export const POST = withParams<{ id: string }>(async (req, { id }) => {
  const { reason } = z.object({ reason: z.string().min(2).max(300) }).parse(await readJson(req));
  reportPost(await requireUser(), id, reason);
  return Response.json({ ok: true }, { status: 201 });
});
