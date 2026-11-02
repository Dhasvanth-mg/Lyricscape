// The song index: summary and clearing. See lib/server/songIndex.ts.

import { handle } from '@/lib/server/http';
import { HttpError } from '@/lib/server/security';
import { songIndex } from '@/lib/server/songIndex';

export const dynamic = 'force-dynamic';

export const GET = handle(async () => songIndex.stats());

/** Forget everything. Needs ?all=1 so a stray request cannot do it. */
export const DELETE = handle(async (req) => {
  if (new URL(req.url).searchParams.get('all') !== '1') throw new HttpError(400, 'confirm_required', 'Add ?all=1 to clear the whole index');
  return { cleared: songIndex.clear() };
});
