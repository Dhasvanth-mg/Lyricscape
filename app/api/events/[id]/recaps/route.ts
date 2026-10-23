import { ctxFor, readJson, withParams } from '@/lib/server/http';
import { createRecap, listProjects, listSoundtracks, workerOnline } from '@/lib/server/recap';

export const dynamic = 'force-dynamic';

export const GET = withParams<{ id: string }>(async (req, { id }) => {
  const ctx = await ctxFor(req, id);
  const q = new URL(req.url).searchParams;
  if (q.get('soundtracks') === '1') return { ...listSoundtracks(id, ctx), workerOnline: workerOnline() };
  return { projects: listProjects(id, ctx), workerOnline: workerOnline() };
});

/** Host/co-host: create a recap project. Queues a "plan" job for the media worker (never runs in this request). */
export const POST = withParams<{ id: string }>(async (req, { id }) => {
  const { project, job } = createRecap(id, await ctxFor(req, id), await readJson(req));
  return Response.json({ projectId: project.id, jobId: job.id, workerOnline: workerOnline() }, { status: 202 });
});
