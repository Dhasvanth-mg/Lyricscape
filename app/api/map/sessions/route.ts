import { handle, readJson, requireUser } from '@/lib/server/http';
import { deleteAllMapHistory, listSessions, recordSession } from '@/lib/server/map';
import { features } from '@/lib/server/config';
import { HttpError } from '@/lib/server/security';

export const dynamic = 'force-dynamic';

export const GET = handle(async (req) => {
  const u = await requireUser();
  const q = new URL(req.url).searchParams;
  return { sessions: listSessions(u.id, { from: q.get('from') ?? undefined, to: q.get('to') ?? undefined, limit: Number(q.get('limit') ?? 1000) }) };
});

export const POST = handle(async (req) => {
  if (!features.locationHistory) throw new HttpError(404, 'disabled', 'Location history is disabled (ENABLE_LOCATION_HISTORY=false).');
  const u = await requireUser();
  const r = recordSession(u, await readJson(req));
  return Response.json({ id: r.session?.id ?? null, skipped: r.skipped ?? null, place: r.place ? { id: r.place.id, lat: r.place.approxLat, lng: r.place.approxLng, precisionM: r.place.precisionM } : null }, { status: r.session ? 201 : 200 });
});

/** Delete the entire listening map (spots, places, memories, trips). Settings stay. */
export const DELETE = handle(async (req) => {
  const u = await requireUser();
  const confirm = new URL(req.url).searchParams.get('confirm');
  if (confirm !== 'all') throw new HttpError(400, 'confirm_required', 'Add ?confirm=all to delete the whole history');
  deleteAllMapHistory(u.id);
  return { ok: true };
});
