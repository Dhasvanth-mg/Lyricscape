'use client';

// Local file ingestion: tags (music-metadata), SHA-256, embedded cover, duration.
// Original bytes are kept untouched in IndexedDB; analysis proxies are derived separately.

import type { Track } from '../types';
import { getLocalTrack, putLocalTrack, type StoredLocalTrack } from './db';
import { saveUserLyrics } from '../lyrics/service';

export const MAX_IMPORT_BYTES = 300 * 1024 * 1024;
const AUDIO_EXT = /\.(mp3|flac|wav|m4a|aac|ogg|oga|opus|weba|webm)$/i;
const LYRIC_EXT = /\.(lrc|vtt|txt|json)$/i;

export type ImportResult = { fileName: string; status: 'added' | 'duplicate' | 'skipped' | 'error'; message?: string; track?: Track };

async function sha256Hex(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function coverToDataUrl(data: Uint8Array, mime: string): Promise<string | undefined> {
  try {
    const bytes = new Uint8Array(data);
    const bmp = await createImageBitmap(new Blob([bytes], { type: mime }));
    const side = Math.min(512, Math.max(bmp.width, bmp.height));
    const scale = side / Math.max(bmp.width, bmp.height);
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.85);
  } catch {
    return undefined;
  }
}

function durationFromElement(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const a = new Audio();
    a.preload = 'metadata';
    const done = (ms: number) => {
      URL.revokeObjectURL(url);
      resolve(ms);
    };
    a.onloadedmetadata = () => done(Number.isFinite(a.duration) ? Math.round(a.duration * 1000) : 0);
    a.onerror = () => done(0);
    a.src = url;
  });
}

const baseName = (n: string) => n.replace(/\.[^.]+$/, '').toLowerCase();

export async function importFiles(files: File[]): Promise<ImportResult[]> {
  const { parseBlob } = await import('music-metadata');
  const audio = files.filter((f) => AUDIO_EXT.test(f.name) || f.type.startsWith('audio/'));
  const sidecars = new Map(files.filter((f) => LYRIC_EXT.test(f.name)).map((f) => [baseName(f.name), f]));
  const results: ImportResult[] = [];

  for (const file of files) {
    if (!audio.includes(file) && !LYRIC_EXT.test(file.name)) results.push({ fileName: file.name, status: 'skipped', message: 'Not an audio or lyrics file' });
  }

  for (const file of audio) {
    try {
      if (file.size > MAX_IMPORT_BYTES) {
        results.push({ fileName: file.name, status: 'skipped', message: `Larger than ${Math.round(MAX_IMPORT_BYTES / 1048576)} MB` });
        continue;
      }
      if (file.size < 1024) {
        results.push({ fileName: file.name, status: 'error', message: 'File is empty or truncated' });
        continue;
      }
      const sha = await sha256Hex(file);
      const id = `licensed:${sha.slice(0, 20)}`;
      if (await getLocalTrack(id)) {
        results.push({ fileName: file.name, status: 'duplicate', message: 'Already in your library' });
        continue;
      }

      let title = file.name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ');
      let artists = ['Unknown artist'];
      let album: string | undefined;
      let durationMs = 0;
      let artworkUrl: string | undefined;
      try {
        const meta = await parseBlob(file, { duration: true, skipPostHeaders: true });
        if (meta.common.title) title = meta.common.title;
        const names = meta.common.artists?.length ? meta.common.artists : meta.common.artist ? [meta.common.artist] : [];
        if (names.length) artists = names;
        album = meta.common.album;
        if (meta.format.duration) durationMs = Math.round(meta.format.duration * 1000);
        const pic = meta.common.picture?.[0];
        if (pic) artworkUrl = await coverToDataUrl(pic.data, pic.format);
      } catch {
        /* malformed tags: fall back to the filename */
      }
      if (!durationMs) durationMs = await durationFromElement(file);
      if (!durationMs) {
        results.push({ fileName: file.name, status: 'error', message: 'Could not read audio duration (unsupported or corrupt file)' });
        continue;
      }

      const track: Track = {
        id,
        provider: 'licensed',
        providerTrackId: sha.slice(0, 20),
        title,
        artists,
        album,
        artworkUrl,
        durationMs,
        audioUrl: `idb:${id}`,
        license: 'user-imported (rights held by the user)',
      };
      const stored: StoredLocalTrack = { id, track, blob: file, sha256: sha, addedAt: Date.now(), fileName: file.name, size: file.size };
      await putLocalTrack(stored);

      const sidecar = sidecars.get(baseName(file.name));
      if (sidecar) {
        try {
          await saveUserLyrics(track, await sidecar.text(), 'user-supplied (file)');
        } catch {
          /* ignore bad sidecar */
        }
      }
      results.push({ fileName: file.name, status: 'added', track });
    } catch (e) {
      results.push({ fileName: file.name, status: 'error', message: (e as Error).message || 'Import failed' });
    }
  }
  return results;
}
