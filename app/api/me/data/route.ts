import { z } from 'zod';
import { clearSession, handle, readJson, requireUser } from '@/lib/server/http';
import { eraseUserMapData } from '@/lib/server/map';
import { T, deleteEvent } from '@/lib/server/party';
import { eraseUserSocialData } from '@/lib/server/social';

export const dynamic = 'force-dynamic';

/** Erase my account data: map history, memberships, hosted parties (with their uploads), and my profile. */
export const DELETE = handle(async (req) => {
  const u = await requireUser();
  z.object({ confirm: z.literal('DELETE') }).parse(await readJson(req));
  for (const e of T.events().where((e) => e.hostId === u.id)) deleteEvent(e.id, { userId: u.id });
  eraseUserMapData(u.id);
  eraseUserSocialData(u.id);
  T.members().deleteWhere((m) => m.userId === u.id);
  T.users().delete(u.id);
  await clearSession();
  return { ok: true };
});
