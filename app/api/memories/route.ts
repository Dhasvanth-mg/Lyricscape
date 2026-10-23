import { handle, readJson, requireUser } from '@/lib/server/http';
import { createMemory, listMemories } from '@/lib/server/map';

export const dynamic = 'force-dynamic';

export const GET = handle(async () => ({ memories: listMemories((await requireUser()).id) }));

export const POST = handle(async (req) => {
  const u = await requireUser();
  const m = createMemory(u, await readJson(req, 400 * 1024));
  return Response.json({ id: m.id }, { status: 201 });
});
