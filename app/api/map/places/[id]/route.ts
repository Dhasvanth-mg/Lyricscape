import { requireUser, withParams } from '@/lib/server/http';
import { deletePlace } from '@/lib/server/map';

export const dynamic = 'force-dynamic';

/** “Hide this place”: removes every spot recorded there. */
export const DELETE = withParams<{ id: string }>(async (_req, { id }) => {
  deletePlace((await requireUser()).id, id);
  return { ok: true };
});
