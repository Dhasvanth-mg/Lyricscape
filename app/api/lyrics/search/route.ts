// Search the lyrics the song index holds (songs you have played with lyrics). GET /api/lyrics/search?q=&limit=

import { z } from 'zod';
import { handle } from '@/lib/server/http';
import { songIndex } from '@/lib/server/songIndex';

export const dynamic = 'force-dynamic';

const query = z.object({ q: z.string().max(200).default(''), limit: z.coerce.number().int().min(1).max(200).default(60) });

export const GET = handle(async (req) => {
  const { q, limit } = query.parse(Object.fromEntries(new URL(req.url).searchParams));
  if (!songIndex.available()) return { available: false, hits: [] };
  return { available: true, hits: songIndex.search(q, limit) };
});
