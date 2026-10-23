import { z } from 'zod';
import { clearSession, currentUser, handle, readJson, setSession } from '@/lib/server/http';
import { loginLocalUser } from '@/lib/server/party';
import { rateLimit } from '@/lib/server/security';
import { clientIp } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

// Local profile "login": no password, single-machine trust model (documented in docs/architecture.md).
// Swap for Supabase Auth when deploying; everything downstream only needs a user id.
const body = z.object({ handle: z.string().min(3).max(24), displayName: z.string().max(40).optional() });

const dto = (u: { id: string; handle: string; displayName: string }) => ({ id: u.id, handle: u.handle, displayName: u.displayName });

export const GET = handle(async () => {
  const u = await currentUser();
  return { user: u ? dto(u) : null };
});

export const POST = handle(async (req) => {
  rateLimit(`login:${clientIp(req)}`, 20, 60_000);
  const { handle: h, displayName } = body.parse(await readJson(req));
  const user = loginLocalUser(h, displayName ?? h);
  await setSession(user);
  return { user: dto(user) };
});

export const DELETE = handle(async () => {
  await clearSession();
  return { ok: true };
});
