'use client';

import Link from 'next/link';
import { ListMusic, Maximize2, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Volume2, VolumeX, Mic2 } from 'lucide-react';
import clsx from 'clsx';
import { usePlayer, player } from '@/lib/player/controller';
import { useUi } from '@/lib/ui-store';
import { Cover } from '@/components/ui/Cover';
import { Chip, IconButton, Spinner } from '@/components/ui/bits';
import { fmtTime, usePosition } from './hooks';

const PROVIDER_LABEL = { demo: 'Demo', licensed: 'My file', spotify: 'Spotify' } as const;

export function MiniPlayer() {
  const { track, status, durationMs, volume, muted, queue, error, following } = usePlayer();
  const openStage = useUi((s) => s.openStage);
  const queueOpen = useUi((s) => s.queueOpen);
  const setQueueOpen = useUi((s) => s.setQueueOpen);
  const pos = usePosition(!!track, 10);
  const busy = status === 'loading' || status === 'buffering';
  const playing = status === 'playing' || status === 'buffering';
  const dur = durationMs || track?.durationMs || 0;
  const pct = dur ? Math.min(100, (pos / dur) * 100) : 0;
  const canSeek = !!track && dur > 0;

  return (
    <div
      role="region"
      aria-label="Player"
      className="fixed inset-x-0 bottom-[var(--nav-h)] z-40 border-t border-ink-700 bg-ink-900/95 backdrop-blur-xl md:bottom-0 md:left-[220px]"
    >
      <div className="relative mx-auto flex h-[var(--player-h)] max-w-[1600px] items-center gap-3 px-3 sm:px-5">
        {/* track */}
        <div className="flex min-w-0 flex-1 items-center gap-3 md:flex-none md:basis-[30%]">
          <Link href="/listen/now-playing" aria-label="Open now playing" className="shrink-0">
            <Cover track={track} className="h-12 w-12 text-lg" />
          </Link>
          <div className="min-w-0">
            {track ? (
              <>
                <p className="truncate text-sm font-semibold">{track.title}</p>
                <p className="flex items-center gap-2 truncate text-xs text-ink-300">
                  <span className="truncate">{track.artists.join(', ')}</span>
                  <Chip tone={track.provider === 'spotify' ? 'spotify' : 'default'} className="hidden shrink-0 sm:inline-flex">
                    {PROVIDER_LABEL[track.provider]}
                    {following && ' · following'}
                  </Chip>
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-ink-200">Nothing playing</p>
                <p className="text-xs text-ink-400">Pick a song in Listen</p>
              </>
            )}
          </div>
        </div>

        {/* transport */}
        <div className="flex flex-col items-center gap-0.5 md:flex-1">
          <div className="flex items-center gap-1">
            <IconButton label={queue.shuffle ? 'Shuffle on' : 'Shuffle off'} active={queue.shuffle} onClick={() => player.toggleShuffle()} className="hidden sm:inline-flex">
              <Shuffle size={17} />
            </IconButton>
            <IconButton label="Previous" onClick={() => void player.previous()} disabled={!track}>
              <SkipBack size={19} fill="currentColor" />
            </IconButton>
            <button
              onClick={() => void player.toggle()}
              disabled={!track && queue.entries.length === 0}
              aria-label={playing ? 'Pause' : 'Play'}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-bone text-ink-950 transition hover:scale-105 active:scale-95 disabled:opacity-30"
            >
              {busy && status === 'loading' ? <Spinner className="border-ink-600 border-t-ink-950" /> : playing ? <Pause size={19} fill="currentColor" /> : <Play size={19} fill="currentColor" className="translate-x-px" />}
            </button>
            <IconButton label="Next" onClick={() => void player.next()} disabled={!track}>
              <SkipForward size={19} fill="currentColor" />
            </IconButton>
            <IconButton label={`Repeat: ${queue.repeat}`} active={queue.repeat !== 'off'} onClick={() => player.cycleRepeat()} className="hidden sm:inline-flex">
              {queue.repeat === 'one' ? <Repeat1 size={17} /> : <Repeat size={17} />}
            </IconButton>
          </div>
          <div className="hidden w-full max-w-xl items-center gap-2 font-mono text-[11px] text-ink-400 md:flex">
            <span className="w-9 text-right tabular-nums">{fmtTime(pos)}</span>
            <input
              type="range"
              className="seek"
              aria-label="Seek"
              min={0}
              max={Math.max(1, dur)}
              step={250}
              value={Math.min(pos, dur)}
              disabled={!canSeek}
              style={{ ['--pct' as string]: `${pct}%` }}
              onChange={(e) => void player.seek(Number(e.target.value))}
            />
            <span className="w-9 tabular-nums">{fmtTime(dur)}</span>
          </div>
        </div>

        {/* right cluster */}
        <div className="flex items-center justify-end gap-1 md:basis-[30%]">
          <IconButton label="Lyrics stage (L)" onClick={openStage} disabled={!track}>
            <Mic2 size={18} />
          </IconButton>
          <IconButton label="Queue" active={queueOpen} onClick={() => setQueueOpen(!queueOpen)} className="hidden sm:inline-flex">
            <ListMusic size={18} />
          </IconButton>
          <div className="hidden items-center gap-1 lg:flex">
            <IconButton label={muted ? 'Unmute' : 'Mute'} onClick={() => player.toggleMute()}>
              {muted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </IconButton>
            <input
              type="range"
              className="seek w-24"
              aria-label="Volume"
              min={0}
              max={1}
              step={0.01}
              value={muted ? 0 : volume}
              style={{ ['--pct' as string]: `${(muted ? 0 : volume) * 100}%` }}
              onChange={(e) => player.setVolume(Number(e.target.value))}
            />
          </div>
          <Link href="/visuals" aria-label="Open visuals" className="hidden h-9 w-9 items-center justify-center rounded-full text-ink-300 hover:text-bone xl:inline-flex">
            <Maximize2 size={17} />
          </Link>
        </div>

        {/* thin progress on mobile */}
        <div className="absolute inset-x-0 top-0 h-0.5 bg-ink-700 md:hidden">
          <div className={clsx('h-full bg-signal')} style={{ width: `${pct}%` }} />
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 border-t border-red-500/30 bg-red-950/60 px-4 py-2 text-xs text-red-200">
          <span>{error.message}</span>
          <div className="flex gap-3">
            {error.kind === 'auth' && (
              <Link href="/settings" className="font-semibold underline">
                Reconnect
              </Link>
            )}
            <button className="font-semibold underline" onClick={() => player.dismissError()}>
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
