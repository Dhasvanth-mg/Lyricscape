'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Play, Search, Upload, Check, Equal, X } from 'lucide-react';
import clsx from 'clsx';
import type { Track } from '@/lib/types';
import { player, usePlayer } from '@/lib/player/controller';
import { providers } from '@/lib/player/providers';
import { listLocalTracks, deleteLocalTrack } from '@/lib/library/db';
import { importFiles, type ImportResult } from '@/lib/library/import';
import { SpotifyApiError } from '@/lib/spotify/api';
import { TrackRow } from '@/components/player/TrackRow';
import { Button, Chip, Empty, PageHeader, Spinner } from '@/components/ui/bits';
import { useUi } from '@/lib/ui-store';
import { Trash2 } from 'lucide-react';

type Source = 'demo' | 'licensed' | 'spotify';

export default function ListenPage() {
  const [source, setSource] = useState<Source>('demo');
  const [q, setQ] = useState('');
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const spotifyConnected = usePlayer((s) => s.spotify.connected);
  const openStage = useUi((s) => s.openStage);
  const current = usePlayer((s) => s.track);
  const [importing, setImporting] = useState(false);
  const [report, setReport] = useState<ImportResult[]>([]);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const seq = useRef(0);

  const run = useCallback(async () => {
    const my = ++seq.current;
    setError(null);
    if (source === 'spotify' && !spotifyConnected) {
      setTracks([]);
      return;
    }
    if (source === 'spotify' && !q.trim()) {
      setTracks([]);
      return;
    }
    setLoading(true);
    try {
      const res = await providers[source].search(q);
      if (my === seq.current) setTracks(res);
    } catch (e) {
      if (my === seq.current) {
        setTracks([]);
        setError(e instanceof SpotifyApiError || e instanceof Error ? e.message : 'Search failed');
      }
    } finally {
      if (my === seq.current) setLoading(false);
    }
  }, [source, q, spotifyConnected]);

  useEffect(() => {
    const t = setTimeout(() => void run(), q ? 350 : 0);
    return () => clearTimeout(t);
  }, [run, q]);

  const doImport = async (files: File[]) => {
    if (!files.length) return;
    setImporting(true);
    setReport([]);
    const res = await importFiles(files);
    setReport(res);
    setImporting(false);
    setSource('licensed');
    setQ('');
    void run();
  };

  return (
    <div>
      <PageHeader eyebrow="Player" title="Listen">
        <div className="flex gap-2">
          {current && (
            <Button variant="outline" onClick={openStage}>
              Open lyrics stage
            </Button>
          )}
          {tracks.length > 0 && source !== 'spotify' && (
            <Button variant="primary" onClick={() => void player.playQueue(tracks, 0)}>
              <Play size={16} fill="currentColor" /> Play all
            </Button>
          )}
        </div>
      </PageHeader>

      <div role="tablist" aria-label="Music source" className="mb-5 flex flex-wrap items-center gap-2">
        {(
          [
            ['demo', 'Demo songs'],
            ['licensed', 'My files'],
            ['spotify', 'Spotify'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={source === id}
            onClick={() => {
              setSource(id);
              setQ('');
            }}
            className={clsx(
              'rounded-full border px-4 py-2 text-sm font-semibold transition',
              source === id ? (id === 'spotify' ? 'border-spotify bg-spotify text-black' : 'border-bone bg-bone text-ink-950') : 'border-ink-600 text-ink-200 hover:border-ink-400',
            )}
          >
            {label}
          </button>
        ))}
        <div className="relative ml-auto min-w-[220px] flex-1 sm:max-w-sm">
          <Search size={16} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={source === 'spotify' ? 'Search any Spotify song…' : 'Search…'}
            aria-label="Search"
            className="h-10 w-full rounded-full border border-ink-600 bg-ink-850 pr-4 pl-10 text-sm outline-none placeholder:text-ink-400 focus:border-aqua"
          />
        </div>
      </div>

      {source === 'demo' && (
        <p className="mb-4 text-sm text-ink-300">
          Original songs synthesized for this project (CC0). Real audio, timed lyrics and artwork, safe for every visual feature.
        </p>
      )}

      {source === 'licensed' && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            void doImport([...e.dataTransfer.files]);
          }}
          className={clsx('mb-5 flex flex-wrap items-center gap-4 rounded-2xl border border-dashed p-5 transition', drag ? 'border-aqua bg-aqua/5' : 'border-ink-600')}
        >
          <div className="flex-1">
            <p className="font-semibold">Drop audio files here (MP3, FLAC, WAV, M4A, OGG)</p>
            <p className="text-sm text-ink-300">
              Add a same-named <code className="rounded bg-ink-800 px-1">.lrc</code> file to bring timed lyrics. Import only audio you have the rights to use; files stay on this device.
            </p>
          </div>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="audio/*,.mp3,.flac,.wav,.m4a,.aac,.ogg,.opus,.lrc,.vtt,.txt"
            className="sr-only"
            onChange={(e) => {
              void doImport([...(e.target.files ?? [])]);
              e.target.value = '';
            }}
          />
          <Button variant="primary" onClick={() => fileRef.current?.click()} disabled={importing}>
            {importing ? <Spinner /> : <Upload size={16} />} Choose files
          </Button>
          {report.length > 0 && (
            <ul className="w-full space-y-1 text-sm" aria-live="polite">
              {report.map((r, i) => (
                <li key={i} className={clsx(r.status === 'added' ? 'text-aqua' : r.status === 'duplicate' ? 'text-sun' : 'text-red-300')}>
                  {r.status === 'added' ? <Check size={14} className="inline" /> : r.status === 'duplicate' ? <Equal size={14} className="inline" /> : <X size={14} className="inline" />} {r.fileName}
                  {r.message ? ` — ${r.message}` : ''}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {source === 'spotify' && !spotifyConnected && (
        <Empty
          title="Connect Spotify"
          action={
            <Link href="/settings" className="inline-flex h-10 items-center rounded-full bg-spotify px-5 text-sm font-semibold text-black">
              Connect in Settings
            </Link>
          }
        >
          Sign in once (official Spotify login) to search any song, play it, and have lyrics follow along. You can also leave Spotify playing on your phone and just watch the lyrics here.
        </Empty>
      )}

      {source === 'spotify' && spotifyConnected && (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-spotify/30 bg-spotify/5 p-4 text-sm">
          <Chip tone="spotify">Following Spotify</Chip>
          <span className="flex-1 text-ink-200">Play anything in the Spotify app or on any device and Lyricscape picks it up automatically for lyrics.</span>
          <Button size="sm" onClick={openStage} disabled={!current}>
            Open lyrics stage
          </Button>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 py-6 text-sm text-ink-300">
          <Spinner /> Searching…
        </div>
      )}
      {error && (
        <div role="alert" className="mb-4 rounded-xl border border-red-500/30 bg-red-950/40 p-4 text-sm text-red-200">
          {error}
        </div>
      )}

      {!loading && tracks.length === 0 && !error && source === 'spotify' && spotifyConnected && !q && (
        <Empty title="Search Spotify">Type a song or artist above. Results play through your connected Spotify device.</Empty>
      )}
      {!loading && tracks.length === 0 && !error && source === 'spotify' && spotifyConnected && q && <Empty title="No results">Nothing on Spotify matched “{q}”.</Empty>}
      {!loading && tracks.length === 0 && source === 'licensed' && !q && report.length === 0 && (
        <Empty title="No files yet">Import a song above to play it with full visual features: beat sync, mixing and export.</Empty>
      )}

      {tracks.length > 0 && (
        <ul className="space-y-0.5">
          {tracks.map((t, i) => (
            <TrackRow
              key={t.id}
              track={t}
              context={source === 'spotify' ? undefined : tracks}
              index={i}
              extra={
                source === 'licensed' ? (
                  <button
                    aria-label={`Remove ${t.title} from library`}
                    className="rounded-full p-2 text-ink-400 opacity-0 transition group-hover:opacity-100 hover:text-red-300 focus:opacity-100"
                    onClick={async () => {
                      await deleteLocalTrack(t.id);
                      setTracks(await listLocalTracks().then((l) => l.map((s) => s.track)));
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                ) : null
              }
            />
          ))}
        </ul>
      )}
    </div>
  );
}
