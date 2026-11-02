'use client';

import { useCallback, useEffect, useState } from 'react';
import { clearIndex, fetchStats } from '@/lib/index/client';
import type { IndexStats } from '@/lib/index/types';
import { disableListening, enableListening, useIndexer } from '@/lib/analysis/indexer';
import { useUi } from '@/lib/ui-store';
import { Button } from '@/components/ui/bits';

const fmtBytes = (b: number) => (b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);

/** Settings card for the song index (what it remembers, listening on/off, clearing). */
export function SongIndexSection() {
  const [stats, setStats] = useState<IndexStats | null>(null);
  const ix = useIndexer();
  const indexLocal = useUi((s) => s.indexLocal);
  const onlineTempo = useUi((s) => s.onlineTempo);
  const setUi = useUi((s) => s.set);

  const refresh = useCallback(async () => setStats(await fetchStats()), []);
  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 8000);
    return () => clearInterval(t);
  }, [refresh]);

  return (
    <div data-testid="song-index">
      <p className="mb-3 text-sm text-ink-300">
        Lyricscape remembers what it works out about each song (cover colours, lyrics you found, the tempo and beat of the audio) in a small local database, so it never does the same work twice. Only numbers and text are kept:{' '}
        <strong>never the audio itself</strong>.
      </p>

      {stats && !stats.available && <p className="mb-3 text-sm text-amber-300">The song index needs Node 22.5 or newer on this computer. Everything else works without it.</p>}
      {stats?.available && (
        <dl className="mb-4 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4" data-testid="song-index-stats">
          <div>
            <dt className="text-ink-400">Songs</dt>
            <dd className="font-mono">{stats.songs}</dd>
          </div>
          <div>
            <dt className="text-ink-400">With a tempo</dt>
            <dd className="font-mono">{stats.withTempo}</dd>
          </div>
          <div>
            <dt className="text-ink-400">Lyrics copies</dt>
            <dd className="font-mono">{stats.byKind.lyrics.count}</dd>
          </div>
          <div>
            <dt className="text-ink-400">Size on disk</dt>
            <dd className="font-mono">{fmtBytes(stats.bytes)}</dd>
          </div>
        </dl>
      )}

      <label className="mb-4 flex cursor-pointer items-start gap-3">
        <input type="checkbox" checked={indexLocal} onChange={(e) => setUi({ indexLocal: e.target.checked })} className="mt-1 h-4 w-4 accent-[var(--color-signal)]" />
        <span className="text-sm">
          <span className="font-semibold">Learn the tempo of songs I import</span>
          <span className="block text-ink-300">Decodes the file once, faster than playing it, and remembers the beat. Used by the visuals.</span>
        </span>
      </label>

      <label className="mb-4 flex cursor-pointer items-start gap-3">
        <input type="checkbox" checked={onlineTempo} onChange={(e) => setUi({ onlineTempo: e.target.checked })} className="mt-1 h-4 w-4 accent-[var(--color-signal)]" data-testid="online-tempo" />
        <span className="text-sm">
          <span className="font-semibold">Look up a song&apos;s tempo online</span>
          <span className="block text-ink-300">For songs with no beat yet, asks Deezer&apos;s public data for the tempo (sends only the title, artist and length), then finds where the beats fall in the lyric timing. You can always tap the beat yourself in the stage&apos;s Sync tab.</span>
        </span>
      </label>

      <div className="mb-4 rounded-xl border border-ink-700 bg-ink-850 p-4">
        <h3 className="mb-1 text-sm font-semibold">Listening (for Spotify songs)</h3>
        <p className="mb-3 text-sm text-ink-300">
          Spotify does not give out its audio, so the tempo of a Spotify song can only be learned by listening while it plays in this tab. Your browser asks you to share <em>this tab</em> with its audio; the sound is analysed on the spot and thrown away, only the
          numbers are kept. Each time you play a song it learns a bit more, and once it has the beat it never listens to that song again. Two ways: this tab (for songs playing in Lyricscape&apos;s own Spotify player), or the computer&apos;s whole sound (Windows, Chrome or Edge: you share the screen with its sound; it also hears the Spotify app or other tabs, so play only the song). It is off until you switch it on, and asks again after a reload.
        </p>
        <p className="mb-3 text-xs text-ink-400">Note: analysing Spotify audio is outside Spotify&apos;s developer terms. This is a personal, local setting you chose to turn on.</p>
        <div className="flex flex-wrap items-center gap-3">
          {ix.capture === 'on' ? (
            <Button variant="outline" onClick={() => disableListening()} data-testid="listening-stop">
              Stop listening
            </Button>
          ) : (
            <>
              <Button variant="primary" onClick={() => void enableListening('tab')} disabled={!ix.captureSupported || ix.capture === 'asking'} data-testid="listening-start">
                Listen to this tab
              </Button>
              <Button variant="outline" onClick={() => void enableListening('system')} disabled={!ix.captureSupported || ix.capture === 'asking'} data-testid="listening-start-system" title="Windows, Chrome or Edge: share the screen with its sound">
                Listen to the computer&apos;s sound
              </Button>
            </>
          )}
          <span className="text-sm text-ink-300" role="status" data-testid="indexer-status">
            {!ix.captureSupported ? 'This browser cannot share tab audio.' : ix.message}
            {ix.phase === 'analysing' || ix.phase === 'listening' ? ` ${Math.round(ix.progress * 100)}%` : ''}
          </span>
        </div>
      </div>

      <Button
        variant="danger"
        onClick={async () => {
          if (!confirm('Forget everything the song index has learned (tempos, copies of lyrics, cover colours)? Imported files and playlists are not touched.')) return;
          const n = await clearIndex();
          await refresh();
          alert(`Forgot ${n} song${n === 1 ? '' : 's'}.`);
        }}
        disabled={!stats?.available}
      >
        Clear the song index
      </Button>
    </div>
  );
}
