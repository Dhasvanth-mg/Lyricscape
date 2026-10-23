'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError, api } from '@/lib/party/client';
import { Spinner } from '@/components/ui/bits';

type Preview = { eventTitle: string; hostName: string; place?: string; startsAt?: string; status: string; needsPasscode: boolean; slug: string };

/** Low-friction guest join: one screen, one name, one tap. No account needed. */
export default function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [name, setName] = useState('');
  const [passcode, setPasscode] = useState('');
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);

  useEffect(() => {
    api<Preview>('GET', `/api/join/${token}`)
      .then(setPreview)
      .catch((e: ApiError) => setError(e));
    try {
      const saved = localStorage.getItem('lyricscape.guestName');
      if (saved) setName(saved);
    } catch {
      /* ignore */
    }
  }, [token]);

  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFormErr(null);
    try {
      const r = await api<{ slug: string; role: string }>('POST', '/api/events/_/join', { token, displayName: name, passcode: passcode || undefined });
      try {
        localStorage.setItem('lyricscape.guestName', name);
      } catch {
        /* ignore */
      }
      router.replace(r.role === 'member' ? `/p/${r.slug}` : `/p/${r.slug}`);
    } catch (err) {
      setFormErr((err as Error).message);
      setBusy(false);
    }
  };

  const ended = preview && (preview.status === 'ended' || preview.status === 'archived');

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <p className="mb-6 font-display text-2xl tracking-wide uppercase">
        Lyric<span className="text-signal">scape</span>
      </p>
      {!preview && !error && (
        <div className="flex items-center gap-2 text-ink-300">
          <Spinner /> Opening invite…
        </div>
      )}
      {error && (
        <div role="alert">
          <h1 className="mb-2 font-display text-4xl uppercase">
            {error.code === 'invite_revoked' ? 'Link turned off' : error.code === 'invite_expired' ? 'Link expired' : 'Invite not valid'}
          </h1>
          <p className="text-ink-300">{error.message}. Ask the host for a fresh link.</p>
        </div>
      )}
      {preview && (
        <>
          <p className="mb-1 font-mono text-[11px] tracking-[0.2em] text-signal uppercase">You&apos;re invited</p>
          <h1 className="font-display text-6xl leading-[0.95] tracking-wide uppercase">{preview.eventTitle}</h1>
          <p className="mt-3 text-ink-300">
            Hosted by {preview.hostName}
            {preview.place ? ` · ${preview.place}` : ''}
            {preview.startsAt ? ` · ${new Date(preview.startsAt).toLocaleString()}` : ''}
          </p>
          {ended ? (
            <p className="mt-8 rounded-xl border border-ink-700 p-4 text-ink-300">This party has ended.</p>
          ) : (
            <form onSubmit={join} className="mt-8 space-y-4">
              <label className="block text-sm">
                <span className="mb-1 block text-ink-300">Your name (shown to the host and guests)</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={40}
                  autoFocus
                  autoComplete="nickname"
                  placeholder="e.g. Alex"
                  className="h-14 w-full rounded-xl border border-ink-600 bg-ink-850 px-4 text-lg outline-none focus:border-aqua"
                />
              </label>
              {preview.needsPasscode && (
                <label className="block text-sm">
                  <span className="mb-1 block text-ink-300">Party passcode</span>
                  <input value={passcode} onChange={(e) => setPasscode(e.target.value)} required inputMode="text" autoComplete="off" className="h-14 w-full rounded-xl border border-ink-600 bg-ink-850 px-4 text-lg outline-none focus:border-aqua" />
                </label>
              )}
              {formErr && (
                <p role="alert" className="text-sm text-red-300">
                  {formErr}
                </p>
              )}
              <button
                type="submit"
                disabled={busy || !name.trim()}
                className="h-14 w-full rounded-full bg-signal text-lg font-bold text-white transition active:scale-[0.98] disabled:opacity-40"
              >
                {busy ? 'Joining…' : 'Join party'}
              </button>
              <p className="text-xs text-ink-400">No account needed. By joining you agree that photos and videos you upload can be seen by the host and, once approved, other guests and the big screen.</p>
            </form>
          )}
        </>
      )}
    </main>
  );
}
