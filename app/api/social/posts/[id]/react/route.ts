import { z } from 'zod';
import { readJson, requireUser, withParams } from '@/lib/server/http';
import { react } from '@/lib/server/social';

export const dynamic = 'force-dynamic';

export const POST = withParams<{ id: string }>(async (req, { id }) => {
  const { kind } = z.object({ kind: z.enum(['like', 'fire', 'heart']).nullable() }).parse(await readJson(req));
  react(await requireUser(), id, kind);
  return { ok: true };
});
