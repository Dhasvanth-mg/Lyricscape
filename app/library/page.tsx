'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ListPlus, Play, Plus, Trash2 } from 'lucide-react';
import type { Track } from '@/lib/types';
import { deletePlaylist, getPlaylist, listLocalTracks, listLyricsIds, listPlaylists, putPlaylist, type StoredPlaylist } from '@/lib/library/db';
import { loadDemoCatalog } from '@/lib/player/providers';
import { player, usePlayer } from '@/lib/player/controller';
import { TrackRow } from '@/components/player/TrackRow';
import { Button, Empty, IconButton, PageHeader } from '@/components/ui/bits';

export default function LibraryPage() {
  const [playlists, setPlaylists] = useState<StoredPlaylist[]>([]);
  const [files, setFiles] = useState<Track[]>([]);
  const [withLyrics, setWithLyrics] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const current = usePlayer((s) => s.track);
  const [demo, setDemo] = useState<Track[]>([]);

  const refresh = useCallback(async () => {
    setPlaylists(await listPlaylists());
    setFiles((await listLocalTracks()).map((s) => s.track));
    setWithLyrics(await listLyricsIds());
  }, []);

  useEffect(() => {
    void refresh();
    void loadDemoCatalog().then(setDemo).catch(() => undefined);
    const h = () => void refresh();
    window.addEventListener('lyricscape:playlists', h);
    window.addEventListener('lyricscape:lyrics', h);
    return () => {
      window.removeEventListener('lyricscape:playlists', h);
      window.removeEventListener('lyricscape:lyrics', h);
    };
  }, [refresh]);

  const create = async (tracks: Track[] = []) => {
    const name = title.trim() || 'New playlist';
    await putPlaylist({ id: crypto.randomUUID(), title: name, trackIds: tracks.map((t) => t.id), tracks, createdAt: Date.now(), updatedAt: Date.now() });
    setTitle('');
  };

  const addCurrent = async (pl: StoredPlaylist) => {
    if (!current) return;
    const fresh = (await getPlaylist(pl.id)) ?? pl;
    if (fresh.trackIds.includes(current.id)) return;
    await putPlaylist({ ...fresh, tracks: [...fresh.tracks, current], trackIds: [...fresh.trackIds, current.id] });
  };

  return (
    <div>
      <PageHeader eyebrow="Collection" title="Library" />

      <section className="mb-10">
        <h2 className="mb-3 font-display text-3xl tracking-wide uppercase">Playlists</h2>
        <form
          className="mb-4 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void create(current ? [current] : []);
          }}
        >
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Playlist name"
            aria-label="Playlist name"
            maxLength={80}
            className="h-10 min-w-[220px] flex-1 rounded-full border border-ink-600 bg-ink-850 px-4 text-sm outline-none focus:border-aqua sm:max-w-xs"
          />
          <Button variant="primary" type="submit">
            <Plus size={16} /> {current ? 'Create with current song' : 'Create'}
          </Button>
        </form>
        {playlists.length === 0 ? (
          <Empty title="No playlists yet">Playlists are stored on this device and can mix demo songs, your files and Spotify tracks.</Empty>
        ) : (
          <ul className="space-y-2">
            {playlists.map((p) => (
              <li key={p.id} className="rounded-2xl border border-ink-700 bg-ink-900">
                <div className="flex items-center gap-2 p-3">
                  <button className="min-w-0 flex-1 text-left" onClick={() => setOpen(open === p.id ? null : p.id)} aria-expanded={open === p.id}>
                    <span className="block truncate font-semibold">{p.title}</span>
                    <span className="text-xs text-ink-400">{p.tracks.length} songs</span>
                  </button>
                  <IconButton label="Add current song" onClick={() => void addCurrent(p)} disabled={!current}>
                    <ListPlus size={17} />
                  </IconButton>
                  <IconButton label="Play playlist" onClick={() => p.tracks.length && void player.playQueue(p.tracks, 0)} disabled={!p.tracks.length}>
                    <Play size={17} />
                  </IconButton>
                  <IconButton label="Delete playlist" onClick={() => confirm(`Delete “${p.title}”?`) && void deletePlaylist(p.id)}>
                    <Trash2 size={17} />
                  </IconButton>
                </div>
                {open === p.id && (
                  <ul className="border-t border-ink-700 p-2">
                    {p.tracks.length === 0 && <li className="p-3 text-sm text-ink-400">Empty. Play a song, then use “Add current song”.</li>}
                    {p.tracks.map((t, i) => (
                      <TrackRow
                        key={t.id}
                        track={t}
                        index={i}
                        context={p.tracks}
                        extra={
                          <button
                            aria-label={`Remove ${t.title}`}
                            className="rounded-full p-2 text-ink-400 hover:text-red-300"
                            onClick={() => putPlaylist({ ...p, tracks: p.tracks.filter((x) => x.id !== t.id), trackIds: p.trackIds.filter((x) => x !== t.id) })}
                          >
                            <Trash2 size={14} />
                          </button>
                        }
                      />
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-10">
        <h2 className="mb-3 font-display text-3xl tracking-wide uppercase">My files</h2>
        {files.length === 0 ? (
          <Empty
            title="No imported files"
            action={
              <Link href="/listen" className="inline-flex h-10 items-center rounded-full bg-bone px-5 text-sm font-semibold text-ink-950">
                Import in Listen
              </Link>
            }
          />
        ) : (
          <ul>
            {files.map((t) => (
              <TrackRow key={t.id} track={t} context={files} extra={withLyrics.includes(t.id) ? <span className="text-[11px] text-aqua uppercase">lyrics</span> : null} />
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display text-3xl tracking-wide uppercase">Songs with saved lyrics</h2>
        <p className="text-sm text-ink-300">{withLyrics.length} songs (including Spotify tracks) have lyrics saved on this device, so they work offline next time.</p>
        {demo.length > 0 && <p className="mt-1 text-xs text-ink-400">Bundled demo songs ship with their own timed lyrics.</p>}
      </section>
    </div>
  );
}
