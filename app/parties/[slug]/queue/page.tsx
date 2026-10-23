'use client';

import { useParty } from '@/components/party/PartyContext';
import { HostPlayback, SongQueue } from '@/components/party/SongQueue';
import { SongSuggest } from '@/components/party/SongSuggest';
import { searchTracks } from '@/lib/spotify/api';
import { usePlayer } from '@/lib/player/controller';

export default function PartyQueue() {
  const { snap, refresh } = useParty();
  const spotifyConnected = usePlayer((s) => s.spotify.connected);
  const mod = snap.me.role === 'host' || snap.me.role === 'cohost';
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_minmax(320px,420px)]">
      <div className="space-y-6">
        {snap.me.role === 'host' && <HostPlayback snap={snap} refresh={() => void refresh()} />}
        <SongQueue snap={snap} role={snap.me.role} refresh={() => void refresh()} />
      </div>
      <div>
        <SongSuggest eventId={snap.event.id} onAdded={() => void refresh()} extraSearch={mod && spotifyConnected ? (q) => searchTracks(q, 6) : undefined} />
      </div>
    </div>
  );
}
