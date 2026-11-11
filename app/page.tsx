'use client';

import Link from 'next/link';
import { ArrowRight, Mic2, Play } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Track } from '@/lib/types';
import { loadDemoCatalog } from '@/lib/player/providers';
import { player, usePlayer } from '@/lib/player/controller';
import { useUi } from '@/lib/ui-store';
import { listLocalTracks, listLyricsIds, listPlaylists, type StoredPlaylist } from '@/lib/library/db';
import { clearHistory, HISTORY_EVENT, loadHistory } from '@/lib/library/history';
import { quickPicks, recommend, type PlayRecord } from '@/lib/library/recommend';
import { getSavedTracks } from '@/lib/spotify/library';
import { Cover } from '@/components/ui/Cover';
import { Button, Chip } from '@/components/ui/bits';
import { QuickTile, Shelf, TrackCard } from '@/components/home/cards';

const FEATURES = [
  { href: '/visuals', title: 'Kinetic lyrics', body: 'Words pop, stretch, split and explode in time with the song. Pick a style, edit the timing, go fullscreen.', accent: 'bg-signal' },
  { href: '/map', title: 'Music map', body: 'Opt-in, approximate places tied to the songs you were listening to. Private by default; delete anytime.', accent: 'bg-aqua' },
  { href: '/parties', title: 'Parties', body: 'Share a link or QR. Guests add songs and photos from their phones; the big screen shows it live.', accent: 'bg-sun' },
] as const;

const LIBRARY_EVENTS = [HISTORY_EVENT, 'lyricscape:playlists', 'lyricscape:lyrics'];

