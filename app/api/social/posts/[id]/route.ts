import { requireUser, withParams } from '@/lib/server/http';
import { deletePost } from '@/lib/server/social';

export const dynamic = 'force-dynamic';

export const DELETE = withParams<{ id: string }>(async (_req, { id }) => {
  deletePost(await requireUser(), id);
  return { ok: true };
});
