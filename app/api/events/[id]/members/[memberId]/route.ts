import { z } from 'zod';
import { ctxFor, readJson, withParams } from '@/lib/server/http';
import { banMember, setMemberRole } from '@/lib/server/party';

export const dynamic = 'force-dynamic';

export const PATCH = withParams<{ id: string; memberId: string }>(async (req, { id, memberId }) => {
  const { role } = z.object({ role: z.enum(['cohost', 'member', 'guest']) }).parse(await readJson(req));
  setMemberRole(id, await ctxFor(req, id), memberId, role);
  return { ok: true };
});

/** Remove + block a member; their pending content is pulled from view. */
export const DELETE = withParams<{ id: string; memberId: string }>(async (req, { id, memberId }) => {
  banMember(id, await ctxFor(req, id), memberId);
  return { ok: true };
});
