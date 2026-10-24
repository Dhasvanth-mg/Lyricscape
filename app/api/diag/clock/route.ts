// Diagnostics only (used by lyricscapeSync.probeClock(), see lib/player/syncDiag.ts).
// A browser cannot read the `Date` header of a cross-origin response, so it cannot see how far this PC's clock is from
// Spotify's. This route asks Spotify's public API host for it server-side and returns just that header and the local time.
// No account, token or user data is involved: it is an unauthenticated HEAD request to a public URL.

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const t0 = performance.now();
  try {
    const res = await fetch('https://api.spotify.com/v1/', { method: 'HEAD', cache: 'no-store', signal: AbortSignal.timeout(4000) });
    return NextResponse.json({ spotifyDate: res.headers.get('date'), serverNowMs: Date.now(), upstreamRttMs: performance.now() - t0 });
  } catch {
    return NextResponse.json({ spotifyDate: null, serverNowMs: Date.now(), upstreamRttMs: 0 }, { status: 502 });
  }
}
