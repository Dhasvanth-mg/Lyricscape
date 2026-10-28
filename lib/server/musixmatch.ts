import { z } from 'zod';
import { normalizeTitle, primaryArtist, type Query } from '../lyrics/match';
import { formatTimestamp } from '../lyrics/parse';

const response = z.object({ message: z.object({
  header: z.object({ status_code: z.number() }), body: z.unknown().optional(),
}) });
const trackBody = z.object({ track: z.object({
  track_name: z.string(), artist_name: z.string(), track_length: z.number().optional(),
}) });
const richBody = z.object({ richsync: z.object({ richsync_body: z.string().max(1_000_000) }) });
const richLines = z.array(z.object({
  ts: z.number().finite().nonnegative(), te: z.number().finite().nonnegative(),
  l: z.array(z.object({ c: z.string(), o: z.number().finite().nonnegative() })).min(1),
})).min(1);
const subtitles = z.object({ subtitle_list: z.array(z.object({ subtitle: z.object({ subtitle_body: z.string().max(1_000_000) }) })) });
const macro = z.object({ macro_calls: z.record(z.string(), response) });

/** Keep real word offsets and explicit line ends instead of flattening richsync to line cues. */
export function richsyncLrc(raw: string): string | null {
  try {
    const lines = richLines.parse(JSON.parse(raw));
    let previous = -1;
    return lines.map((line) => {
      if (line.ts < previous || line.te <= line.ts) throw new Error('Invalid line times');
      previous = line.ts;
      let offset = -1;
      const words = line.l.map((word) => {
        if (word.o < offset || line.ts + word.o >= line.te) throw new Error('Invalid word times');
        offset = word.o;
        return `<${formatTimestamp((line.ts + word.o) * 1000, 3)}>${word.c}`;
      }).join('');
      return `[${formatTimestamp(line.ts * 1000, 3)}]${words}<${formatTimestamp(line.te * 1000, 3)}>`;
    }).join('\n');
  } catch { return null; }
}

export function parseMusixmatch(body: unknown, q: Query) {
  const parsed = macro.safeParse(body);
  if (!parsed.success) return null;
  const calls = parsed.data.macro_calls;
  const read = (name: string) => calls[name]?.message.header.status_code === 200 ? calls[name]?.message.body : undefined;
  const meta = trackBody.safeParse(read('matcher.track.get'));
  if (!meta.success) return null;
  const track = meta.data.track;
  if (normalizeTitle(track.track_name) !== normalizeTitle(q.title) || primaryArtist(track.artist_name) !== primaryArtist(q.artist)) return null;
  if (q.duration && track.track_length && Math.abs(q.duration - track.track_length) > 5) return null;
  const rich = richBody.safeParse(read('track.richsync.get'));
  const synced = rich.success ? richsyncLrc(rich.data.richsync.richsync_body) : null;
  const sub = subtitles.safeParse(read('track.subtitles.get'));
  const lrc = synced ?? (sub.success ? sub.data.subtitle_list[0]?.subtitle.subtitle_body : null);
  if (!lrc || !/\[\d+:\d+/.test(lrc)) return null;
  return { found: true as const, provider: 'musixmatch' as const, source: 'Musixmatch (unofficial, development)', synced: lrc, plain: null, hasWordSync: !!synced };
}

let token: { value: string; until: number } | undefined;
let blockedUntil = 0;
let pendingToken: Promise<string> | undefined;
async function request(action: string, params: Record<string, string>) {
  const url = new URL(`https://apic-appmobile.musixmatch.com/ws/1.1/${action}`);
  url.search = new URLSearchParams({ app_id: 'mac-ios-v2.0', t: String(Date.now()), ...params }).toString();
  const res = await fetch(url, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(4000), headers: {
    Accept: 'application/json', 'x-mxm-app-version': '10.1.1',
    'X-User-Agent': 'Musixmatch/2025120901 CFNetwork/3860.300.31 Darwin/25.2.0',
  } });
  if (!res.ok) throw new Error('Musixmatch unavailable');
  const data = response.parse(await res.json());
  if (data.message.header.status_code !== 200) throw new Error('Musixmatch rejected request');
  return data.message.body;
}

/** Development only. Never log token-bearing URLs or upstream bodies. */
export async function lookupMusixmatch(q: Query) {
  if (process.env.LYRICSCAPE_UNOFFICIAL_MUSIXMATCH !== 'true' && (process.env.NODE_ENV !== 'development' || process.env.LYRICSCAPE_UNOFFICIAL_MUSIXMATCH === 'false')) return null;
  if (Date.now() < blockedUntil) return null;
  try {
    if (!token || token.until <= Date.now()) {
      pendingToken ??= request('token.get', { user_language: 'en' }).then((body) => {
        const value = z.object({ user_token: z.string().min(1) }).parse(body).user_token;
        token = { value, until: Date.now() + 60_000 };
        return value;
      }).finally(() => { pendingToken = undefined; });
      await pendingToken;
    }
    return parseMusixmatch(await request('macro.subtitles.get', {
      usertoken: token!.value, q_track: q.title, q_artist: q.artist,
      ...(q.album ? { q_album: q.album } : {}), ...(q.duration ? { q_duration: String(q.duration) } : {}),
      namespace: 'lyrics_richsynched', optional_calls: 'track.richsync', subtitle_format: 'lrc',
    }), q);
  } catch {
    token = undefined;
    blockedUntil = Date.now() + 60_000;
    return null;
  }
}
