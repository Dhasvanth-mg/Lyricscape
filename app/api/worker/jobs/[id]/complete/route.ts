import { readJson, withParams } from '@/lib/server/http';
import { completePlan, completeRender, markWorkerSeen, R, requireWorker } from '@/lib/server/recap';
import { HttpError } from '@/lib/server/security';
import type { PlanResult } from '@/lib/recap/jobs';

export const dynamic = 'force-dynamic';

/** plan jobs post their result here; render jobs call this after uploading the MP4 to /output. */
export const POST = withParams<{ id: string }>(async (req, { id }) => {
  requireWorker(req.headers.get('authorization'));
  markWorkerSeen();
  const job = R.jobs().get(id);
  if (!job) throw new HttpError(404, 'not_found', 'Job not found');
  const j = job.type === 'plan' ? completePlan(id, await readJson<PlanResult>(req, 2 * 1024 * 1024)) : completeRender(id);
  return { status: j.status };
});
