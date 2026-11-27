'use client';

import Link from 'next/link';
import { ArrowUpRight, Mic2, Play } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Track } from '@/lib/types';
import { loadDemoCatalog } from '@/lib/player/providers';
import { player, usePlayer } from '@/lib/player/controller';
import { useUi } from '@/lib/ui-store';
import { Cover } from '@/components/ui/Cover';
import { TrackRow } from '@/components/player/TrackRow';
import { Button, SectionTitle, buttonClass } from '@/components/ui/bits';

const PLACES = [
  { href: '/visuals', title: 'Visuals', body: 'Pick a lyric style, edit the timing, export a video.' },
  { href: '/map', title: 'Map', body: 'Opt-in, approximate places tied to what you were playing.' },
  { href: '/parties', title: 'Parties', body: 'Guests add songs and photos from their phones; the big screen shows it live.' },
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
    <div className="grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <section aria-label="Now playing">
        <Cover track={track ?? demo[0] ?? null} rounded="rounded-[4px]" className={track ? 'aspect-square w-full max-w-[520px]' : 'aspect-square w-full max-w-[520px] opacity-40 grayscale max-lg:hidden'} />
        <div className="mt-5">
          {track ? (
            <>
              <p className="text-[12px] text-ink-400">Now playing</p>
              <h1 className="mt-1 text-[32px] leading-tight font-semibold tracking-[-0.02em]">{track.title}</h1>
              <p className="text-[15px] text-ink-300">{track.artists.join(', ')}</p>
            </>
          ) : (
            <>
              <h1 className="text-[32px] leading-tight font-semibold tracking-[-0.02em]">Nothing playing</h1>
              <p className="text-[15px] text-ink-300">Play a song, or leave Spotify running, and the lyrics move with it.</p>
            </>
          )}
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {track ? (
            <Button variant="primary" size="lg" onClick={openStage}>
              <Mic2 size={16} /> Open lyrics
            </Button>
          ) : (
            <Button variant="primary" size="lg" onClick={() => demo.length && void player.playQueue(demo, 0)} disabled={!demo.length}>
              <Play size={16} fill="currentColor" /> Play the demo songs
            </Button>
          )}
          {!spotify.connected && (
            <Link href="/settings#spotify" className={buttonClass('outline', 'lg')}>
              Connect Spotify
            </Link>
          )}
        </div>
      </section>

      <div className="min-w-0">
        <section className="mb-10">
          <div className="mb-2 flex items-baseline justify-between">
            <SectionTitle className="mb-0">Demo songs</SectionTitle>
            <Link href="/listen" className="text-[12px] text-ink-400 hover:text-bone">
              All music
            </Link>
          </div>
          <ul className="border-t border-line">
            {demo.map((t, i) => (
              <TrackRow key={t.id} track={t} context={demo} index={i} />
            ))}
          </ul>
        </section>

        <section className="mb-10">
          <SectionTitle className="mb-2">Sources</SectionTitle>
          <dl className="border-t border-line text-[13px]">
            <div className="flex h-11 items-center gap-4 border-b border-line px-2">
              <dt className="w-24 text-ink-400">Spotify</dt>
              <dd className="flex-1">{spotify.connected ? 'Connected' : 'Not connected'}</dd>
              <dd>
                <Link href="/settings#spotify" className="text-ink-400 hover:text-bone">
                  {spotify.connected ? 'Manage' : 'Connect'}
                </Link>
              </dd>
            </div>
            <div className="flex h-11 items-center gap-4 border-b border-line px-2">
              <dt className="w-24 text-ink-400">Storage</dt>
              <dd className="flex-1">This computer only. Nothing goes to a cloud.</dd>
            </div>
          </dl>
        </section>

        <section>
          <SectionTitle className="mb-2">Go to</SectionTitle>
          <ul className="border-t border-line">
            {PLACES.map((p) => (
              <li key={p.href}>
                <Link href={p.href} className="group flex h-14 items-center gap-4 border-b border-line px-2 transition-colors duration-150 hover:bg-ink-900">
                  <span className="w-24 text-[13px] font-semibold">{p.title}</span>
                  <span className="flex-1 truncate text-[13px] text-ink-400">{p.body}</span>
                  <ArrowUpRight size={15} className="text-ink-500 group-hover:text-bone" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
