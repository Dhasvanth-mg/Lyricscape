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
import { LyricStrip, DEFAULT_STRIP } from './LyricStrip';

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

  if (!pipWin) return null;
  return createPortal(
    <div className="h-dvh w-screen bg-[#0b0a12] text-white">
      <LyricStrip
        lines={lines}
        now={clock.now}
        win={pipWin}
        options={{ ...DEFAULT_STRIP, size: 'm' }}
        sub={second.lines}
        title={playing?.title ?? null}
        artist={playing?.artists.join(', ') ?? null}
        emptyText={!playing ? 'Nothing playing' : lyrics.status === 'loading' || lyrics.searching ? 'Finding lyrics…' : 'No lyrics for this song'}
      />
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
