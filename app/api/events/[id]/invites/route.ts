import { z } from 'zod';
import { ctxFor, readJson, withParams } from '@/lib/server/http';
import { createInvite, listInvites, revokeInvite, rotateInvites } from '@/lib/server/party';

export const dynamic = 'force-dynamic';

export const GET = withParams<{ id: string }>(async (req, { id }) => ({ invites: listInvites(id, await ctxFor(req, id)) }));

/** The plaintext token is returned exactly once; only its hash is stored. */
export const POST = withParams<{ id: string }>(async (req, { id }) => {
  const ctx = await ctxFor(req, id);
  const body = (await readJson<Record<string, unknown>>(req)) ?? {};
  if (body.rotate === true) {
    const { token, invite } = rotateInvites(id, ctx);
    return { token, invite: { id: invite.id, expiresAt: invite.expiresAt } };
  }
  const { token, invite } = createInvite(id, ctx, body);
  return { token, invite: { id: invite.id, expiresAt: invite.expiresAt, label: invite.label, maxUses: invite.maxUses } };
});

export const DELETE = withParams<{ id: string }>(async (req, { id }) => {
  const inviteId = z.string().min(1).max(64).parse(new URL(req.url).searchParams.get('inviteId'));
  revokeInvite(id, await ctxFor(req, id), inviteId);
  return { ok: true };
});
