'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Ban, Crown } from 'lucide-react';
import { useParty } from '@/components/party/PartyContext';
import { SharePanel } from '@/components/party/SharePanel';
import { api } from '@/lib/party/client';
import type { EventSettings, EventStatus } from '@/lib/party/schemas';
import { Button, Chip } from '@/components/ui/bits';

type Report = { id: string; targetType: string; targetId: string; reason: string; createdAt: string };

export default function PartyOverview() {
  const { snap, refresh, slug } = useParty();
  const router = useRouter();
  const e = snap.event;
  const role = snap.me.role;
  const host = role === 'host';
  const mod = host || role === 'cohost';
  const [err, setErr] = useState<string | null>(null);
  const [reports, setReports] = useState<Report[]>([]);

  const pendingSongs = snap.requests.filter((r) => r.status === 'pending').length;
  const pendingMedia = snap.media.filter((m) => m.status === 'pending').length;

  const loadReports = useCallback(async () => {
    if (!mod) return;
    try {
      setReports((await api<{ reports: Report[] }>('GET', `/api/events/${e.id}/reports`)).reports);
    } catch {
      /* ignore */
    }
  }, [mod, e.id]);
  useEffect(() => {
    void loadReports();
  }, [loadReports, snap.seq]);

  const act = async (fn: () => Promise<unknown>) => {
    setErr(null);
    try {
      await fn();
      await refresh();
    } catch (x) {
      setErr((x as Error).message);
    }
  };

  const setStatus = (status: EventStatus) => act(() => api('PATCH', `/api/events/${e.id}`, { status }));
  const setSettings = (settings: Partial<EventSettings>) => act(() => api('PATCH', `/api/events/${e.id}`, { settings }));

  // Guests who land here belong on the guest room
  useEffect(() => {
    if (snap.me.role === 'guest') router.replace(`/p/${slug}`);
  }, [snap.me.role, router, slug]);

  return (
    <div className="space-y-6">
      {err && (
        <p role="alert" className="rounded-lg border border-red-500/30 bg-red-950/40 p-3 text-sm text-red-200">
          {err}
        </p>
      )}

      {mod && (pendingSongs > 0 || pendingMedia > 0 || reports.length > 0) && (
        <section className="grid gap-3 sm:grid-cols-3" aria-label="Needs attention">
          {pendingSongs > 0 && (
            <Link href={`/parties/${slug}/queue`} className="rounded-2xl border border-sun/40 bg-sun/10 p-4">
              <p className="font-display text-3xl">{pendingSongs}</p>
              <p className="text-sm">song suggestion{pendingSongs > 1 ? 's' : ''} to approve</p>
            </Link>
          )}
          {pendingMedia > 0 && (
            <Link href={`/parties/${slug}/gallery`} className="rounded-2xl border border-sun/40 bg-sun/10 p-4">
              <p className="font-display text-3xl">{pendingMedia}</p>
              <p className="text-sm">upload{pendingMedia > 1 ? 's' : ''} to review</p>
            </Link>
          )}
          {reports.length > 0 && (
            <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4">
              <p className="font-display text-3xl">{reports.length}</p>
              <p className="text-sm">open report{reports.length > 1 ? 's' : ''}</p>
            </div>
          )}
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          {mod && <SharePanel eventId={e.id} slug={slug} />}

          {host && (
            <section className="rounded-2xl border border-ink-700 bg-ink-900 p-5">
              <h3 className="mb-3 font-display text-2xl tracking-wide uppercase">Status</h3>
              <div className="flex flex-wrap gap-2">
                {e.status !== 'live' && e.status !== 'ended' && e.status !== 'archived' && (
                  <Button variant="primary" onClick={() => void setStatus('live')}>
                    Go live
                  </Button>
                )}
                {e.status === 'live' && <Button onClick={() => void setStatus('ended')}>End party</Button>}
                {(e.status === 'ended' || e.status === 'archived') && <Button onClick={() => void setStatus('live')}>Reopen</Button>}
                {e.status === 'ended' && <Button onClick={() => void setStatus('archived')}>Archive</Button>}
              </div>
              <p className="mt-3 text-xs text-ink-400">Guests can only join and contribute while the party is scheduled or live. Ended parties keep their photos until the retention window ({e.settings.retentionDays} days).</p>
            </section>
          )}

          {host && (
            <section className="rounded-2xl border border-ink-700 bg-ink-900 p-5">
              <h3 className="mb-3 font-display text-2xl tracking-wide uppercase">Rules</h3>
              <div className="space-y-3 text-sm">
                <label className="block">
                  <span className="mb-1 block text-ink-300">Guest uploads</span>
                  <select value={e.settings.guestUploads} onChange={(ev) => void setSettings({ guestUploads: ev.target.value as EventSettings['guestUploads'] })} className="h-10 w-full rounded-lg border border-ink-600 bg-ink-850 px-3">
                    <option value="approval">Allowed, I approve each upload</option>
                    <option value="open">Allowed, show right away</option>
                    <option value="off">Off</option>
                  </select>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={e.settings.songApproval} onChange={(ev) => void setSettings({ songApproval: ev.target.checked })} className="h-4 w-4 accent-[var(--color-signal)]" />
                  Approve song suggestions first
                </label>
                <label className="block">
                  <span className="mb-1 block text-ink-300">Voting</span>
                  <select value={e.settings.songVoting} onChange={(ev) => void setSettings({ songVoting: ev.target.value as EventSettings['songVoting'] })} className="h-10 w-full rounded-lg border border-ink-600 bg-ink-850 px-3">
                    <option value="open">Everyone</option>
                    <option value="host-only">Only hosts</option>
                  </select>
                </label>
              </div>
            </section>
          )}
        </div>

        <div className="space-y-6">
          <section className="rounded-2xl border border-ink-700 bg-ink-900 p-5">
            <h3 className="mb-3 font-display text-2xl tracking-wide uppercase">People ({snap.members.length})</h3>
            <ul className="space-y-1.5">
              {snap.members.map((m) => (
                <li key={m.id} className="flex items-center gap-2 text-sm">
                  <span className={`h-2 w-2 rounded-full ${m.online ? 'bg-aqua' : 'bg-ink-600'}`} title={m.online ? 'online' : 'away'} />
                  <span className="min-w-0 flex-1 truncate">
                    {m.displayName} {m.id === snap.me.memberId && <span className="text-ink-400">(you)</span>}
                  </span>
                  {m.role === 'host' ? <Crown size={14} className="text-sun" aria-label="host" /> : <Chip>{m.role}</Chip>}
                  {mod && m.role !== 'host' && m.id !== snap.me.memberId && !(m.role === 'cohost' && !host) && (
                    <button
                      aria-label={`Remove ${m.displayName}`}
                      className="rounded-full p-1.5 text-ink-400 hover:text-red-300"
                      onClick={() => confirm(`Remove ${m.displayName}? Their pending uploads and suggestions are hidden.`) && void act(() => api('DELETE', `/api/events/${e.id}/members/${m.id}`))}
                    >
                      <Ban size={14} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>

          {mod && reports.length > 0 && (
            <section className="rounded-2xl border border-red-500/30 bg-ink-900 p-5">
              <h3 className="mb-3 font-display text-2xl tracking-wide uppercase">Reports</h3>
              <ul className="space-y-2 text-sm">
                {reports.map((r) => (
                  <li key={r.id}>
                    <span className="text-ink-400">{r.targetType}</span>: {r.reason}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="rounded-2xl border border-ink-700 bg-ink-900 p-5 text-sm text-ink-300">
            <h3 className="mb-2 font-display text-2xl tracking-wide text-bone uppercase">Details</h3>
            <p>Hosted by {e.hostName}</p>
            {e.place && <p>Where: {e.place}</p>}
            {e.startsAt && <p>When: {new Date(e.startsAt).toLocaleString()}</p>}
            {e.hasPasscode && <p>Passcode protected</p>}
          </section>

          {host && (
            <section className="rounded-2xl border border-red-500/30 bg-ink-900 p-5">
              <h3 className="mb-2 font-display text-2xl tracking-wide uppercase">Danger zone</h3>
              <p className="mb-3 text-sm text-ink-300">Deleting removes the party, every upload and all suggestions permanently.</p>
              <Button
                variant="danger"
                onClick={() => {
                  if (confirm(`Delete “${e.title}” and all its photos, videos and songs? This cannot be undone.`)) {
                    void api('DELETE', `/api/events/${e.id}`).then(() => router.push('/parties'));
                  }
                }}
              >
                Delete party
              </Button>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
