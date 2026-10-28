'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button, Spinner } from '@/components/ui/bits';
import { TrackRow } from './TrackRow';
import { player, usePlayer } from '@/lib/player/controller';
import { readTokens } from '@/lib/spotify/auth';
import { getCollectionTracks, getPlaylists, getSavedAlbums, getSavedTracks, libraryMix, type SpotifyCollection } from '@/lib/spotify/library';
import type { Track } from '@/lib/types';

type View = 'playlists' | 'liked' | 'albums';
export function SpotifyLibrary() {
  const [view, setView] = useState<View>('playlists');
  const [collection, setCollection] = useState<SpotifyCollection | null>(null);
  const [collections, setCollections] = useState<SpotifyCollection[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [offset, setOffset] = useState<number | null>(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autofill, setAutofill] = useState(false);
  const [mixing, setMixing] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const queue = usePlayer(s => s.queue);
  const seq = useRef(0);

  useEffect(() => {
    const scopes = new Set((readTokens()?.scope ?? '').split(' '));
    setAllowed(['playlist-read-private', 'user-library-read'].every(s => scopes.has(s)));
  }, []);

  useEffect(() => {
    const request = ++seq.current;
    setCollections([]); setTracks([]); setOffset(0); setError(null);
    if (!allowed) return;
    setBusy(true);
    const load = collection ? getCollectionTracks(collection) : view === 'liked' ? getSavedTracks() : view === 'albums' ? getSavedAlbums() : getPlaylists();
    void load.then(data => {
      if (seq.current !== request) return;
      if (collection || view === 'liked') setTracks(data.items as Track[]);
      else setCollections(data.items as SpotifyCollection[]);
      setOffset(data.nextOffset);
    }).catch(e => { if (seq.current === request) setError(e instanceof Error ? e.message : 'Could not load your library.'); })
      .finally(() => { if (seq.current === request) setBusy(false); });
    return () => { seq.current = request + 1; };
  }, [view, collection, allowed]);

  async function more() {
    if (offset === null || busy) return;
    const request = seq.current;
    setBusy(true); setError(null);
    try {
      const data = collection ? await getCollectionTracks(collection, offset) : view === 'liked' ? await getSavedTracks(offset) : view === 'albums' ? await getSavedAlbums(offset) : await getPlaylists(offset);
      if (request !== seq.current) return;
      if (collection || view === 'liked') setTracks(old => [...old, ...data.items as Track[]]);
      else setCollections(old => [...old, ...data.items as SpotifyCollection[]]);
      setOffset(data.nextOffset);
    } catch (e) { if (request === seq.current) setError(e instanceof Error ? e.message : 'Could not load more.'); }
    finally { if (request === seq.current) setBusy(false); }
  }

  async function play(mix: boolean) {
    const request = seq.current;
    setMixing(true); setError(null);
    try {
      let next = [...tracks];
      let cursor = offset;
      while (cursor !== null) {
        const data = collection ? await getCollectionTracks(collection, cursor) : await getSavedTracks(cursor);
        if (seq.current !== request) return;
        next.push(...data.items);
        if (data.nextOffset !== null && data.nextOffset <= cursor) throw new Error('Spotify returned an invalid library page. Try again.');
        cursor = data.nextOffset;
      }
      if (mix) next = libraryMix(next);
      if (autofill && view !== 'liked') {
        const liked = await getSavedTracks();
        if (seq.current !== request) return;
        const known = new Set(next.map(t => t.id));
        next = [...next, ...libraryMix(liked.items.filter(t => !known.has(t.id)))];
      }
      if (usePlayer.getState().queue.shuffle) player.toggleShuffle();
      await player.playQueue(next);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not start this queue.'); }
    finally { setMixing(false); }
  }

  return <section aria-label="Spotify library" className="mb-6 space-y-4 rounded-2xl border border-ink-700 p-4">
    <h2 className="font-semibold">Your Spotify library</h2>
    {!allowed ? <p className="text-sm text-ink-300">Reconnect Spotify in <Link href="/settings" className="text-aqua underline">Settings</Link> to allow access to playlists and saved music.</p> : <>
      <div className="flex flex-wrap gap-2">
        {(['playlists', 'liked', 'albums'] as const).map(id => <Button key={id} size="sm" variant={view === id ? 'spotify' : 'outline'} onClick={() => { setView(id); setCollection(null); }}>{id === 'liked' ? 'Liked songs' : id === 'albums' ? 'Saved albums' : 'Playlists'}</Button>)}
      </div>
      {collection && <div className="flex items-center gap-3"><Button size="sm" onClick={() => setCollection(null)}>Back</Button><h3>{collection.name}</h3></div>}
      {collections.length > 0 && <div className="grid gap-2 sm:grid-cols-2">{collections.map(c => <button key={c.id} className="rounded-xl border border-ink-600 p-3 text-left text-sm hover:bg-ink-800" onClick={() => setCollection(c)}>{c.name}</button>)}</div>}
      {tracks.length > 0 && <>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="spotify" disabled={mixing || busy} onClick={() => void play(false)}>{mixing ? 'Preparing queue…' : 'Play collection'}</Button>
          <Button size="sm" disabled={mixing} onClick={() => void play(true)}>Smart library mix</Button>
          <Button size="sm" onClick={() => player.toggleShuffle()}>Shuffle: {queue.shuffle ? 'on' : 'off'}</Button>
          <Button size="sm" onClick={() => player.cycleRepeat()}>Loop: {queue.repeat}</Button>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={autofill} onChange={e => setAutofill(e.target.checked)} /> Auto queue: append up to 50 liked songs when starting this collection</label>
        <p className="text-xs text-ink-300">Playing a song queues the loaded collection. Smart library mix avoids repeated songs and adjacent artists when possible. Spotify&apos;s recommendation-based Smart Shuffle cannot be enabled through this Web API integration.</p>
        <ul>{tracks.map((t, i) => <TrackRow key={`${t.id}:${i}`} track={t} context={tracks} index={i} />)}</ul>
      </>}
      {busy && <p className="flex gap-2 text-sm"><Spinner /> Loading library…</p>}
      {!busy && !error && !tracks.length && !collections.length && <p className="text-sm text-ink-300">No accessible music here. Spotify Development Mode may restrict playlist contents. Local files and podcast episodes are skipped.</p>}
      {offset !== null && !busy && <Button size="sm" onClick={() => void more()}>Load more</Button>}
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    </>}
  </section>;
}
