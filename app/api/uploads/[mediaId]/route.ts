import { handle, withParams } from '@/lib/server/http';
import { authorizeUpload, recordUploadBytes } from '@/lib/server/party';
import { putObject } from '@/lib/server/storage';
import { HttpError } from '@/lib/server/security';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Receives the bytes for a signed upload intent (the local stand-in for a presigned R2 PUT).
 * Authorized solely by the short-lived signed token in the query string.
 */
export const PUT = withParams<{ mediaId: string }>(async (req, { mediaId }) => {
  const token = new URL(req.url).searchParams.get('t');
  const { media, maxBytes } = authorizeUpload(mediaId, token);
  const declared = Number(req.headers.get('content-length') ?? '0');
  if (declared && declared > maxBytes) throw new HttpError(413, 'too_large', 'Upload exceeds the size you declared');
  const written = await putObject(media.objectKey, req.body, maxBytes);
  recordUploadBytes(media.id, written);
  return { ok: true, bytes: written };
});

export const OPTIONS = handle(async () => new Response(null, { status: 204 }));
