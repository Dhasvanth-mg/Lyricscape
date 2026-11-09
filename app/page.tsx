'use client';

import Link from 'next/link';
import { ArrowRight, Mic2, Play } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Track } from '@/lib/types';
import { loadDemoCatalog } from '@/lib/player/providers';
import { player, usePlayer } from '@/lib/player/controller';
import { useUi } from '@/lib/ui-store';
import { Cover } from '@/components/ui/Cover';
import { Button, Chip } from '@/components/ui/bits';

const FEATURES = [
  { href: '/visuals', title: 'Kinetic lyrics', body: 'Words pop, stretch, split and explode in time with the song. Pick a style, edit the timing, go fullscreen.', accent: 'bg-signal' },
  { href: '/map', title: 'Music map', body: 'Opt-in, approximate places tied to the songs you were listening to. Private by default; delete anytime.', accent: 'bg-aqua' },
  { href: '/parties', title: 'Parties', body: 'Share a link or QR. Guests add songs and photos from their phones; the big screen shows it live.', accent: 'bg-sun' },
] as const;

export default function Home() {
  const [demo, setDemo] = useState<Track[]>([]);
  const spotify = usePlayer((s) => s.spotify);
  const track = usePlayer((s) => s.track);
  const openStage = useUi((s) => s.openStage);

  useEffect(() => {
    void loadDemoCatalog().then(setDemo).catch(() => undefined);
  }, []);

  return (
    <div>
      <section className="relative -mx-4 -mt-6 mb-8 overflow-hidden bg-[linear-gradient(to_bottom,var(--color-signal-dim),transparent)] px-4 pt-16 pb-8 sm:-mx-6 sm:px-6 md:-mx-8 md:-mt-8 md:rounded-t-xl md:px-8 md:pt-24">
        <p className="mb-2 text-sm font-semibold">Lyrics, alive</p>
        <h1 className="max-w-3xl text-5xl leading-[1.05] font-extrabold tracking-tighter sm:text-7xl">Put the words on the beat</h1>
        <p className="mt-4 max-w-xl text-base text-ink-200">
          Play a song, or just leave Spotify running, and watch the lyrics turn into motion. Built to chill with.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button variant="primary" size="lg" onClick={() => demo.length && void player.playQueue(demo, 0)} disabled={!demo.length}>
            <Play size={18} fill="currentColor" /> Try the demo songs
          </Button>
          {spotify.connected ? (
            <Button size="lg" onClick={openStage} disabled={!track}>
              <Mic2 size={18} /> {track ? 'Open lyrics for what’s playing' : 'Play something on Spotify'}
            </Button>
          ) : (
            <Link href="/settings#spotify" className="inline-flex h-12 items-center gap-2 rounded-full border border-ink-400 px-8 text-base font-bold text-bone transition hover:scale-[1.04] hover:border-bone">
              Connect Spotify <ArrowRight size={18} />
            </Link>
          )}
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Chip tone={spotify.connected ? 'spotify' : 'default'}>{spotify.connected ? 'Spotify connected' : 'Spotify: not connected'}</Chip>
          <Chip>Runs locally · no cloud</Chip>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-2xl font-bold tracking-tight">Start with a demo</h2>
        <ul className="-mx-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          {demo.map((t, i) => (
            <li key={t.id}>
              <button
                onClick={() => void player.playQueue(demo, i)}
                aria-label={`Play ${t.title}`}
                className="group block w-full rounded-lg p-3 text-left transition-colors hover:bg-ink-850"
              >
                <span className="relative mb-3 block">
                  <Cover track={t} rounded="rounded-md" className="aspect-square w-full shadow-menu" />
                  <span className="absolute right-2 bottom-2 flex h-12 w-12 translate-y-2 items-center justify-center rounded-full bg-signal text-white opacity-0 shadow-card transition duration-300 ease-spring group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
                    <Play size={20} fill="currentColor" className="translate-x-px" />
                  </span>
                </span>
                <span className="block truncate font-semibold text-base">{t.title}</span>
                <span className="block truncate text-sm text-ink-300">
                  {t.artists[0]} · {t.bpm} BPM
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

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
