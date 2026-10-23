import { clientIp, withParams } from '@/lib/server/http';
import { previewInvite } from '@/lib/server/party';
import { rateLimit } from '@/lib/server/security';

export const dynamic = 'force-dynamic';

/** Public, minimal preview shown on the join page before a guest commits. */
export const GET = withParams<{ token: string }>(async (req, { token }) => {
  rateLimit(`preview:${clientIp(req)}`, 60, 60_000);
  return previewInvite(token);
});
