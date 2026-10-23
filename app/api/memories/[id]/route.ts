import { requireUser, withParams } from '@/lib/server/http';
import { deleteMemory } from '@/lib/server/map';

export const dynamic = 'force-dynamic';

export const DELETE = withParams<{ id: string }>(async (_req, { id }) => {
  deleteMemory((await requireUser()).id, id);
  return { ok: true };
});
