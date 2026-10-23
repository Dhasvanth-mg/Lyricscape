import { ctxFor, withParams } from '@/lib/server/http';
import { createDisplayAccess, displaySnapshot } from '@/lib/server/party';

export const dynamic = 'force-dynamic';

/** Host/co-host: mint a read-only display link (+ a QR join invite) for the projector. */
export const POST = withParams<{ id: string }>(async (req, { id }) => createDisplayAccess(id, await ctxFor(req, id)));

/** Big-screen snapshot, authorized only by the signed display token (?d=). Approved content only. */
export const GET = withParams<{ id: string }>(async (req, { id }) => displaySnapshot(id, new URL(req.url).searchParams.get('d')));
