import { Readable } from 'node:stream';
import { withParams } from '@/lib/server/http';
import { authorizeVideo } from '@/lib/server/recap';
import { objectSize, streamObject } from '@/lib/server/storage';
import { HttpError } from '@/lib/server/security';

export const dynamic = 'force-dynamic';

/** Rendered MP4 via a short-lived signed URL (minted only for hosts/co-hosts). Supports Range for seeking. */
export const GET = withParams<{ id: string; jobId: string }>(async (req, { jobId }) => {
  const job = authorizeVideo(jobId, new URL(req.url).searchParams.get('t'));
  const size = objectSize(job.outputKey!);
  if (size === null) throw new HttpError(404, 'not_found', 'The video file is missing');
  const headers: Record<string, string> = {
    'Content-Type': 'video/mp4',
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
    'Content-Disposition': `inline; filename="recap-${job.type}.mp4"`,
  };
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get('range') ?? '');
  if (m) {
    let start = m[1] ? Number(m[1]) : NaN;
    let end = m[2] ? Number(m[2]) : NaN;
    if (Number.isNaN(start)) {
      start = Math.max(0, size - (Number.isNaN(end) ? 0 : end));
      end = size - 1;
    } else if (Number.isNaN(end) || end >= size) end = size - 1;
    if (start > end || start >= size) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
    return new Response(Readable.toWeb(streamObject(job.outputKey!, { start, end })) as unknown as ReadableStream, {
      status: 206,
      headers: { ...headers, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(end - start + 1) },
    });
  }
  return new Response(Readable.toWeb(streamObject(job.outputKey!)) as unknown as ReadableStream, { headers: { ...headers, 'Content-Length': String(size) } });
});
