import { z } from 'zod';
import { mapTrack, spFetch } from './api';
import type { Track } from '../types';

const image = z.object({ url: z.string(), width: z.number().nullable().optional(), height: z.number().nullable().optional() });
const artist = z.object({ name: z.string(), id: z.string().nullable().optional() });
const album = z.object({ id: z.string(), name: z.string(), images: z.array(image).optional(), artists: z.array(artist).optional() });
const track = z.object({ id: z.string().nullable(), name: z.string(), duration_ms: z.number(), artists: z.array(artist),
  album: z.object({ name: z.string(), images: z.array(image).optional() }).optional(), is_local: z.boolean().optional(), type: z.string().optional(),
  external_urls: z.object({ spotify: z.string().optional() }).optional(),
});
const playlist = z.object({ id: z.string(), name: z.string(), uri: z.string(), images: z.array(image).nullable().optional() });
const musicItem = z.unknown().transform(value => {
  const parsed = track.safeParse(value);
  return parsed.success ? parsed.data : null;
});
const page = <T extends z.ZodType>(item: T) => z.object({ items: z.array(item), next: z.string().nullable(), offset: z.number(), limit: z.number(), total: z.number() });
export type SpotifyCollection = { id: string; name: string; uri: string; kind: 'playlist' | 'album' };
export type LibraryPage<T> = { items: T[]; nextOffset: number | null; total: number };
function mapped<A, B>(data: { items: A[]; next: string | null; offset: number; limit: number; total: number }, map: (a: A) => B | null): LibraryPage<B> {
  return { items: data.items.map(map).filter((x): x is B => x !== null), nextOffset: data.next ? data.offset + data.limit : null, total: data.total };
}
export async function getPlaylists(offset = 0): Promise<LibraryPage<SpotifyCollection>> {
  const data = page(playlist).parse(await spFetch('/me/playlists', { query: { limit: 50, offset } }));
  return mapped(data, p => ({ id: p.id, name: p.name, uri: p.uri, kind: 'playlist' }));
}
export async function getSavedAlbums(offset = 0): Promise<LibraryPage<SpotifyCollection>> {
  const data = page(z.object({ album })).parse(await spFetch('/me/albums', { query: { limit: 50, offset } }));
  return mapped(data, p => ({ id: p.album.id, name: p.album.name, uri: `spotify:album:${p.album.id}`, kind: 'album' }));
}
export async function getSavedTracks(offset = 0): Promise<LibraryPage<Track>> {
  const data = page(z.object({ track: musicItem })).parse(await spFetch('/me/tracks', { query: { limit: 50, offset } }));
  return mapped(data, p => p.track ? mapTrack(p.track) : null);
}
export async function getCollectionTracks(collection: SpotifyCollection, offset = 0): Promise<LibraryPage<Track>> {
  const id = encodeURIComponent(collection.id);
  if (collection.kind === 'album') {
    const data = page(track).parse(await spFetch(`/albums/${id}/tracks`, { query: { limit: 50, offset } }));
    return mapped(data, t => mapTrack({ ...t, album: { name: collection.name } }));
  }
  const data = page(z.object({ item: musicItem.optional(), track: musicItem.optional() }).nullable()).parse(
    await spFetch(`/playlists/${id}/items`, { query: { limit: 50, offset } }),
  );
  return mapped(data, p => { const t = p?.item ?? p?.track; return t ? mapTrack(t) : null; });
}

/** A local library mix: unique songs, with different lead artists adjacent where possible. */
export function libraryMix(tracks: Track[], random: () => number = Math.random): Track[] {
  const rest = [...new Map(tracks.map(t => [t.id, t])).values()];
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [rest[i], rest[j]] = [rest[j]!, rest[i]!];
  }
  const result: Track[] = [];
  while (rest.length) {
    const last = result.at(-1)?.artists[0]?.toLowerCase();
    const next = rest.findIndex(t => t.artists[0]?.toLowerCase() !== last);
    result.push(rest.splice(Math.max(0, next), 1)[0]!);
  }
  return result;
}
