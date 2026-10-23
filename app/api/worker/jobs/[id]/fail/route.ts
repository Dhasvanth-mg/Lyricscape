import { z } from 'zod';
import { readJson, withParams } from '@/lib/server/http';
import { failJob, markWorkerSeen, requireWorker } from '@/lib/server/recap';

export const dynamic = 'force-dynamic';

export const POST = withParams<{ id: string }>(async (req, { id }) => {
  requireWorker(req.headers.get('authorization'));
  markWorkerSeen();
  const body = z.object({ error: z.string().max(1000), retryable: z.boolean().default(true) }).parse(await readJson(req));
  const j = failJob(id, body.error, body.retryable);
  return { status: j.status, willRetry: j.status === 'queued' };
});
