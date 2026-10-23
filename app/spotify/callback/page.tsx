'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { completeLogin } from '@/lib/spotify/auth';

export default function SpotifyCallback() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return; // React strict mode double-invoke: the auth code is single use
    ran.current = true;
    completeLogin(window.location.search)
      .then(() => router.replace('/listen'))
      .catch((e: Error) => setError(e.message));
  }, [router]);

  return (
    <div className="flex min-h-dvh items-center justify-center p-6 text-center">
      {error ? (
        <div className="max-w-md space-y-4">
          <h1 className="font-display text-4xl uppercase">Spotify login failed</h1>
          <p className="text-ink-200">{error}</p>
          <Link href="/settings" className="inline-flex h-10 items-center rounded-full bg-bone px-5 text-sm font-semibold text-ink-950">
            Back to Settings
          </Link>
        </div>
      ) : (
        <p className="text-ink-200">Finishing Spotify login…</p>
      )}
    </div>
  );
}
