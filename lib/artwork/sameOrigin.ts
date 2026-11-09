// Spotify covers go through /api/art so the stage can read their pixels (see app/api/art/route.ts). Anything else is unchanged.
const SPOTIFY_IMG = /^https:\/\/(?:i\.scdn\.co|mosaic\.scdn\.co|[a-z0-9-]+\.spotifycdn\.com)\//i;
export const readableArt = (u: string): string => (SPOTIFY_IMG.test(u) ? `/api/art?u=${encodeURIComponent(u)}` : u);
