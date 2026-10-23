'use client';

import { useParty } from '@/components/party/PartyContext';
import { MediaGrid } from '@/components/party/MediaGrid';
import { Uploader } from '@/components/party/Uploader';

export default function PartyGallery() {
  const { snap, refresh } = useParty();
  const mod = snap.me.role === 'host' || snap.me.role === 'cohost';
  const pending = snap.media.filter((m) => m.status === 'pending').length;
  const canUpload = mod || snap.event.settings.guestUploads !== 'off';
  return (
    <div className="space-y-5">
      {canUpload ? <Uploader eventId={snap.event.id} onUploaded={() => void refresh()} /> : <p className="rounded-xl border border-ink-700 p-4 text-sm text-ink-300">Uploads are turned off for this party.</p>}
      {mod && pending > 0 && <p className="rounded-xl border border-sun/40 bg-sun/10 p-3 text-sm text-sun">{pending} upload{pending > 1 ? 's' : ''} waiting for your approval. Approved photos appear on the big screen.</p>}
      <MediaGrid eventId={snap.event.id} media={snap.media} role={snap.me.role} meId={snap.me.memberId} onChange={() => void refresh()} />
    </div>
  );
}
