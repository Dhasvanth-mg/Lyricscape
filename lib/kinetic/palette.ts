import type { Track } from '../types';
import { hashString, rgbToHex } from './util';

function hsl(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return rgbToHex(f(0) * 255, f(8) * 255, f(4) * 255);
}

/**
 * Palette = [accent1, accent2, accent3, dark]. Uses the track's own palette when known,
 * otherwise a deterministic original palette from the track id (we never read Spotify artwork pixels).
 */
export function paletteForTrack(track: Pick<Track, 'id' | 'palette'>): string[] {
  if (track.palette && track.palette.length >= 4) return track.palette;
  const h = hashString(track.id) % 360;
  return [hsl(h, 88, 60), hsl((h + 42) % 360, 92, 62), hsl((h + 180) % 360, 70, 55), hsl(h, 38, 8)];
}
