import { Readable } from 'node:stream';
import { withParams } from '@/lib/server/http';
import { authorizeMediaRead } from '@/lib/server/party';
import { objectSize, streamObject } from '@/lib/server/storage';
import { HttpError } from '@/lib/server/security';

export const dynamic = 'force-dynamic';

/** Serves a private object via a signed, short-lived URL. Supports Range so videos can seek. */
export const GET = withParams<{ mediaId: string }>(async (req, { mediaId }) => {
  const m = authorizeMediaRead(mediaId, new URL(req.url).searchParams.get('t'));
  const size = objectSize(m.objectKey);
  if (size === null) throw new HttpError(404, 'not_found', 'File missing');

  const headers: Record<string, string> = {
    'Content-Type': m.mime,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, max-age=240',
    'X-Content-Type-Options': 'nosniff',
    'Content-Disposition': 'inline',
    'Content-Security-Policy': "default-src 'none'; sandbox",
  };
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get('range') ?? '');
  if (range) {
    let start = range[1] ? Number(range[1]) : NaN;
    let end = range[2] ? Number(range[2]) : NaN;
    if (Number.isNaN(start)) {
      start = Math.max(0, size - (Number.isNaN(end) ? 0 : end));
      end = size - 1;
    } else if (Number.isNaN(end) || end >= size) end = size - 1;
    if (start > end || start >= size) {
      return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
    }
    const stream = Readable.toWeb(streamObject(m.objectKey, { start, end })) as unknown as ReadableStream;
    return new Response(stream, { status: 206, headers: { ...headers, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(end - start + 1) } });
  }
  const stream = Readable.toWeb(streamObject(m.objectKey)) as unknown as ReadableStream;
  return new Response(stream, { headers: { ...headers, 'Content-Length': String(size) } });
});
