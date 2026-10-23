'use client';

import { useEffect, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import type { Track } from '@/lib/types';
import { api } from '@/lib/party/client';
import { loadDemoCatalog } from '@/lib/player/providers';
import { parseSpotifyTrackId, refFromTrack } from '@/lib/party/tracks';
import type { TrackRef } from '@/lib/party/schemas';
import { Cover } from '@/components/ui/Cover';
import { Button } from '@/components/ui/bits';

type Props = { eventId: string; onAdded: () => void; /** optional extra source (host's Spotify search) */ extraSearch?: (q: string) => Promise<Track[]> };

/** Guests suggest by picking a catalog song, pasting a Spotify link, or typing "title – artist". */
export function SongSuggest({ eventId, onAdded, extraSearch }: Props) {
  const [q, setQ] = useState('');
  const [catalog, setCatalog] = useState<Track[]>([]);
  const [extra, setExtra] = useState<Track[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void loadDemoCatalog().then(setCatalog).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!extraSearch || q.trim().length < 2) return setExtra([]);
    const t = setTimeout(() => void extraSearch(q).then(setExtra).catch(() => setExtra([])), 400);
    return () => clearTimeout(t);
  }, [q, extraSearch]);

  const submit = async (ref: TrackRef) => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await api<{ duplicate: boolean; status: string }>('POST', `/api/events/${eventId}/song-requests`, ref);
      setMsg({
        ok: true,
        text: r.duplicate ? 'Already suggested. We counted your vote instead.' : r.status === 'pending' ? 'Sent! Waiting for the host to approve.' : 'Added to the queue!',
      });
      setQ('');
      onAdded();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const spotifyId = parseSpotifyTrackId(q);
  const matches = q.trim() ? catalog.filter((t) => `${t.title} ${t.artists.join(' ')}`.toLowerCase().includes(q.toLowerCase())) : catalog;
  const typed = q.split(/\s[-–—]\s/);

  return (
    <div className="rounded-2xl border border-ink-700 bg-ink-900 p-4">
      <h3 className="mb-3 font-display text-2xl tracking-wide uppercase">Suggest a song</h3>
      <div className="relative mb-3">
        <Search size={16} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search, paste a Spotify link, or type “Song – Artist”"
          aria-label="Song to suggest"
          maxLength={200}
          className="h-11 w-full rounded-full border border-ink-600 bg-ink-850 pr-4 pl-10 text-sm outline-none focus:border-aqua"
        />
      </div>

      <ul className="max-h-72 space-y-1 overflow-y-auto">
        {[...extra, ...matches].slice(0, 12).map((t) => (
          <li key={t.id} className="flex items-center gap-3 rounded-xl p-1.5 hover:bg-ink-850">
            <Cover track={t} className="h-10 w-10 text-sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{t.title}</p>
              <p className="truncate text-xs text-ink-300">{t.artists.join(', ')}</p>
            </div>
            <Button size="sm" disabled={busy} onClick={() => void submit(refFromTrack(t))} aria-label={`Suggest ${t.title}`}>
              <Plus size={14} /> Suggest
            </Button>
          </li>
        ))}
      </ul>

      {spotifyId && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-spotify/30 bg-spotify/5 p-3 text-sm">
          <span className="flex-1">Spotify link detected.</span>
          <TitleForLink onSubmit={(title, artist) => void submit({ provider: 'spotify', providerTrackId: spotifyId, title, artists: [artist || 'Unknown artist'], externalUrl: `https://open.spotify.com/track/${spotifyId}` })} busy={busy} />
        </div>
      )}
      {!spotifyId && q.trim().length >= 3 && (
        <div className="mt-3 flex items-center gap-2 text-sm">
          <span className="min-w-0 flex-1 truncate text-ink-300">
            Not listed? Suggest “{typed[0]}”{typed[1] ? ` by ${typed[1]}` : ''}
          </span>
          <Button size="sm" disabled={busy} onClick={() => void submit({ provider: 'spotify', title: typed[0]!.trim(), artists: [typed[1]?.trim() || 'Unknown artist'] })}>
            <Plus size={14} /> Suggest
          </Button>
        </div>
      )}
      {msg && (
        <p role="status" className={msg.ok ? 'mt-3 text-sm text-aqua' : 'mt-3 text-sm text-red-300'}>
          {msg.text}
        </p>
      )}
    </div>
  );
}

function TitleForLink({ onSubmit, busy }: { onSubmit: (title: string, artist: string) => void; busy: boolean }) {
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  return (
    <form
      className="flex flex-wrap gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (title.trim()) onSubmit(title.trim(), artist.trim());
      }}
    >
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Song title" aria-label="Song title" required maxLength={160} className="h-8 w-32 rounded-lg border border-ink-600 bg-ink-850 px-2 text-xs" />
      <input value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="Artist" aria-label="Artist" maxLength={120} className="h-8 w-28 rounded-lg border border-ink-600 bg-ink-850 px-2 text-xs" />
      <Button size="sm" type="submit" disabled={busy || !title.trim()}>
        Add
      </Button>
    </form>
  );
}
