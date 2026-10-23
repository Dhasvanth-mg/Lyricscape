import { z } from 'zod';
import { ctxFor, readJson, withParams } from '@/lib/server/http';
import { findEvent } from '@/lib/server/party';
import { R, regenerateSection } from '@/lib/server/recap';
import { HttpError } from '@/lib/server/security';

export const dynamic = 'force-dynamic';

export const POST = withParams<{ id: string }>(async (req, { id }) => {
  const p = R.projects().get(id);
  if (!p) throw new HttpError(404, 'not_found', 'Recap not found');
  const body = z.object({ fromMs: z.number().int().min(0), toMs: z.number().int().min(1), seed: z.number().int().optional() }).parse(await readJson(req));
  const r = regenerateSection(id, await ctxFor(req, findEvent(p.eventId)!.id), body);
  return { version: r.version };
});
