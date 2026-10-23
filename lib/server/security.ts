import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { secret } from './config';

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------
export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public retryAfter?: number,
  ) {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------
export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

/** >= 128 bits of entropy, URL-safe. */
export const randomToken = (bytes = 24) => randomBytes(bytes).toString('base64url');

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');

/** Compact signed token: base64url(payload).base64url(hmac). Payload always carries `exp` (ms epoch). */
export function signToken(payload: Record<string, unknown>, ttlMs: number, now = Date.now()): string {
  const body = b64({ ...payload, exp: now + ttlMs });
  const sig = createHmac('sha256', secret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyToken<T extends Record<string, unknown>>(token: string | undefined | null, now = Date.now()): (T & { exp: number }) | null {
  if (!token || token.length > 2048) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = createHmac('sha256', secret()).update(body).digest('base64url');
  if (!safeEqual(sig, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as T & { exp: number };
    if (typeof payload.exp !== 'number' || payload.exp < now) return null;
    return payload;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Rate limiting (in-memory sliding window; swap for Upstash when deployed)
// ---------------------------------------------------------------------------
const buckets = new Map<string, number[]>();

export function rateLimit(key: string, max: number, windowMs: number, now = Date.now()): void {
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= max) {
    const retryAfter = Math.ceil((windowMs - (now - hits[0]!)) / 1000);
    buckets.set(key, hits);
    throw new HttpError(429, 'rate_limited', 'Too many requests. Slow down a little.', retryAfter);
  }
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 5000) for (const [k, v] of buckets) if (!v.some((t) => now - t < windowMs)) buckets.delete(k);
}

export const resetRateLimits = () => buckets.clear();

// ---------------------------------------------------------------------------
// Upload validation: never trust the client-declared MIME type
// ---------------------------------------------------------------------------
export type SniffedKind = { mime: string; kind: 'image' | 'video' | 'audio'; ext: string };

export function sniffMedia(head: Uint8Array): SniffedKind | null {
  const b = head;
  const ascii = (from: number, len: number) => String.fromCharCode(...b.slice(from, from + len));
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: 'image/jpeg', kind: 'image', ext: 'jpg' };
  if (b.length >= 8 && b[0] === 0x89 && ascii(1, 3) === 'PNG') return { mime: 'image/png', kind: 'image', ext: 'png' };
  if (b.length >= 6 && (ascii(0, 6) === 'GIF87a' || ascii(0, 6) === 'GIF89a')) return { mime: 'image/gif', kind: 'image', ext: 'gif' };
  if (b.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') return { mime: 'image/webp', kind: 'image', ext: 'webp' };
  if (b.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WAVE') return { mime: 'audio/wav', kind: 'audio', ext: 'wav' };
  if (b.length >= 3 && ascii(0, 3) === 'ID3') return { mime: 'audio/mpeg', kind: 'audio', ext: 'mp3' };
  if (b.length >= 2 && b[0] === 0xff && (b[1]! & 0xe0) === 0xe0 && (b[1]! & 0x06) !== 0) return { mime: 'audio/mpeg', kind: 'audio', ext: 'mp3' };
  if (b.length >= 4 && ascii(0, 4) === 'OggS') return { mime: 'audio/ogg', kind: 'audio', ext: 'ogg' };
  if (b.length >= 4 && ascii(0, 4) === 'fLaC') return { mime: 'audio/flac', kind: 'audio', ext: 'flac' };
  if (b.length >= 12 && ascii(4, 4) === 'ftyp') {
    const brand = ascii(8, 4);
    if (brand === 'M4A ' || brand === 'M4B ') return { mime: 'audio/mp4', kind: 'audio', ext: 'm4a' };
    if (/^(heic|heix|hevc|mif1|msf1)/.test(brand)) return { mime: 'image/heic', kind: 'image', ext: 'heic' };
    if (/^(avif)/.test(brand)) return { mime: 'image/avif', kind: 'image', ext: 'avif' };
    if (brand === 'qt  ') return { mime: 'video/quicktime', kind: 'video', ext: 'mov' };
    return { mime: 'video/mp4', kind: 'video', ext: 'mp4' };
  }
  if (b.length >= 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return { mime: 'video/webm', kind: 'video', ext: 'webm' };
  return null;
}

// ---------------------------------------------------------------------------
// Input hygiene
// ---------------------------------------------------------------------------
/** Collapse whitespace, strip control + bidi-override characters. */
export function cleanText(s: string, max = 120): string {
  return s
    .replace(/[\u0000-\u001f\u007f‪-‮⁦-⁩]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

export function slugify(s: string): string {
  const base = s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return base || 'party';
}
