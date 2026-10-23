import { Readable } from 'node:stream';
import { withParams } from '@/lib/server/http';
import { markWorkerSeen, requireWorker } from '@/lib/server/recap';
import { T } from '@/lib/server/party';
import { objectSize, streamObject } from '@/lib/server/storage';
import { HttpError } from '@/lib/server/security';

export const dynamic = 'force-dynamic';

/** Original bytes of an upload for the worker (shared-secret auth). Eligibility is enforced when the job is claimed. */
export const GET = withParams<{ mediaId: string }>(async (req, { mediaId }) => {
  requireWorker(req.headers.get('authorization'));
  markWorkerSeen();
  const m = T.media().get(mediaId);
  if (!m || m.status !== 'approved') throw new HttpError(404, 'not_found', 'Media not found');
  const size = objectSize(m.objectKey);
  if (size === null) throw new HttpError(404, 'not_found', 'File missing');
  return new Response(Readable.toWeb(streamObject(m.objectKey)) as unknown as ReadableStream, { headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': String(size) } });
});
