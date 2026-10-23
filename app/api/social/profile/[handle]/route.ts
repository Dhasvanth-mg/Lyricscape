import { currentUser, withParams } from '@/lib/server/http';
import { profile } from '@/lib/server/social';

export const dynamic = 'force-dynamic';

export const GET = withParams<{ handle: string }>(async (_req, { handle }) => profile(await currentUser(), handle));
