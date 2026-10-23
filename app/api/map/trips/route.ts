import { handle, readJson, requireUser } from '@/lib/server/http';
import { createTrip, listTrips } from '@/lib/server/map';

export const dynamic = 'force-dynamic';

export const GET = handle(async () => ({ trips: listTrips((await requireUser()).id) }));

export const POST = handle(async (req) => {
  const t = createTrip(await requireUser(), await readJson(req));
  return Response.json({ id: t.id }, { status: 201 });
});
