'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { LyricStrip, DEFAULT_STRIP, type StripOptions } from '@/components/live/LyricStrip';
import { parseOverlayParams } from '@/lib/live/overlayParams';
import { EMPTY_SONG, liveNow, type LiveClock, type LiveSong } from '@/lib/live/types';

/**
 * Lyrics of whatever Lyricscape is playing, for a stream overlay (OBS browser source) or a desktop wallpaper (Lively,
 * Wallpaper Engine). It reads the local server's "now playing" stream, so it works in another browser or app on the same
 * computer. Needs Settings -> Lyrics outside the app -> Share with overlays.
 */
export default function OverlayPage() {
  const [opts, setOpts] = useState<StripOptions>({ ...DEFAULT_STRIP, bg: 'transparent' });
  const [song, setSong] = useState<LiveSong>(EMPTY_SONG);
  const [connected, setConnected] = useState(false);
  const clock = useRef<LiveClock>({ playing: false, lyricMs: 0, at: 0, trackOffsetMs: 0 });

  useEffect(() => {
    setOpts(parseOverlayParams(window.location.search));
  }, []);

  // a transparent page for OBS: nothing of the app's dark background may show
  useEffect(() => {
    if (opts.bg !== 'transparent') return;
    const els = [document.documentElement, document.body];
    const before = els.map((e) => e.style.background);
    els.forEach((e) => (e.style.background = 'transparent'));
    return () => els.forEach((e, i) => (e.style.background = before[i] ?? ''));
  }, [opts.bg]);

  useEffect(() => {
    const es = new EventSource('/api/live/stream');
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.addEventListener('song', (e) => {
      const d = JSON.parse((e as MessageEvent<string>).data) as { song: LiveSong; clock: LiveClock };
      clock.current = d.clock;
      setSong(d.song);
    });
    es.addEventListener('clock', (e) => {
      clock.current = JSON.parse((e as MessageEvent<string>).data) as LiveClock;
    });
    return () => es.close();
  }, []);

  const now = useCallback(() => liveNow(clock.current, Date.now()), []);

  return (
    <div className="h-dvh w-screen text-white" data-testid="overlay">
      {song.track ? (
        <LyricStrip lines={song.lines} now={now} options={opts} sub={song.sub}
          title={song.track.title} artist={song.track.artists.join(', ')} artworkUrl={song.track.artworkUrl} emptyText={opts.bg === 'transparent' ? null : 'No lyrics for this song'} />
      ) : opts.bg !== 'transparent' ? (
        <div className="grid h-full place-items-center bg-[#0b0a12] p-6 text-center text-sm text-white/50">{connected ? 'Waiting for Lyricscape to play something…' : 'Connecting to Lyricscape…'}</div>
      ) : null}
    </div>
  );
}
