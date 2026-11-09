'use client';

import type { ReactNode } from 'react';
import { Pause, Play } from 'lucide-react';
import clsx from 'clsx';
import type { Track } from '@/lib/types';
import { Cover } from '@/components/ui/Cover';

/** The round accent play button that appears on hover over a card. */
function PlayBadge({ playing, className }: { playing: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={clsx(
        'flex items-center justify-center rounded-full bg-signal text-white shadow-card transition duration-300 ease-spring',
        playing ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100',
        className,
      )}
    >
      {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="translate-x-px" />}
    </span>
  );
}

/** Compact tile for the quick-pick grid at the top of the home page. */
export function QuickTile({ track, playing, onPlay }: { track: Track; playing: boolean; onPlay: () => void }) {
  return (
    <button
      onClick={onPlay}
      aria-label={`Play ${track.title}`}
      className="group relative flex h-14 w-full items-center gap-3 overflow-hidden rounded-md bg-white/[0.07] pr-3 text-left transition-colors hover:bg-white/[0.14] sm:h-16"
    >
      <Cover track={track} rounded="rounded-none" className="aspect-square h-full shrink-0 shadow-card" />
      <span className={clsx('min-w-0 flex-1 truncate text-[13px] font-bold sm:text-sm', playing && 'text-signal')}>{track.title}</span>
      <PlayBadge playing={playing} className="hidden h-9 w-9 shrink-0 sm:flex" />
    </button>
  );
}

/** Square-cover card used in the horizontal shelves. */
export function TrackCard({ track, caption, playing, onPlay }: { track: Track; caption: ReactNode; playing: boolean; onPlay: () => void }) {
  return (
    <button onClick={onPlay} aria-label={`Play ${track.title}`} className="group block w-full rounded-lg p-3 text-left transition-colors hover:bg-ink-850">
      <span className="relative mb-3 block">
        <Cover track={track} rounded="rounded-md" className="aspect-square w-full shadow-menu" />
        <PlayBadge playing={playing} className="absolute right-2 bottom-2 h-12 w-12" />
      </span>
      <span className={clsx('block truncate text-base font-semibold', playing && 'text-signal')}>{track.title}</span>
      <span className="line-clamp-2 block text-sm text-ink-300">{caption}</span>
    </button>
  );
}

/** A titled row of cards: scrolls sideways on small screens, a grid on wide ones. */
export function Shelf({ title, note, action, children }: { title: string; note?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="mb-8">
      <div className="mb-1 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
          {note && <p className="text-sm text-ink-300">{note}</p>}
        </div>
        {action}
      </div>
      <ul className="-mx-3 grid snap-x auto-cols-[minmax(150px,42%)] grid-flow-col overflow-x-auto pb-2 sm:auto-cols-[minmax(170px,30%)] lg:auto-cols-auto lg:grid-flow-row lg:grid-cols-5 lg:overflow-visible">
        {children}
      </ul>
    </section>
  );
}
