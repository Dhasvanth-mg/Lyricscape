import { z } from 'zod';
import { ctxFor, readJson, withParams } from '@/lib/server/http';
import { completeUpload } from '@/lib/server/party';

export const dynamic = 'force-dynamic';

/** Step 3: verify the bytes that arrived (size + magic-number sniffing) and publish/queue the item. */
export const POST = withParams<{ id: string }>(async (req, { id }) => {
  const { mediaId } = z.object({ mediaId: z.string().uuid() }).parse(await readJson(req));
  const m = completeUpload(id, await ctxFor(req, id), mediaId);
  return { mediaId: m.id, status: m.status, mime: m.mime, size: m.size };
});
