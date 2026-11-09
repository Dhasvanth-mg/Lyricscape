// Album covers from Spotify's image servers, served from this app's own address. A cover the browser loads from another
// site without CORS "taints" the canvas, and then neither the GPU stage (Turbo) nor the colour picker may read it, so Turbo
// drew without its cover. Same-origin copies are always readable. Only Spotify's image hosts, only images, small, cached.

import { z } from 'zod';

export const dynamic = 'force-dynamic';

const ALLOWED = /^(?:i\.scdn\.co|mosaic\.scdn\.co|image-cdn-[a-z0-9-]+\.spotifycdn\.com|[a-z0-9-]+\.spotifycdn\.com)$/i;
const MAX_BYTES = 4 * 1024 * 1024;
const query = z.object({ u: z.string().url().max(500) });
const cache = new Map<string, { at: number; type: string; body: ArrayBuffer }>();

export function allowedArt(u: string): URL | null {
  try {
    const url = new URL(u);
    return url.protocol === 'https:' && ALLOWED.test(url.hostname) && !url.username && !url.port ? url : null;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const parsed = query.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  const url = parsed.success ? allowedArt(parsed.data.u) : null;
  if (!url) return new Response('not an allowed cover address', { status: 400 });
  const key = url.toString();
  let hit = cache.get(key);
  if (!hit) {
    let res: Response;
    try {
      res = await fetch(key, { redirect: 'error', signal: AbortSignal.timeout(10_000) });
    } catch {
      return new Response('cover unavailable', { status: 502 });
    }
    const type = res.headers.get('content-type') ?? '';
    if (!res.ok || !/^image\/(jpeg|png|webp|gif|avif)$/.test(type.split(';')[0]!.trim())) return new Response('cover unavailable', { status: 502 });
    const body = await res.arrayBuffer();
    if (body.byteLength > MAX_BYTES) return new Response('cover too large', { status: 502 });
    hit = { at: Date.now(), type, body };
    if (cache.size > 300) cache.delete(cache.keys().next().value as string);
    cache.set(key, hit);
  }
  return new Response(hit.body, { headers: { 'Content-Type': hit.type, 'Cache-Control': 'private, max-age=86400', 'X-Content-Type-Options': 'nosniff' } });
}
