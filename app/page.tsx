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
      <section className="grain relative mb-10 overflow-hidden rounded-3xl border border-ink-700 bg-gradient-to-br from-ink-850 via-ink-900 to-[#1b0d16] px-6 py-12 sm:px-12 sm:py-16">
        <p className="mb-3 font-mono text-[11px] tracking-[0.2em] text-signal uppercase">Lyrics, alive</p>
        <h1 className="max-w-3xl font-display text-6xl leading-[0.95] tracking-wide uppercase sm:text-8xl">
          Put the words <span className="text-signal">on the beat</span>
        </h1>
        <p className="mt-5 max-w-xl text-lg text-ink-200">
          Play a song, or just leave Spotify running, and watch the lyrics turn into motion. Built to chill with.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          {spotify.connected ? (
            <Button variant="spotify" size="lg" onClick={openStage} disabled={!track}>
              <Mic2 size={18} /> {track ? 'Open lyrics for what’s playing' : 'Play something on Spotify'}
            </Button>
          ) : (
            <Link href="/settings#spotify" className="inline-flex h-12 items-center gap-2 rounded-full bg-spotify px-7 text-base font-semibold text-black hover:brightness-110">
              Connect Spotify <ArrowRight size={18} />
            </Link>
          )}
          <Button size="lg" onClick={() => demo.length && void player.playQueue(demo, 0)} disabled={!demo.length}>
            <Play size={18} fill="currentColor" /> Try the demo songs
          </Button>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          <Chip tone={spotify.connected ? 'spotify' : 'default'}>{spotify.connected ? 'Spotify connected' : 'Spotify: not connected'}</Chip>
          <Chip>Runs locally · no cloud</Chip>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 font-display text-3xl tracking-wide uppercase">Start with a demo</h2>
        <ul className="grid gap-4 sm:grid-cols-3">
          {demo.map((t, i) => (
            <li key={t.id}>
              <button
                onClick={() => void player.playQueue(demo, i)}
                className="group block w-full overflow-hidden rounded-2xl border border-ink-700 bg-ink-900 text-left transition hover:border-ink-400"
              >
                <Cover track={t} rounded="rounded-none" className="aspect-square w-full" />
                <span className="block p-4">
                  <span className="block font-semibold">{t.title}</span>
                  <span className="block text-sm text-ink-300">
                    {t.artists[0]} · {t.bpm} BPM
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {FEATURES.map((f) => (
          <Link key={f.href} href={f.href} className="group rounded-2xl border border-ink-700 bg-ink-900 p-6 transition hover:border-ink-400">
            <span className={`mb-4 block h-1.5 w-10 rounded-full ${f.accent}`} />
            <h3 className="mb-2 font-display text-2xl tracking-wide uppercase">{f.title}</h3>
            <p className="text-sm text-ink-300">{f.body}</p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-bone group-hover:gap-2">
              Open <ArrowRight size={14} />
            </span>
          </Link>
        ))}
      </section>
    </div>
  );
}
