'use client';

import Link from 'next/link';
import { ListMusic, Maximize2, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Volume2, VolumeX, Mic2 } from 'lucide-react';
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
      className="fixed inset-x-0 bottom-[var(--nav-h)] z-40 border-t border-line bg-ink-900 px-4 sm:px-6 md:bottom-0"
    >
      {/* the seek line runs the full width of the bar's top edge */}
      <input
        type="range"
        className="seek absolute inset-x-0 -top-[10px] z-10 !h-5"
        aria-label="Seek"
        min={0}
        max={Math.max(1, dur)}
        step={250}
        value={Math.min(pos, dur)}
        disabled={!canSeek}
        style={{ ['--pct' as string]: `${pct}%`, ['--fill' as string]: 'var(--color-signal)' }}
        onChange={(e) => void player.seek(Number(e.target.value))}
      />
      <div className="mx-auto flex h-[var(--player-h)] max-w-[1320px] items-center gap-4">
        {/* track */}
        <div className="flex min-w-0 flex-1 items-center gap-3 md:basis-1/3">
          <Link href="/listen/now-playing" aria-label="Open now playing" className="shrink-0">
            <Cover track={track} className="h-11 w-11 text-lg" rounded="rounded-[3px]" />
          </Link>
          <div className="min-w-0">
            {track ? (
              <>
                <p className="truncate text-[13px] font-semibold">{track.title}</p>
                <p className="flex items-center gap-2 truncate text-[12px] text-ink-400">
                  <span className="truncate">{track.artists.join(', ')}</span>
                  <Chip tone={track.provider === 'spotify' ? 'spotify' : 'default'} className="shrink-0 max-sm:hidden">
                    {PROVIDER_LABEL[track.provider]}
                    {following && ' · following'}
                  </Chip>
                </p>
              </>
            ) : (
              <>
                <p className="truncate text-[13px] font-semibold text-ink-200">Nothing playing</p>
                <p className="truncate text-[12px] text-ink-400 max-sm:hidden">Pick a song in Listen</p>
              </>
            )}
          </div>
        </div>

        {/* transport */}
        <div className="flex items-center gap-1 md:basis-1/3 md:justify-center">
          <IconButton label={queue.shuffle ? 'Shuffle on' : 'Shuffle off'} active={queue.shuffle} onClick={() => player.toggleShuffle()} className="max-sm:hidden">
            <Shuffle size={16} />
          </IconButton>
          <IconButton label="Previous" onClick={() => void player.previous()} disabled={!track}>
            <SkipBack size={17} fill="currentColor" />
          </IconButton>
          <button
            onClick={() => void player.toggle()}
            disabled={!track && queue.entries.length === 0}
            aria-label={playing ? 'Pause' : 'Play'}
            className="mx-1 flex h-9 w-9 items-center justify-center rounded bg-bone text-ink-950 transition-colors duration-150 hover:bg-white disabled:opacity-30"
          >
            {busy && status === 'loading' ? <Spinner className="border-ink-600 border-t-ink-950" /> : playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" className="translate-x-px" />}
          </button>
          <IconButton label="Next" onClick={() => void player.next()} disabled={!track}>
            <SkipForward size={17} fill="currentColor" />
          </IconButton>
          <IconButton label={`Repeat: ${queue.repeat}`} active={queue.repeat !== 'off'} onClick={() => player.cycleRepeat()} className="max-sm:hidden">
            {queue.repeat === 'one' ? <Repeat1 size={16} /> : <Repeat size={16} />}
          </IconButton>
          <span className="ml-3 hidden font-mono text-[11px] text-ink-400 tabular-nums md:inline">
            {fmtTime(pos)} / {fmtTime(dur)}
          </span>
        </div>

        {/* right cluster */}
        <div className="flex items-center justify-end gap-1 md:basis-1/3">
          <button
            onClick={openStage}
            disabled={!track}
            title="Lyrics stage (L)"
            className="hidden h-8 items-center gap-2 rounded border border-ink-600 px-2.5 text-[12px] font-medium text-bone transition-colors duration-150 hover:border-ink-400 disabled:opacity-30 sm:inline-flex"
          >
            <Mic2 size={14} /> Lyrics
          </button>
          <IconButton label="Lyrics stage (L)" onClick={openStage} disabled={!track} className="sm:hidden">
            <Mic2 size={17} />
          </IconButton>
          <IconButton label="Queue" active={queueOpen} onClick={() => setQueueOpen(!queueOpen)} className="max-sm:hidden">
            <ListMusic size={17} />
          </IconButton>
          <div className="hidden items-center gap-1 lg:flex">
            <IconButton label={muted ? 'Unmute' : 'Mute'} onClick={() => player.toggleMute()}>
              {muted || volume === 0 ? <VolumeX size={17} /> : <Volume2 size={17} />}
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
          <Link href="/visuals" aria-label="Open visuals" title="Open visuals" className="hidden h-8 w-8 items-center justify-center rounded text-ink-300 transition-colors duration-150 hover:bg-ink-800 hover:text-bone xl:inline-flex">
            <Maximize2 size={16} />
          </Link>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 border-t border-red-500/30 bg-red-950 px-4 py-2 text-xs text-red-200">
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
