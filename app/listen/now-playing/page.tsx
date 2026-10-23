'use client';

import Link from 'next/link';
import { Mic2 } from 'lucide-react';
import { usePlayer } from '@/lib/player/controller';
import { upcoming } from '@/lib/player/queue';
import { useUi } from '@/lib/ui-store';
import { providers } from '@/lib/player/providers';
import { explainSpotifyCapability } from '@/lib/player/providers';
import type { CapabilityKey } from '@/lib/types';
import { Cover } from '@/components/ui/Cover';
import { Button, Chip, Empty, PageHeader } from '@/components/ui/bits';
import { TrackRow } from '@/components/player/TrackRow';
import { LyricStage } from '@/components/visualizer/LyricStage';

const CAP_LABEL: Partial<Record<CapabilityKey, string>> = {
  play: 'Playback',
  seek: 'Seek',
  deviceTransfer: 'Device control',
  synchronizedVisuals: 'Synced lyrics',
  audioAnalysis: 'Beat analysis',
  djMixing: 'DJ mixing',
  videoExport: 'Video export',
  artworkCompositing: 'Artwork effects',
};

export default function NowPlaying() {
  const { track, queue, capabilities, status, following, error } = usePlayer();
  const style = useUi((s) => s.style);
  const openStage = useUi((s) => s.openStage);
  if (!track) {
    return (
      <div>
        <PageHeader eyebrow="Player" title="Now playing" />
        <Empty
          title="Nothing playing"
          action={
            <Link href="/listen" className="inline-flex h-10 items-center rounded-full bg-bone px-5 text-sm font-semibold text-ink-950">
              Browse songs
            </Link>
          }
        >
          Start a song, or play something in Spotify while connected.
        </Empty>
      </div>
    );
  }
  const next = upcoming(queue);
  const providerLabel = providers[track.provider].label;

  return (
    <div>
      <PageHeader eyebrow="Player" title="Now playing" />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,420px)_1fr]">
        <div>
          <Cover track={track} rounded="rounded-2xl" className="mb-5 aspect-square w-full" />
          <h2 className="font-display text-4xl leading-tight tracking-wide uppercase">{track.title}</h2>
          <p className="mb-3 text-ink-200">
            {track.artists.join(', ')}
            {track.album ? ` · ${track.album}` : ''}
          </p>
          <div className="mb-4 flex flex-wrap gap-2">
            <Chip tone={track.provider === 'spotify' ? 'spotify' : 'default'}>{providerLabel}</Chip>
            {following && <Chip tone="spotify">following</Chip>}
            <Chip tone={status === 'error' ? 'bad' : 'default'}>{status}</Chip>
          </div>
          <Button variant="primary" onClick={openStage} className="mb-5 w-full">
            <Mic2 size={16} /> Lyrics stage
          </Button>
          {error && <p className="mb-4 rounded-lg border border-red-500/30 bg-red-950/40 p-3 text-sm text-red-200">{error.message}</p>}
          <details className="rounded-xl border border-ink-700 p-3 text-sm">
            <summary className="cursor-pointer font-semibold">What this source can do</summary>
            <ul className="mt-2 space-y-1">
              {(Object.keys(CAP_LABEL) as CapabilityKey[]).map((k) => (
                <li key={k} className="flex gap-2">
                  <span className={capabilities[k] ? 'text-aqua' : 'text-ink-500'}>{capabilities[k] ? '✓' : '✕'}</span>
                  <span>
                    {CAP_LABEL[k]}
                    {!capabilities[k] && track.provider === 'spotify' && explainSpotifyCapability(k) && (
                      <span className="block text-xs text-ink-400">{explainSpotifyCapability(k)}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        </div>
        <div className="min-w-0">
          <LyricStage track={track} style={style} className="mb-6 aspect-video w-full rounded-2xl border border-ink-700" />
          <h3 className="mb-2 font-display text-2xl tracking-wide uppercase">Up next</h3>
          {next.length === 0 ? (
            <p className="text-sm text-ink-400">Nothing queued.</p>
          ) : (
            <ul>
              {next.slice(0, 12).map((e) => (
                <TrackRow key={e.qid} track={e.track} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
