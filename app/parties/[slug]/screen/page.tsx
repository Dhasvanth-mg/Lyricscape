'use client';

import { Suspense, use, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Maximize } from 'lucide-react';
import clsx from 'clsx';
import { usePartyRoom } from '@/lib/party/client';
import type { DisplaySnapshot, MediaDto } from '@/lib/party/schemas';
import { QrImage } from '@/components/party/SharePanel';

type Snap = DisplaySnapshot & { joinToken?: string };

function Slideshow({ media }: { media: MediaDto[] }) {
  const [idx, setIdx] = useState(0);
  const [fresh, setFresh] = useState<string | null>(null);
  const seen = useRef<Set<string>>(new Set());
  const queueFront = useRef<string[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);

  // new approvals jump the line, so people see their photo appear within seconds
  useEffect(() => {
    const ids = new Set(media.map((m) => m.id));
    const added = media.filter((m) => !seen.current.has(m.id) && seen.current.size > 0).map((m) => m.id);
    seen.current = ids;
    if (added.length) queueFront.current.push(...added);
  }, [media]);

  const current = media[Math.min(idx, Math.max(0, media.length - 1))];
  const next = () => {
    const jump = queueFront.current.shift();
    if (jump) {
      const i = media.findIndex((m) => m.id === jump);
      if (i >= 0) {
        setFresh(jump);
        setTimeout(() => setFresh(null), 4000);
        return setIdx(i);
      }
    }
    setIdx((i) => (media.length ? (i + 1) % media.length : 0));
  };

  useEffect(() => {
    if (!current) return;
    if (current.mediaType === 'video') return; // advances on 'ended' / safety timeout below
    const t = setTimeout(next, 7000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, media.length]);

  useEffect(() => {
    if (current?.mediaType !== 'video') return;
    const t = setTimeout(next, 30000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  if (!current) {
    return (
      <div className="flex h-full items-center justify-center text-center">
        <div>
          <p className="font-display text-6xl uppercase">Scan to add photos</p>
          <p className="mt-3 text-2xl text-ink-300">Approved photos and videos show up here live.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      {current.mediaType === 'image' ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={current.id} src={current.url} alt="" className="kenburns absolute inset-0 h-full w-full object-contain animate-rise" />
      ) : (
        <video key={current.id} ref={videoRef} src={current.url} autoPlay muted playsInline onEnded={next} className="absolute inset-0 h-full w-full object-contain" />
      )}
      <div className="absolute bottom-6 left-6 rounded-full bg-black/60 px-4 py-2 text-lg backdrop-blur">
        {fresh === current.id && <span className="mr-2 font-bold text-signal">NEW</span>}
        {current.uploaderName}
      </div>
    </div>
  );
}

function Screen({ slug }: { slug: string }) {
  const d = useSearchParams().get('d');
  const { snap, error, connected } = usePartyRoom<Snap>(slug, d ?? 'missing');
  const [origin, setOrigin] = useState('');
  const [chromeHidden, setChromeHidden] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
    let t: ReturnType<typeof setTimeout>;
    const wake = () => {
      setChromeHidden(false);
      clearTimeout(t);
      t = setTimeout(() => setChromeHidden(true), 4000);
    };
    wake();
    window.addEventListener('mousemove', wake);
    return () => {
      window.removeEventListener('mousemove', wake);
      clearTimeout(t);
    };
  }, []);

  const byId = useMemo(() => new Map((snap?.requests ?? []).map((r) => [r.id, r])), [snap]);

  if (!d) return <Message title="Missing display link" body="Open the big screen from the party page (host only)." />;
  if (error) return <Message title="Screen unavailable" body={error.status === 404 ? 'This display link is invalid or has expired. Open it again from the party page.' : error.message} />;
  if (!snap) return <Message title="Loading…" body="" />;

  const upNext = snap.queue
    .map((id) => byId.get(id))
    .filter((r) => r && r.status === 'approved')
    .slice(0, 5);
  const joinLink = snap.joinToken && origin ? `${origin}/join/${snap.joinToken}` : null;

  return (
    <div className={clsx('fixed inset-0 grid grid-cols-[1fr_minmax(340px,28vw)] bg-ink-950 text-bone', chromeHidden && 'cursor-none')} data-testid="big-screen">
      <div className="relative min-w-0">
        <Slideshow media={snap.media.filter((m) => m.status === 'approved')} />
        <div className="absolute top-6 left-6 rounded-full bg-black/60 px-5 py-2 font-display text-3xl tracking-wide uppercase backdrop-blur">{snap.event.title}</div>
      </div>
      <aside className="flex min-h-0 flex-col gap-6 border-l border-ink-800 bg-ink-900 p-6">
        <section>
          <p className="mb-1 font-mono text-xs tracking-[0.2em] text-signal uppercase">Now playing</p>
          {snap.nowPlaying ? (
            <>
              <p className="font-display text-5xl leading-none tracking-wide uppercase">{snap.nowPlaying.track.title}</p>
              <p className="mt-2 text-xl text-ink-200">{snap.nowPlaying.track.artists.join(', ')}</p>
            </>
          ) : (
            <p className="text-xl text-ink-300">Waiting for the next song…</p>
          )}
        </section>
        <section className="min-h-0 flex-1 overflow-hidden">
          <p className="mb-2 font-mono text-xs tracking-[0.2em] text-ink-300 uppercase">Up next</p>
          <ol className="space-y-3">
            {upNext.length === 0 && <li className="text-ink-400">Scan the code to suggest a song</li>}
            {upNext.map((r, i) => (
              <li key={r!.id} className="flex items-baseline gap-3">
                <span className="font-display text-2xl text-ink-500">{i + 1}</span>
                <span className="min-w-0">
                  <span className="block truncate text-xl font-semibold">{r!.track.title}</span>
                  <span className="block truncate text-sm text-ink-300">
                    {r!.track.artists[0]} · {r!.requesterName}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </section>
        {joinLink && (
          <section className="flex items-center gap-4 rounded-2xl bg-white p-3 text-ink-950">
            <QrImage url={joinLink} size={132} />
            <p className="text-lg leading-tight font-bold">
              Scan to join,
              <br />
              add songs &amp; photos
            </p>
          </section>
        )}
        <div className="flex items-center justify-between text-xs text-ink-400">
          <span className={connected ? 'text-aqua' : ''}>{connected ? '● live' : '○ reconnecting'}</span>
          <button
            className={clsx('inline-flex items-center gap-1 transition-opacity', chromeHidden && 'opacity-0')}
            onClick={() => (document.fullscreenElement ? void document.exitFullscreen() : void document.documentElement.requestFullscreen())}
          >
            <Maximize size={12} /> fullscreen
          </button>
        </div>
      </aside>
      <style>{`.kenburns{animation:kb 9s ease-out both}@keyframes kb{from{transform:scale(1)}to{transform:scale(1.06)}}@media (prefers-reduced-motion:reduce){.kenburns{animation:none}}`}</style>
    </div>
  );
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center p-8 text-center">
      <div>
        <p className="font-display text-5xl uppercase">{title}</p>
        <p className="mt-3 text-ink-300">{body}</p>
      </div>
    </div>
  );
}

export default function ScreenPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  return (
    <Suspense>
      <Screen slug={slug} />
    </Suspense>
  );
}
