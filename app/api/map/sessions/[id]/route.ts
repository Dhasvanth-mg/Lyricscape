import { requireUser, withParams } from '@/lib/server/http';
import { deleteSession } from '@/lib/server/map';

export const dynamic = 'force-dynamic';

export const DELETE = withParams<{ id: string }>(async (_req, { id }) => {
  deleteSession((await requireUser()).id, id);
  return { ok: true };
});
