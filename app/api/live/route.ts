import { handle, readJson } from '@/lib/server/http';
import { applyLive, liveReaders, liveState } from '@/lib/server/live';
import { livePost } from '@/lib/live/types';

export const dynamic = 'force-dynamic';

/** The current "now playing" (lyrics and clock) for overlays that cannot hold an SSE stream. */
export const GET = handle(async () => ({ ...liveState(), readers: liveReaders() }));

/** The playing tab publishes here (same origin only: `handle` rejects cross-site writes). */
export const POST = handle(async (req) => {
  const s = applyLive(livePost.parse(await readJson(req, 2 * 1024 * 1024)));
  return { ok: true, seq: s.seq, readers: liveReaders() };
});
