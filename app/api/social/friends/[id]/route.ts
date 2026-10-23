import { z } from 'zod';
import { readJson, requireUser, withParams } from '@/lib/server/http';
import { removeFriend, respondToRequest } from '@/lib/server/social';

export const dynamic = 'force-dynamic';

/** Answer a friend request: { accept: boolean } */
export const PATCH = withParams<{ id: string }>(async (req, { id }) => {
  const { accept } = z.object({ accept: z.boolean() }).parse(await readJson(req));
  respondToRequest(await requireUser(), id, accept);
  return { ok: true };
});

export const DELETE = withParams<{ id: string }>(async (_req, { id }) => {
  removeFriend(await requireUser(), id);
  return { ok: true };
});