const greetingFor = (hour: number) => (hour < 5 ? 'Up late' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening');

const ago = (ms: number) => {
  const m = Math.round(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
};

type HomeData = { now: number; greeting: string; demo: Track[]; files: Track[]; playlists: StoredPlaylist[]; spotify: Track[]; history: PlayRecord[]; withLyrics: Set<string> };

const outlineLink = 'inline-flex items-center gap-2 rounded-full border border-ink-400 font-bold text-bone transition hover:scale-[1.04] hover:border-bone';

export default function Home() {
  const spotify = usePlayer((s) => s.spotify);
  const track = usePlayer((s) => s.track);
  const status = usePlayer((s) => s.status);
  const openStage = useUi((s) => s.openStage);
  const [data, setData] = useState<HomeData | null>(null);

  const load = useCallback(async () => {
    const safe = <T,>(p: Promise<T>, fallback: T) => p.catch(() => fallback);
    const [demo, files, playlists, history, lyricIds, saved] = await Promise.all([
      safe(loadDemoCatalog(), []),
      safe(listLocalTracks().then((l) => l.map((s) => s.track)), []),
      safe(listPlaylists(), []),
      safe(loadHistory(), []),
      safe(listLyricsIds(), []),
      spotify.connected ? safe(getSavedTracks(0).then((p) => p.items), []) : Promise.resolve([] as Track[]),
    ]);
    const now = Date.now();
    setData({ now, greeting: greetingFor(new Date(now).getHours()), demo, files, playlists, spotify: saved, history, withLyrics: new Set(lyricIds) });
  }, [spotify.connected]);

  useEffect(() => {
    void load();
    const h = () => void load();
    for (const e of LIBRARY_EVENTS) window.addEventListener(e, h);
    return () => {
      for (const e of LIBRARY_EVENTS) window.removeEventListener(e, h);
    };
  }, [load]);

  const view = useMemo(() => {
    if (!data) return null;
    const pool = [...data.demo, ...data.files, ...data.playlists.flatMap((p) => p.tracks), ...data.spotify];
    // Play the library's copy of a song when it has one; the history copy can be older.
    const byId = new Map(pool.map((t) => [t.id, t]));
    const history = data.history.map((r) => ({ ...r, track: byId.get(r.track.id) ?? r.track }));
    return {
      history,
      picks: quickPicks(history, pool, data.now),
      recs: recommend(pool, history, { now: data.now, withLyrics: data.withLyrics, limit: 11 }),
    };
  }, [data]);

  const playingId = status === 'playing' || status === 'buffering' ? track?.id : undefined;
  const play = (list: Track[], i: number) => {
    if (list[i]?.id === track?.id) return void player.toggle();
    void player.playQueue(list, i);
  };
  const demo = data?.demo ?? [];
  // The song on now has its own card above; recommend something else.
  const recs = view?.recs.filter((r) => r.track.id !== track?.id) ?? [];

  return (
    <div>
      <section className="mb-8">
        <h1 className="mb-4 min-h-9 text-3xl font-bold tracking-tight">{data?.greeting}</h1>
        {view && view.picks.length > 0 && (
          <ul className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {view.picks.map((t, i) => (
              <li key={t.id}>
                <QuickTile track={t} playing={playingId === t.id} onPlay={() => play(view.picks, i)} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {track ? (
        <section className="mb-10 flex flex-col gap-5 overflow-hidden rounded-xl bg-[linear-gradient(120deg,var(--color-signal-dim),var(--color-ink-850)_70%)] p-5 sm:flex-row sm:items-end sm:p-6">
          <Cover track={track} rounded="rounded-md" className="aspect-square w-32 shrink-0 shadow-float sm:w-40" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold">{playingId ? 'Now playing' : 'Paused'}</p>
            <p className="truncate text-3xl font-extrabold tracking-tight sm:text-5xl">{track.title}</p>
            <p className="mt-1 truncate text-sm text-ink-200">{track.artists.join(', ')}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button variant="primary" onClick={openStage}>
                <Mic2 size={16} /> Open the lyrics stage
              </Button>
              <Link href="/listen/now-playing" className={`${outlineLink} h-10 px-6 text-sm`}>
                Song details
              </Link>
            </div>
          </div>
        </section>
      ) : (
        <section className="mb-10 overflow-hidden rounded-xl bg-[linear-gradient(120deg,var(--color-signal-dim),var(--color-ink-850)_70%)] p-6 sm:p-10">
          <p className="mb-2 text-sm font-semibold">Lyrics, alive</p>
          <h2 className="max-w-3xl text-4xl leading-[1.05] font-extrabold tracking-tighter sm:text-6xl">Put the words on the beat</h2>
          <p className="mt-4 max-w-xl text-base text-ink-200">Play a song, or just leave Spotify running, and watch the lyrics turn into motion. Built to chill with.</p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button variant="primary" size="lg" onClick={() => demo.length && void player.playQueue(demo, 0)} disabled={!demo.length}>
              <Play size={18} fill="currentColor" /> Try the demo songs
            </Button>
            {!spotify.connected && (
              <Link href="/settings#spotify" className={`${outlineLink} h-12 px-8 text-base`}>
                Connect Spotify <ArrowRight size={18} />
              </Link>
            )}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Chip tone={spotify.connected ? 'spotify' : 'default'}>{spotify.connected ? 'Spotify connected' : 'Spotify: not connected'}</Chip>
            <Chip>Runs locally · no cloud</Chip>
          </div>
        </section>
      )}

      {view && recs.length > 0 && (
        <Shelf
          title="Recommended for you"
          note={view.history.length ? 'From songs you can play here, matched to what you played on this device.' : 'Play a few songs and these picks will follow your taste.'}
        >
          {recs.map((r, i, all) => (
            <li key={r.track.id} className="snap-start">
              <TrackCard track={r.track} caption={r.reason} playing={playingId === r.track.id} onPlay={() => play(all.map((x) => x.track), i)} />
            </li>
          ))}
        </Shelf>
      )}

      {view && data && view.history.length > 0 && (
        <Shelf
          title="Jump back in"
          action={
            <button onClick={() => void clearHistory()} className="text-sm font-bold text-ink-300 hover:text-bone hover:underline">
              Clear history
            </button>
          }
        >
          {view.history.slice(0, 10).map((r, i, all) => (
            <li key={r.track.id} className="snap-start">
              <TrackCard
                track={r.track}
                caption={`${r.track.artists[0] ?? 'Unknown artist'} · ${r.plays} ${r.plays === 1 ? 'play' : 'plays'} · ${ago(data.now - r.lastPlayedAt)}`}
                playing={playingId === r.track.id}
                onPlay={() => play(all.map((x) => x.track), i)}
              />
            </li>
          ))}
        </Shelf>
      )}

      {data && data.playlists.some((p) => p.tracks.length) && (
        <Shelf
          title="Your playlists"
          action={
            <Link href="/library" className="text-sm font-bold text-ink-300 hover:text-bone hover:underline">
              Show all
            </Link>
          }
        >
          {data.playlists
            .filter((p) => p.tracks.length)
            .slice(0, 10)
            .map((p) => (
              <li key={p.id} className="snap-start">
                <TrackCard
                  track={{ ...p.tracks[0]!, title: p.title }}
                  caption={`Playlist · ${p.tracks.length} ${p.tracks.length === 1 ? 'song' : 'songs'}`}
                  playing={false}
                  onPlay={() => void player.playQueue(p.tracks, 0)}
                />
              </li>
            ))}
        </Shelf>
      )}

      <section>
        <h2 className="mb-3 text-2xl font-bold tracking-tight">Explore Lyricscape</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {FEATURES.map((f) => (
            <Link key={f.href} href={f.href} className="group flex flex-col rounded-lg bg-ink-850 p-5 transition-colors hover:bg-ink-800">
              <span className={`mb-4 block h-1 w-8 rounded-full ${f.accent}`} />
              <h3 className="mb-1 text-lg font-bold tracking-tight">{f.title}</h3>
              <p className="text-sm text-ink-300">{f.body}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-bone group-hover:underline">
                Open <ArrowRight size={14} />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
