// Tempo lookup by title and artist (see lib/server/tempoLookup.ts). Returns { found: false } when the song has no tempo online.

import { z } from 'zod';
import { handle } from '@/lib/server/http';
import { lookupTempo } from '@/lib/server/tempoLookup';

export const dynamic = 'force-dynamic';

const query = z.object({
  title: z.string().trim().min(1).max(200),
  artist: z.string().trim().min(1).max(200),
  duration: z.coerce.number().min(1).max(7200).optional(), // seconds
});

export const GET = handle(async (req) => {
  const q = query.parse(Object.fromEntries(new URL(req.url).searchParams));
  const r = await lookupTempo(q.title, q.artist, q.duration ?? null);
  return r ? { found: true, ...r } : { found: false };
});
