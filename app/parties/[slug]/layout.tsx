'use client';

import { use } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ExternalLink } from 'lucide-react';
import clsx from 'clsx';
import { usePartyRoom } from '@/lib/party/client';
import { PartyProvider, describeError } from '@/components/party/PartyContext';
import { Chip, Empty, Spinner } from '@/components/ui/bits';

const TABS = [
  ['', 'Overview'],
  ['/queue', 'Queue'],
  ['/gallery', 'Gallery'],
  ['/recap', 'Recap'],
] as const;

function Room({ slug, children }: { slug: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const { snap, error, loading, connected, refresh } = usePartyRoom(slug);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-10 text-ink-300">
        <Spinner /> Loading party…
      </div>
    );
  }
  if (error || !snap) {
    const d = describeError(error ?? ({ status: 500, code: 'x', message: 'Unknown error' } as never));
    return (
      <Empty
        title={d.title}
        action={
          <div className="flex gap-2">
            <Link href="/login?next=/parties" className="inline-flex h-10 items-center rounded-full bg-bone px-5 text-sm font-semibold text-ink-950">
              Sign in
            </Link>
            <Link href="/parties" className="inline-flex h-10 items-center rounded-full border border-ink-600 px-5 text-sm font-semibold">
              My parties
            </Link>
          </div>
        }
      >
        {d.body}
      </Empty>
    );
  }

  const base = `/parties/${slug}`;
  const isMod = snap.me.role === 'host' || snap.me.role === 'cohost';
  return (
    <PartyProvider value={{ slug, snap, refresh, connected }}>
      <header className="mb-6">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Chip tone={snap.event.status === 'live' ? 'good' : snap.event.status === 'scheduled' ? 'warn' : 'default'}>{snap.event.status}</Chip>
          <Chip>{snap.me.role}</Chip>
          <span className={clsx('inline-flex items-center gap-1.5 text-xs', connected ? 'text-aqua' : 'text-ink-400')} title={connected ? 'Live updates connected' : 'Reconnecting…'}>
            <span className={clsx('h-2 w-2 rounded-full', connected ? 'bg-aqua' : 'bg-ink-500')} />
            {connected ? 'live' : 'offline'}
          </span>
        </div>
        <h1 className="font-display text-5xl leading-none tracking-wide uppercase sm:text-6xl">{snap.event.title}</h1>
        {snap.event.description && <p className="mt-2 max-w-2xl text-ink-300">{snap.event.description}</p>}
      </header>
      <nav aria-label="Party sections" className="mb-6 flex flex-wrap items-center gap-1 border-b border-ink-800 pb-3">
        {TABS.map(([path, label]) => {
          const href = base + path;
          const active = pathname === href;
          return (
            <Link
              key={path}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={clsx('rounded-full px-4 py-2 text-sm font-semibold transition', active ? 'bg-bone text-ink-950' : 'text-ink-300 hover:bg-ink-800')}
            >
              {label}
            </Link>
          );
        })}
        {isMod && (
          <ScreenLink eventId={snap.event.id} slug={slug} />
        )}
      </nav>
      {children}
    </PartyProvider>
  );
}

function ScreenLink({ eventId, slug }: { eventId: string; slug: string }) {
  const open = async () => {
    const res = await fetch(`/api/events/${eventId}/display`, { method: 'POST' });
    if (!res.ok) return alert('Could not open the big screen.');
    const { url } = (await res.json()) as { url: string };
    window.open(url, '_blank', 'noopener');
  };
  return (
    <button onClick={() => void open()} className="ml-auto inline-flex items-center gap-2 rounded-full border border-ink-600 px-4 py-2 text-sm font-semibold text-ink-200 hover:border-ink-400" aria-label={`Open big screen for ${slug}`}>
      Big screen <ExternalLink size={14} />
    </button>
  );
}

export default function PartyLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const pathname = usePathname();
  if (pathname.endsWith('/screen')) return <>{children}</>;
  return <Room slug={slug}>{children}</Room>;
}
