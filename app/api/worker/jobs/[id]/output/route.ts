import { withParams } from '@/lib/server/http';
import { markWorkerSeen, outputKeyFor, R, requireWorker } from '@/lib/server/recap';
import { putObject, readHead } from '@/lib/server/storage';
import { HttpError } from '@/lib/server/security';

export const dynamic = 'force-dynamic';
export const maxDuration = 600;

/** The worker uploads the finished MP4 here (stand-in for a presigned R2 PUT). */
export const PUT = withParams<{ id: string }>(async (req, { id }) => {
  requireWorker(req.headers.get('authorization'));
  markWorkerSeen();
  const job = R.jobs().get(id);
  if (!job || job.type === 'plan') throw new HttpError(404, 'not_found', 'Job not found');
  const key = outputKeyFor(job);
  const bytes = await putObject(key, req.body, 2 * 1024 ** 3);
  const head = readHead(key, 12);
  if (String.fromCharCode(...head.slice(4, 8)) !== 'ftyp') throw new HttpError(422, 'invalid_media', 'Upload is not an MP4 file');
  return { ok: true, bytes };
});
