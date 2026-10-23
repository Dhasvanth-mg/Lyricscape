import { z } from 'zod';
import { readJson, withParams } from '@/lib/server/http';
import { jobProgress, markWorkerSeen, requireWorker } from '@/lib/server/recap';

export const dynamic = 'force-dynamic';

/** Heartbeat + progress. The response tells the worker whether the host canceled the job. */
export const POST = withParams<{ id: string }>(async (req, { id }) => {
  requireWorker(req.headers.get('authorization'));
  markWorkerSeen();
  const body = z
    .object({ status: z.enum(['analyzing', 'planning', 'preview', 'rendering']).optional(), progress: z.number().min(0).max(100).optional(), log: z.string().max(400).optional() })
    .parse(await readJson(req));
  return jobProgress(id, body);
});
