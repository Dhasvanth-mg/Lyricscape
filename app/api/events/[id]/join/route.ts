import { clientIp, currentUser, readJson, setGuestCookie, withParams } from '@/lib/server/http';
import { findEvent, joinByToken } from '@/lib/server/party';
import { HttpError } from '@/lib/server/security';

export const dynamic = 'force-dynamic';

/** Join with a valid invite token. `id` is only a hint: the token alone decides which party it opens. */
export const POST = withParams<{ id: string }>(async (req, { id }) => {
  const user = await currentUser();
  const body = await readJson<Record<string, unknown>>(req);
  const result = joinByToken({ userId: user?.id, ip: clientIp(req) }, body);
  const hinted = id !== '_' ? findEvent(id) : undefined;
  if (hinted && hinted.id !== result.event.id) throw new HttpError(404, 'invalid_invite', 'This invite link is not valid for that party');
  if (result.guestToken) await setGuestCookie(result.event.id, result.guestToken);
  return { slug: result.event.slug, role: result.member.role, created: result.created, displayName: result.member.displayName };
});
