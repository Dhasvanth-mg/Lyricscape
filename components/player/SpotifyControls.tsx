'use client';

import { useState } from 'react';
import { player, usePlayer } from '@/lib/player/controller';
import { Button } from '@/components/ui/bits';

export function SpotifyControls({ onOutputChange }: { onOutputChange?: () => void }) {
  const { spotify, volume, muted } = usePlayer();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!spotify.connected) return null;

  const selectBrowser = async () => {
    setBusy(true);
    setError(null);
    try {
      await player.playOnBrowser();
      onOutputChange?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not select this browser.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-4 space-y-3 rounded-xl border border-ink-700 bg-ink-850 p-4" aria-label="Spotify playback controls">
      <p className="text-sm font-semibold">{spotify.output === 'browser' ? 'Output: this browser (Lyricscape)' : 'Output: active Spotify device'}</p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="spotify" disabled={busy || spotify.sdk !== 'ready'} onClick={() => void selectBrowser()}>
          {busy ? 'Connecting…' : 'Play on this browser'}
        </Button>
        <Button size="sm" disabled={busy || spotify.output === 'active'} onClick={() => { player.followSpotifyDevice(); setError(null); onOutputChange?.(); }}>
          Follow Spotify device
        </Button>
      </div>
      <p className="text-xs text-ink-300">Premium required for browser playback. Choose a song in Listen after selecting this browser. Follow mode uses the device selected in Spotify.</p>
      {spotify.output === 'browser' && <p className="text-xs text-ink-300">Lyrics follow the browser player. For a lyric version that is early or late, open the lyrics stage and select Sync to adjust this song.</p>}
      <label className="flex items-center gap-3 text-sm">
        Volume
        <input type="range" aria-label="Spotify volume" className="seek min-w-0 flex-1" min={0} max={1} step={0.01} value={muted ? 0 : volume} style={{ ['--pct' as string]: `${(muted ? 0 : volume) * 100}%` }} onChange={(e) => player.setVolume(Number(e.target.value))} />
        <span className="w-10 text-right tabular-nums">{Math.round((muted ? 0 : volume) * 100)}%</span>
      </label>
      <Button size="sm" onClick={() => player.toggleMute()}>{muted ? 'Unmute' : 'Mute'}</Button>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    </div>
  );
}
