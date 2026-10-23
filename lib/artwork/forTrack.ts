import type { Track } from '../types';
import { coverDataUrl } from './generate';

const cache = new Map<string, string>();

/** The cover to show for a track: its own artwork, or an original generated one (stable per track id). */
export function artworkFor(track: Pick<Track, 'id' | 'artworkUrl' | 'palette'>): string {
  if (track.artworkUrl) return track.artworkUrl;
  const hit = cache.get(track.id);
  if (hit) return hit;
  const url = coverDataUrl({ seed: track.id, palette: track.palette });
  if (cache.size > 200) cache.delete(cache.keys().next().value as string);
  cache.set(track.id, url);
  return url;
}
