import { createReadStream, createWriteStream, existsSync, mkdirSync, rmSync, statSync, openSync, readSync, closeSync } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import { dataDir } from './config';
import { HttpError } from './security';

// Local object storage standing in for private Cloudflare R2:
//  - objects live under .data/uploads/<eventId>/<mediaId>.<ext> and are never served statically
//  - access is only through signed, short-lived URLs minted by authorized API calls
//  - the database stores object *keys*, never public URLs

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const EXT = /^[a-z0-9]{2,5}$/;

export function objectKey(eventId: string, mediaId: string, ext: string): string {
  if (!UUID.test(eventId) || !UUID.test(mediaId) || !EXT.test(ext)) throw new HttpError(400, 'bad_key', 'Invalid object key');
  return `${eventId}/${mediaId}.${ext}`;
}

/** Resolve a key to an absolute path, refusing anything that escapes the uploads root. */
export function objectPath(key: string): string {
  const root = path.join(dataDir(), 'uploads');
  const full = path.resolve(root, key);
  if (!full.startsWith(root + path.sep)) throw new HttpError(400, 'bad_key', 'Invalid object key');
  return full;
}

export function putObject(key: string, body: ReadableStream<Uint8Array> | null, maxBytes: number): Promise<number> {
  if (!body) throw new HttpError(400, 'empty_body', 'No data received');
  const file = objectPath(key);
  mkdirSync(path.dirname(file), { recursive: true });
  let written = 0;
  const node = Readable.fromWeb(body as unknown as import('node:stream/web').ReadableStream);
  const limited = new Readable({ read() {} });
  node.on('data', (chunk: Buffer) => {
    written += chunk.length;
    if (written > maxBytes) {
      node.destroy(new HttpError(413, 'too_large', 'Upload exceeds the size you declared'));
      return;
    }
    limited.push(chunk);
  });
  node.on('end', () => limited.push(null));
  node.on('error', (e) => limited.destroy(e));
  return pipeline(limited, createWriteStream(file)).then(
    () => written,
    (e) => {
      rmSync(file, { force: true });
      throw e instanceof HttpError ? e : new HttpError(400, 'upload_failed', 'Upload was interrupted');
    },
  );
}

export function objectSize(key: string): number | null {
  try {
    return statSync(objectPath(key)).size;
  } catch {
    return null;
  }
}

export function readHead(key: string, bytes = 32): Uint8Array {
  const fd = openSync(objectPath(key), 'r');
  try {
    const buf = Buffer.alloc(bytes);
    const n = readSync(fd, buf, 0, bytes, 0);
    return buf.subarray(0, n);
  } finally {
    closeSync(fd);
  }
}

export function streamObject(key: string, range?: { start: number; end: number }) {
  return createReadStream(objectPath(key), range);
}

export function objectExists(key: string): boolean {
  return existsSync(objectPath(key));
}

export function deleteObject(key: string) {
  rmSync(objectPath(key), { force: true });
}

export function deleteEventObjects(eventId: string) {
  if (!UUID.test(eventId)) return;
  rmSync(path.join(dataDir(), 'uploads', eventId), { recursive: true, force: true });
}
