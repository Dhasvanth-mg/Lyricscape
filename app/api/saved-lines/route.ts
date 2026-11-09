// Saved (starred) lyric lines, kept in the song index on this computer.
//   GET    /api/saved-lines            every saved line, newest first
//   POST   /api/saved-lines            save one { key, title, artists, idx, ms, text, art? }
//   DELETE /api/saved-lines?id=<id>    forget one

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { handle, readJson } from '@/lib/server/http';
import { HttpError } from '@/lib/server/security';
import { songIndex } from '@/lib/server/songIndex';
import { savedLineInput } from '@/lib/lyrics/search';

export const dynamic = 'force-dynamic';

const needIndex = () => {
  if (!songIndex.available()) throw new HttpError(503, 'index_unavailable', 'Saved lines need the song index (Node 22.5 or newer).');
};

export const GET = handle(async () => (songIndex.available() ? { available: true, lines: songIndex.savedLines() } : { available: false, lines: [] }));

export const POST = handle(async (req) => {
  needIndex();
  const body = savedLineInput.parse(await readJson(req, 16 * 1024));
  return { line: songIndex.saveLine(body, randomUUID()) };
});

export const DELETE = handle(async (req) => {
  needIndex();
  const id = z.string().uuid().parse(new URL(req.url).searchParams.get('id'));
  return { removed: songIndex.unsaveLine(id) };
});
