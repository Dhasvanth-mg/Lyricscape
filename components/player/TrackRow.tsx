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
    <li className={clsx('group flex h-14 items-center gap-3 border-b border-line px-2 transition-colors duration-150', current ? 'bg-ink-900' : 'hover:bg-ink-900')}>
      {index !== undefined && (
        <span className={clsx('w-6 shrink-0 text-right font-mono text-[12px] tabular-nums', current ? 'text-signal' : 'text-ink-500')}>{index + 1}</span>
      )}
      <button
        className="relative shrink-0"
        aria-label={isPlaying ? `Pause ${track.title}` : `Play ${track.title}`}
        onClick={() => (current ? void player.toggle() : void player.playTrack(track, context))}
      >
        <Cover track={track} className="h-10 w-10 text-lg" rounded="rounded-[3px]" />
        <span className="absolute inset-0 flex items-center justify-center rounded-[3px] bg-black/60 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
          {isPlaying ? <Pause size={16} fill="white" /> : <Play size={16} fill="white" />}
        </span>
      </button>
      <div className="min-w-0 flex-1">
        <p className={clsx('truncate text-[13px] font-semibold', current && 'text-signal')}>{track.title}</p>
        <p className="truncate text-[12px] text-ink-400">
          {track.artists.join(', ')}
          {track.album ? ` · ${track.album}` : ''}
        </p>
      </div>
      {extra}
      {track.provider === 'spotify' && <Chip tone="spotify" className="max-sm:hidden">Spotify</Chip>}
      <span className="hidden w-10 text-right font-mono text-[12px] text-ink-400 tabular-nums sm:block">{fmtTime(track.durationMs)}</span>
      <div className="flex opacity-60 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100">
        <IconButton label="Play next" onClick={() => player.addToQueue([track], 'next')} className="h-7 w-7">
          <ListPlus size={16} />
        </IconButton>
        <IconButton label="Add to queue" onClick={() => player.addToQueue([track], 'end')} className="h-7 w-7">
          <ListEnd size={16} />
        </IconButton>
        {track.externalUrl && (
          <a href={track.externalUrl} target="_blank" rel="noreferrer" aria-label="Open in Spotify" className="inline-flex h-7 w-7 items-center justify-center rounded text-ink-300 hover:bg-ink-800 hover:text-bone">
            <ExternalLink size={15} />
          </a>
        )}
      </div>
    </li>
  );
}
