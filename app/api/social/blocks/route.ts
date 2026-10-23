import { z } from 'zod';
import { handle, readJson, requireUser } from '@/lib/server/http';
import { blockUser, unblockUser } from '@/lib/server/social';

export const dynamic = 'force-dynamic';

const body = z.object({ handle: z.string().min(1).max(30) });

export const POST = handle(async (req) => {
  blockUser(await requireUser(), body.parse(await readJson(req)).handle);
  return { ok: true };
});

export const DELETE = handle(async (req) => {
  unblockUser(await requireUser(), body.parse(await readJson(req)).handle);
  return { ok: true };
});
