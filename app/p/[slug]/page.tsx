'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { usePartyRoom } from '@/lib/party/client';
import { describeError } from '@/components/party/PartyContext';
import { SongQueue } from '@/components/party/SongQueue';
import { SongSuggest } from '@/components/party/SongSuggest';
import { Uploader } from '@/components/party/Uploader';
import { MediaGrid } from '@/components/party/MediaGrid';
import { Chip, Spinner } from '@/components/ui/bits';

/** The guest's party room: mobile-first, two tabs, big touch targets. */
export default function GuestRoom({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { snap, error, loading, connected, refresh } = usePartyRoom(slug);
  const [tab, setTab] = useState<'songs' | 'photos'>('songs');

  if (loading)
    return (
      <div className="flex min-h-dvh items-center justify-center gap-2 text-ink-300">
        <Spinner /> Loading…
      </div>
    );
  if (error || !snap) {
    const d = describeError(error ?? ({ status: 500, code: 'x', message: 'Unknown error' } as never));
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5">
        <h1 className="mb-2 font-display text-4xl uppercase">{d.title}</h1>
        <p className="text-ink-300">{d.body}</p>
      </main>
    );
  }

  const mod = snap.me.role === 'host' || snap.me.role === 'cohost';
  const closed = snap.event.status === 'ended' || snap.event.status === 'archived';
  const canUpload = mod || snap.event.settings.guestUploads !== 'off';

  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-4 pt-5 pb-24">
      <header className="mb-4">
        <div className="mb-1 flex items-center gap-2">
          <Chip tone={snap.event.status === 'live' ? 'good' : 'default'}>{snap.event.status}</Chip>
          <span className={clsx('text-xs', connected ? 'text-aqua' : 'text-ink-400')}>{connected ? '● live' : '○ reconnecting…'}</span>
          {mod && (
            <Link href={`/parties/${slug}`} className="ml-auto text-xs underline">
              host dashboard
            </Link>
          )}
        </div>
        <h1 className="font-display text-5xl leading-none tracking-wide uppercase">{snap.event.title}</h1>
        <p className="mt-1 text-sm text-ink-300">Hi {snap.me.displayName} 👋</p>
      </header>

      {closed && <p className="mb-4 rounded-xl border border-ink-700 p-3 text-sm text-ink-300">This party has ended. You can still look around.</p>}

      <div role="tablist" className="sticky top-0 z-10 mb-4 grid grid-cols-2 gap-1 rounded-full bg-ink-850 p-1">
        {(
          [
            ['songs', 'Songs'],
            ['photos', 'Photos'],
          ] as const
        ).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={clsx('h-11 rounded-full text-base font-bold transition', tab === id ? 'bg-bone text-ink-950' : 'text-ink-300')}>
            {label}
            {id === 'photos' && snap.media.length > 0 && <span className="ml-1.5 text-xs opacity-60">{snap.media.length}</span>}
          </button>
        ))}
      </div>

      {tab === 'songs' && (
        <div className="space-y-5">
          {!closed && <SongSuggest eventId={snap.event.id} onAdded={() => void refresh()} />}
          <SongQueue snap={snap} role={snap.me.role} refresh={() => void refresh()} />
        </div>
      )}
      {tab === 'photos' && (
        <div className="space-y-5">
          {!closed && canUpload && <Uploader eventId={snap.event.id} onUploaded={() => void refresh()} compact />}
          {!closed && !canUpload && <p className="rounded-xl border border-ink-700 p-4 text-sm text-ink-300">The host turned uploads off.</p>}
          <MediaGrid eventId={snap.event.id} media={snap.media} role={snap.me.role} meId={snap.me.memberId} onChange={() => void refresh()} />
        </div>
      )}
    </main>
  );
}
