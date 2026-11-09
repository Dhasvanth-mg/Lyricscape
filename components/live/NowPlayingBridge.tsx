'use client';

import { useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { usePlayer, player } from '@/lib/player/controller';
import { useUi } from '@/lib/ui-store';
import { usePip } from '@/lib/live/pip';
import type { LiveClock, LivePost, LiveSong } from '@/lib/live/types';
import { useLyrics } from '@/components/visualizer/useLyrics';
import { useLyricClock } from '@/components/visualizer/useLyricClock';
import { useSongIndex, withIndexedTempo } from '@/components/visualizer/useSongIndex';
import { useSecondLine } from '@/components/visualizer/useSecondLine';
import { Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import clsx from 'clsx';
import type { PipLook } from '@/lib/ui-store';
import { LyricStrip, DEFAULT_STRIP, STRIP_FONTS, STRIP_FONT_LABEL } from './LyricStrip';

/** Only plain web URLs leave the tab (a generated cover is a large data URL that overlays can do without). */
const webUrl = (u?: string | null) => (u && /^https?:\/\//.test(u) ? u : null);

async function post(body: LivePost) {
  try {
    await fetch('/api/live', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive: body.kind === 'clock' });
  } catch {
    /* the local server is gone; overlays just stop updating */
  }
}

/**
 * Keeps the lyrics of what is playing available outside the stage: in the floating window (Picture-in-Picture), and, when the
 * person turns it on, on this computer's server for the OBS overlay and the wallpaper. Mounted once in the app shell.
 * Idle (no lyric lookups, no requests) unless one of the two is in use.
 */
export function NowPlayingBridge() {
  const playing = usePlayer((s) => s.track);
  const status = usePlayer((s) => s.status);
  const share = useUi((s) => s.liveShare);
  const pipWin = usePip((s) => s.win);
  const active = share || !!pipWin;
  const track = active ? playing : null;
  const lyrics = useLyrics(track);
  const clock = useLyricClock(track);
  const idx = useSongIndex(track);
  const timed = useMemo(() => withIndexedTempo(track, idx.grid), [track, idx.grid]);
  const second = useSecondLine(track, lyrics.doc);

  const lines = useMemo(() => lyrics.doc?.lines.map((l) => ({ startMs: l.startMs, endMs: l.endMs, words: l.words.map((w) => ({ text: w.text, startMs: w.startMs, endMs: w.endMs })), wordTiming: l.wordTiming })) ?? null, [lyrics.doc]);

  const song = useMemo<LiveSong | null>(() => {
    if (!track) return null;
    return {
      track: { id: track.id, title: track.title, artists: track.artists, durationMs: track.durationMs, artworkUrl: webUrl(track.artworkUrl) },
      docKey: lyrics.doc ? `${track.id}:${lyrics.source ?? ''}:${lyrics.versionId ?? ''}:${lyrics.doc.lines.length}:${lyrics.doc.lines[0]?.startMs ?? 0}` : null,
      lines,
      palette: track.palette?.slice(0, 8) ?? null,
      beatsMs: timed?.beatTimesMs?.slice(0, 5000) ?? null,
      sub: second.lines,
    };
  }, [track, lyrics.doc, lyrics.source, lyrics.versionId, lines, timed, second.lines]);

  const clockRef = useRef(clock);
  useEffect(() => {
    clockRef.current = clock;
  }, [clock]);
  const sample = (): LiveClock => ({ playing: usePlayer.getState().status === 'playing', lyricMs: Math.round(clockRef.current.now()), at: Date.now(), trackOffsetMs: clockRef.current.trackOffset });

  // the song (and a fresh clock) whenever it changes
  const lastSent = useRef<{ lyricMs: number; at: number; playing: boolean } | null>(null);
  useEffect(() => {
    if (!share) return;
    const c = sample();
    lastSent.current = c;
    void post({ kind: 'song', song: song ?? { track: null, docKey: null, lines: null, palette: null, beatsMs: null, sub: null }, clock: c });
  }, [share, song]);

  // the clock: on play/pause, on a jump (seek, a sync nudge), and every few seconds so readers never drift far
  useEffect(() => {
    if (!share) return;
    const tick = () => {
      const c = sample();
      const prev = lastSent.current;
      const predicted = prev ? (prev.playing ? prev.lyricMs + (c.at - prev.at) : prev.lyricMs) : NaN;
      const due = !prev || prev.playing !== c.playing || Math.abs(predicted - c.lyricMs) > 120 || c.at - prev.at > 4000;
      if (!due) return;
      lastSent.current = c;
      void post({ kind: 'clock', clock: c });
    };
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [share, status, clock.trackOffset, clock.device]);

  const look = useUi((s) => s.pipLook);
  if (!pipWin) return null;
  return createPortal(
    <div className="group relative h-dvh w-screen bg-[#07060c] text-white">
      <LyricStrip
        lines={lines}
        now={clock.now}
        win={pipWin}
        options={{ ...DEFAULT_STRIP, ...look, align: 'center' }}
        palette={playing?.palette ?? null}
        artworkUrl={playing?.artworkUrl ?? null}
        sub={second.lines}
        title={playing?.title ?? null}
        artist={playing?.artists.join(', ') ?? null}
        emptyText={!playing ? 'Nothing playing' : lyrics.status === 'loading' || lyrics.searching ? 'Finding lyrics…' : 'No lyrics for this song'}
      />
      <PipBar look={look} playing={status === 'playing'} />
      <PipKeys win={pipWin} />
    </div>,
    pipWin.document.body,
  );
}

/** Space plays and pauses from the floating window too. */
function PipKeys({ win }: { win: Window }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        e.preventDefault();
        void player.toggle();
      }
    };
    win.addEventListener('keydown', onKey);
    return () => win.removeEventListener('keydown', onKey);
  }, [win]);
  return null;
}

