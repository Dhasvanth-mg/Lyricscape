import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';

// Local-first server configuration. Nothing here talks to a cloud service.

export function dataDir(): string {
  const dir = path.resolve(process.cwd(), process.env.LYRICSCAPE_DATA_DIR || '.data');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

let cachedSecret: string | null = null;

/** Signing secret for cookies, guest tokens and upload URLs. Generated once into .data/secret.key. */
export function secret(): string {
  if (cachedSecret) return cachedSecret;
  if (process.env.LYRICSCAPE_SECRET) return (cachedSecret = process.env.LYRICSCAPE_SECRET);
  const file = path.join(dataDir(), 'secret.key');
  if (existsSync(file)) return (cachedSecret = readFileSync(file, 'utf8').trim());
  const s = randomBytes(48).toString('base64url');
  writeFileSync(file, s, { mode: 0o600 });
  return (cachedSecret = s);
}

export const limits = {
  get maxUploadBytes() {
    const mb = Number(process.env.MAX_UPLOAD_MB ?? 250);
    return (Number.isFinite(mb) && mb > 0 ? mb : 250) * 1024 * 1024;
  },
  maxFilesPerEvent: 600,
  maxBytesPerEvent: 4 * 1024 * 1024 * 1024,
  maxUploadsPerGuestPerEvent: 60,
  maxSongRequestsPerMember: 8,
  uploadUrlTtlMs: 10 * 60 * 1000,
  mediaUrlTtlMs: 5 * 60 * 1000,
  displayTokenTtlMs: 12 * 60 * 60 * 1000,
  guestTokenTtlMs: 14 * 24 * 60 * 60 * 1000,
};

export const features = {
  recapExport: process.env.ENABLE_PARTY_RECAP_EXPORT !== 'false',
  locationHistory: process.env.ENABLE_LOCATION_HISTORY !== 'false',
};
