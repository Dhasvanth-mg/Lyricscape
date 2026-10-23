import { z } from 'zod';
import { handle, readJson, requireUser } from '@/lib/server/http';
import { listFriends, sendFriendRequest } from '@/lib/server/social';

export const dynamic = 'force-dynamic';

export const GET = handle(async () => listFriends(await requireUser()));

export const POST = handle(async (req) => {
  const { handle: h } = z.object({ handle: z.string().min(1).max(30) }).parse(await readJson(req));
  const f = sendFriendRequest(await requireUser(), h);
  return Response.json({ status: f.status }, { status: 201 });
});