const SIZES: PipLook['size'][] = ['s', 'm', 'l', 'xl'];
const LOOKS: { id: PipLook['bg']; label: string }[] = [
  { id: 'solid', label: 'Colour' },
  { id: 'cover', label: 'Cover' },
  { id: 'transparent', label: 'Minimal' },
];

/** Controls inside the floating window, shown while the pointer is over it: playback, look, font, size, next line. */
function PipBar({ look, playing }: { look: PipLook; playing: boolean }) {
  const setUi = useUi((s) => s.set);
  const put = (p: Partial<PipLook>) => setUi({ pipLook: { ...look, ...p } });
  const btn = 'grid h-7 min-w-7 place-items-center rounded-md px-1.5 text-[11px] font-semibold text-white/80 hover:bg-white/15 hover:text-white';
  const si = SIZES.indexOf(look.size);
  return (
    <div
      data-testid="pip-bar"
      className="absolute inset-x-0 top-0 flex items-center justify-between gap-1 bg-gradient-to-b from-black/80 to-transparent px-2 pt-1.5 pb-4 opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-within:opacity-100"
    >
      <div className="flex items-center">
        <button className={btn} aria-label="Previous" onClick={() => void player.previous()}>
          <SkipBack size={14} />
        </button>
        <button className={btn} aria-label={playing ? 'Pause' : 'Play'} onClick={() => void player.toggle()}>
          {playing ? <Pause size={14} /> : <Play size={14} />}
        </button>
        <button className={btn} aria-label="Next" onClick={() => void player.next()}>
          <SkipForward size={14} />
        </button>
      </div>
      <div className="flex items-center gap-0.5">
        <div className="flex rounded-md bg-white/10 p-0.5">
          {LOOKS.map((l) => (
            <button key={l.id} data-testid={`pip-look-${l.id}`} className={clsx('rounded px-1.5 py-0.5 text-[11px] font-semibold', look.bg === l.id ? 'bg-white text-black' : 'text-white/75 hover:text-white')} onClick={() => put({ bg: l.id })}>
              {l.label}
            </button>
          ))}
        </div>
        <button className={btn} data-testid="pip-font" title="Font" onClick={() => put({ font: STRIP_FONTS[(STRIP_FONTS.indexOf(look.font) + 1) % STRIP_FONTS.length]! })}>
          {STRIP_FONT_LABEL[look.font]}
        </button>
        <button className={btn} aria-label="Smaller text" disabled={si <= 0} onClick={() => put({ size: SIZES[Math.max(0, si - 1)]! })}>
          A-
        </button>
        <button className={btn} aria-label="Bigger text" disabled={si >= SIZES.length - 1} onClick={() => put({ size: SIZES[Math.min(SIZES.length - 1, si + 1)]! })}>
          A+
        </button>
        <button className={clsx(btn, look.next ? 'text-white' : 'text-white/45')} title="Show the next line" aria-pressed={look.next} onClick={() => put({ next: !look.next })}>
          Next
        </button>
      </div>
    </div>
  );
}
