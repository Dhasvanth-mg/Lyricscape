'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, useMe } from '@/lib/party/client';
import { Button, PageHeader } from '@/components/ui/bits';

function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get('next') ?? '/parties';
  const { me, refresh } = useMe();
  const [handle, setHandle] = useState('');
  const [name, setName] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await api('POST', '/api/auth/local', { handle, displayName: name || handle });
      await refresh();
      router.push(next.startsWith('/') ? next : '/parties');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-md">
      <PageHeader eyebrow="Local profile" title="Sign in" />
      <p className="mb-6 text-sm text-ink-300">
        Lyricscape is running locally, so there are no passwords or cloud accounts: pick a handle for this machine. It identifies you as a party host and keeps your parties together. (Cloud sign-in via Supabase Auth plugs in here later.)
      </p>
      {me ? (
        <div className="space-y-4">
          <p>
            Signed in as <strong>{me.displayName}</strong> <span className="text-ink-400">@{me.handle}</span>
          </p>
          <div className="flex gap-2">
            <Button variant="primary" onClick={() => router.push(next.startsWith('/') ? next : '/parties')}>
              Continue
            </Button>
            <Button
              onClick={async () => {
                await api('DELETE', '/api/auth/local');
                await refresh();
              }}
            >
              Sign out
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm">
            <span className="mb-1 block text-ink-300">Handle</span>
            <input
              value={handle}
              onChange={(e) => setHandle(e.target.value.toLowerCase())}
              required
              minLength={3}
              maxLength={24}
              pattern="[a-zA-Z0-9_]{3,24}"
              autoComplete="username"
              placeholder="maya_b"
              className="h-11 w-full rounded-lg border border-ink-600 bg-ink-850 px-3 outline-none focus:border-aqua"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-ink-300">Display name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Maya" className="h-11 w-full rounded-lg border border-ink-600 bg-ink-850 px-3 outline-none focus:border-aqua" />
          </label>
          {err && (
            <p role="alert" className="text-sm text-red-300">
              {err}
            </p>
          )}
          <Button variant="primary" size="lg" type="submit" disabled={busy || handle.length < 3}>
            Continue
          </Button>
        </form>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
