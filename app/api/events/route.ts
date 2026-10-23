import { handle, readJson, requireUser } from '@/lib/server/http';
import { createEvent, listEventsForUser, sweepAbandonedUploads, sweepExpiredEvents, createInvite } from '@/lib/server/party';

export const dynamic = 'force-dynamic';

export const GET = handle(async () => {
  const user = await requireUser();
  sweepAbandonedUploads();
  sweepExpiredEvents();
  return {
    events: listEventsForUser(user.id).map((e) => ({
      id: e.id,
      slug: e.slug,
      title: e.title,
      status: e.status,
      role: e.role,
      startsAt: e.startsAt,
      place: e.place,
      createdAt: e.createdAt,
    })),
  };
});

export const POST = handle(async (req) => {
  const user = await requireUser();
  const event = createEvent(user, await readJson(req));
  // every new party gets a first share link right away
  const { token } = createInvite(event.id, { userId: user.id }, { label: 'first link' });
  return Response.json({ event: { id: event.id, slug: event.slug, title: event.title }, inviteToken: token }, { status: 201 });
});
