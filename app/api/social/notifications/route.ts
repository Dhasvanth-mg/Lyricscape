import { handle, requireUser } from '@/lib/server/http';
import { listNotifications, markNotificationsSeen } from '@/lib/server/social';

export const dynamic = 'force-dynamic';

export const GET = handle(async () => listNotifications(await requireUser()));

/** Mark everything as seen. */
export const POST = handle(async () => {
  markNotificationsSeen(await requireUser());
  return { ok: true };
});
