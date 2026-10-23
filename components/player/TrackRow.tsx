'use client';

import { ListPlus, ListEnd, Play, Pause, ExternalLink } from 'lucide-react';
import clsx from 'clsx';
import type { Track } from '@/lib/types';
import { player, usePlayer } from '@/lib/player/controller';
import { Cover } from '@/components/ui/Cover';
import { Chip, IconButton } from '@/components/ui/bits';
import { fmtTime } from './hooks';

export function TrackRow({ track, context, index, extra }: { track: Track; context?: Track[]; index?: number; extra?: React.ReactNode }) {
  const current = usePlayer((s) => s.track?.id === track.id);
  const status = usePlayer((s) => s.status);
  const isPlaying = current && (status === 'playing' || status === 'buffering');

  return (
    <li className={clsx('group flex items-center gap-3 rounded-xl p-2 pr-3 transition', current ? 'bg-ink-800' : 'hover:bg-ink-850')}>
      <button
        className="relative shrink-0"
        aria-label={isPlaying ? `Pause ${track.title}` : `Play ${track.title}`}
        onClick={() => (current ? void player.toggle() : void player.playTrack(track, context))}
      >
        <Cover track={track} className="h-12 w-12 text-lg" />
        <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/55 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
          {isPlaying ? <Pause size={20} fill="white" /> : <Play size={20} fill="white" />}
        </span>
      </button>
      <div className="min-w-0 flex-1">
        <p className={clsx('truncate text-sm font-semibold', current && 'text-signal')}>
          {index !== undefined && <span className="mr-2 font-mono text-[11px] text-ink-400">{index + 1}</span>}
          {track.title}
        </p>
        <p className="truncate text-xs text-ink-300">
          {track.artists.join(', ')}
          {track.album ? ` · ${track.album}` : ''}
        </p>
      </div>
      {extra}
      {track.provider === 'spotify' && <Chip tone="spotify" className="hidden sm:inline-flex">Spotify</Chip>}
      <span className="hidden w-10 text-right font-mono text-xs text-ink-400 tabular-nums sm:block">{fmtTime(track.durationMs)}</span>
      <div className="flex">
        <IconButton label="Play next" onClick={() => player.addToQueue([track], 'next')} className="h-8 w-8">
          <ListPlus size={16} />
        </IconButton>
        <IconButton label="Add to queue" onClick={() => player.addToQueue([track], 'end')} className="h-8 w-8">
          <ListEnd size={16} />
        </IconButton>
        {track.externalUrl && (
          <a href={track.externalUrl} target="_blank" rel="noreferrer" aria-label="Open in Spotify" className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-300 hover:text-bone">
            <ExternalLink size={15} />
          </a>
        )}
      </div>
    </li>
  );
}
