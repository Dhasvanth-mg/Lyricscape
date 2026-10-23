import { ctxFor, withParams } from '@/lib/server/http';
import { snapshotFor } from '@/lib/server/party';

export const dynamic = 'force-dynamic';

/** Media visible to the caller (approved for members, plus own pending; everything for moderators), with fresh signed URLs. */
export const GET = withParams<{ id: string }>(async (req, { id }) => {
  const snap = snapshotFor(id, await ctxFor(req, id));
  return { media: snap.media };
});
