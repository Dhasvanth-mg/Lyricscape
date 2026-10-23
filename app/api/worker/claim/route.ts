import { z } from 'zod';
import { handle, readJson } from '@/lib/server/http';
import { claimJob, markWorkerSeen, requireWorker } from '@/lib/server/recap';

export const dynamic = 'force-dynamic';

/** Media worker long-polls this endpoint (shared-secret auth; the worker is a separate process/host). */
export const POST = handle(async (req) => {
  requireWorker(req.headers.get('authorization'));
  markWorkerSeen();
  const { workerId } = z.object({ workerId: z.string().min(1).max(64) }).parse(await readJson(req));
  const claimed = claimJob(workerId);
  return claimed ? { job: claimed } : { job: null };
});
