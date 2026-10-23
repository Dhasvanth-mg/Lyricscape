'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { Bell, Check, UserPlus, X } from 'lucide-react';
import { api, useMe } from '@/lib/party/client';
import type { PostDto } from '@/lib/server/social';
import { refFromTrack } from '@/lib/party/tracks';
import { usePlayer } from '@/lib/player/controller';
import { PostCard } from '@/components/social/PostCard';
import { Button, Chip, Empty, PageHeader, Spinner } from '@/components/ui/bits';

type Friends = { friends: { friendshipId: string; handle: string; displayName: string }[]; incoming: Friends['friends']; outgoing: Friends['friends']; blocked: { handle: string }[] };
type Notif = { id: string; type: string; payload: Record<string, unknown>; seenAt?: string; createdAt: string };

const notifText = (n: Notif) => {
  const p = n.payload as { fromName?: string; from?: string; title?: string; kind?: string };
  const who = p.fromName ?? p.from ?? 'Someone';
  return n.type === 'friend.request' ? `${who} sent you a friend request` : n.type === 'friend.accepted' ? `${who} accepted your friend request` : n.type === 'recommendation' ? `${who} recommended “${p.title}”` : `${who} reacted to “${p.title}”`;
};

export default function DiscoverPage() {
  const { me } = useMe();
  const track = usePlayer((s) => s.track);
  const [scope, setScope] = useState<'friends' | 'public' | 'mine'>('friends');
  const [posts, setPosts] = useState<PostDto[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [friends, setFriends] = useState<Friends | null>(null);
  const [notifs, setNotifs] = useState<{ unread: number; notifications: Notif[] }>({ unread: 0, notifications: [] });
  const [loading, setLoading] = useState(true);
  const [showNotifs, setShowNotifs] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [addHandle, setAddHandle] = useState('');
  const [caption, setCaption] = useState('');
  const [vis, setVis] = useState<'friends' | 'public' | 'private'>('friends');
  const [kind, setKind] = useState<'sotd' | 'recommendation'>('sotd');
  const [toHandle, setToHandle] = useState('');
  const [info, setInfo] = useState<string | null>(null);

  const loadFeed = useCallback(async () => {
    const r = await api<{ posts: PostDto[]; nextBefore: string | null }>('GET', `/api/social/posts?scope=${scope}`);
    setPosts(r.posts);
    setNext(r.nextBefore);
  }, [scope]);
  const loadSide = useCallback(async () => {
    const [f, n] = await Promise.all([api<Friends>('GET', '/api/social/friends'), api<{ unread: number; notifications: Notif[] }>('GET', '/api/social/notifications')]);
    setFriends(f);
    setNotifs(n);
  }, []);

  useEffect(() => {
    if (!me) return setLoading(false);
    setLoading(true);
    Promise.all([loadFeed(), loadSide()])
      .catch((e) => setErr((e as Error).message))
      .finally(() => setLoading(false));
  }, [me, loadFeed, loadSide]);

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setErr(null);
    setInfo(null);
    try {
      await fn();
      if (ok) setInfo(ok);
      await Promise.all([loadFeed(), loadSide()]);
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const post = () =>
    run(
      () =>
        api('POST', '/api/social/posts', {
          kind,
          track: refFromTrack(track!),
          caption,
          visibility: kind === 'recommendation' ? 'direct' : vis,
          toHandle: kind === 'recommendation' ? toHandle : undefined,
          day: new Date().toLocaleDateString('en-CA'),
        }).then(() => setCaption('')),
      kind === 'sotd' ? 'Posted your song of the day.' : 'Recommendation sent.',
    );

  if (me === undefined || loading) return <Spinner />;
  if (!me) {
    return (
      <div>
        <PageHeader eyebrow="Social" title="Discover" />
        <Empty
          title="Sign in to share music"
          action={
            <Link href="/login?next=/discover" className="inline-flex h-10 items-center rounded-full bg-bone px-5 text-sm font-semibold text-ink-950">
              Pick a profile
            </Link>
          }
        >
          Friends, a Song of the Day and direct recommendations. Posts are friends-only by default and always in chronological order. No algorithm.
        </Empty>
      </div>
    );
  }

  return (
    <div>
      <PageHeader eyebrow="Social" title="Discover">
        <div className="relative">
          <Button
            variant="outline"
            onClick={async () => {
              setShowNotifs((v) => !v);
              if (!showNotifs && notifs.unread) await api('POST', '/api/social/notifications').then(loadSide);
            }}
            aria-expanded={showNotifs}
          >
            <Bell size={16} /> {notifs.unread > 0 && <span className="rounded-full bg-signal px-1.5 text-xs font-bold text-white">{notifs.unread}</span>} Notifications
          </Button>
          {showNotifs && (
            <ul className="absolute top-12 right-0 z-20 w-80 max-w-[90vw] space-y-1 rounded-xl border border-ink-600 bg-ink-850 p-2 shadow-2xl">
              {notifs.notifications.length === 0 && <li className="p-3 text-sm text-ink-400">Nothing yet.</li>}
              {notifs.notifications.slice(0, 12).map((n) => (
                <li key={n.id} className="rounded-lg p-2 text-sm hover:bg-ink-800">
                  {notifText(n)} <span className="text-xs text-ink-400">{new Date(n.createdAt).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PageHeader>

      {err && (
        <p role="alert" className="mb-4 rounded-lg border border-red-500/30 bg-red-950/40 p-3 text-sm text-red-200">
          {err}
        </p>
      )}
      {info && (
        <p role="status" className="mb-4 text-sm text-aqua">
          {info}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          <section className="rounded-2xl border border-ink-700 bg-ink-900 p-4" aria-label="Share a song">
            <div className="mb-3 flex gap-2">
              {(
                [
                  ['sotd', 'Song of the day'],
                  ['recommendation', 'Recommend to a friend'],
                ] as const
              ).map(([k, label]) => (
                <button key={k} onClick={() => setKind(k)} aria-pressed={kind === k} className={clsx('rounded-full border px-3.5 py-1.5 text-sm font-semibold', kind === k ? 'border-bone bg-bone text-ink-950' : 'border-ink-600 text-ink-200')}>
                  {label}
                </button>
              ))}
            </div>
            <p className="mb-2 text-sm text-ink-300">{track ? <>Sharing <strong>{track.title}</strong> by {track.artists[0]}, the song playing now.</> : 'Play a song first, then share it here.'}</p>
            <textarea value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={500} rows={2} placeholder="Say something about it (optional)" disabled={!track} className="mb-2 w-full rounded-lg border border-ink-600 bg-ink-850 p-3 text-sm outline-none focus:border-aqua" />
            <div className="flex flex-wrap items-center gap-2">
              {kind === 'sotd' ? (
                <select value={vis} onChange={(e) => setVis(e.target.value as typeof vis)} aria-label="Who can see this" className="h-9 rounded-lg border border-ink-600 bg-ink-850 px-2 text-sm">
                  <option value="friends">Friends only</option>
                  <option value="public">Public</option>
                  <option value="private">Just me</option>
                </select>
              ) : (
                <select value={toHandle} onChange={(e) => setToHandle(e.target.value)} aria-label="Send to" className="h-9 rounded-lg border border-ink-600 bg-ink-850 px-2 text-sm">
                  <option value="">Choose a friend…</option>
                  {friends?.friends.map((f) => (
                    <option key={f.friendshipId} value={f.handle}>
                      {f.displayName} (@{f.handle})
                    </option>
                  ))}
                </select>
              )}
              <Button variant="primary" size="sm" onClick={() => void post()} disabled={!track || (kind === 'recommendation' && !toHandle)}>
                Share
              </Button>
            </div>
          </section>

          <div role="tablist" className="flex gap-2">
            {(
              [
                ['friends', 'Friends'],
                ['public', 'Public'],
                ['mine', 'Mine'],
              ] as const
            ).map(([k, label]) => (
              <button key={k} role="tab" aria-selected={scope === k} onClick={() => setScope(k)} className={clsx('rounded-full border px-4 py-1.5 text-sm font-semibold', scope === k ? 'border-signal bg-signal text-white' : 'border-ink-600 text-ink-200')}>
                {label}
              </button>
            ))}
          </div>

          {posts.length === 0 ? (
            <Empty title="Quiet in here">{scope === 'friends' ? 'Add a friend and share a Song of the Day to get things going.' : 'Nothing to show yet.'}</Empty>
          ) : (
            <ul className="space-y-3">
              {posts.map((p) => (
                <li key={p.id}>
                  <PostCard post={p} onChange={() => void loadFeed()} />
                </li>
              ))}
            </ul>
          )}
          {next && (
            <Button
              onClick={async () => {
                const r = await api<{ posts: PostDto[]; nextBefore: string | null }>('GET', `/api/social/posts?scope=${scope}&before=${encodeURIComponent(next)}`);
                setPosts((cur) => [...cur, ...r.posts]);
                setNext(r.nextBefore);
              }}
            >
              Load older
            </Button>
          )}
        </div>

        <aside className="space-y-5">
          <section className="rounded-2xl border border-ink-700 bg-ink-900 p-4" aria-label="Friends">
            <h3 className="mb-3 font-display text-2xl tracking-wide uppercase">Friends</h3>
            <form
              className="mb-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void run(() => api('POST', '/api/social/friends', { handle: addHandle }).then(() => setAddHandle('')), 'Request sent.');
              }}
            >
              <input value={addHandle} onChange={(e) => setAddHandle(e.target.value)} placeholder="@handle" aria-label="Friend's handle" maxLength={30} className="h-9 min-w-0 flex-1 rounded-lg border border-ink-600 bg-ink-850 px-3 text-sm outline-none focus:border-aqua" />
              <Button size="sm" type="submit" disabled={!addHandle.trim()}>
                <UserPlus size={14} /> Add
              </Button>
            </form>
            {friends && friends.incoming.length > 0 && (
              <ul className="mb-3 space-y-1.5">
                {friends.incoming.map((f) => (
                  <li key={f.friendshipId} className="flex items-center gap-2 rounded-lg bg-ink-850 p-2 text-sm">
                    <span className="flex-1">
                      {f.displayName} <span className="text-ink-400">@{f.handle}</span>
                    </span>
                    <button aria-label={`Accept ${f.handle}`} className="rounded-full bg-aqua/20 p-1.5 text-aqua" onClick={() => void run(() => api('PATCH', `/api/social/friends/${f.friendshipId}`, { accept: true }))}>
                      <Check size={14} />
                    </button>
                    <button aria-label={`Decline ${f.handle}`} className="rounded-full p-1.5 text-ink-400 hover:text-red-300" onClick={() => void run(() => api('PATCH', `/api/social/friends/${f.friendshipId}`, { accept: false }))}>
                      <X size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <ul className="space-y-1">
              {friends?.friends.length === 0 && <li className="text-sm text-ink-400">No friends yet. Ask someone for their handle.</li>}
              {friends?.friends.map((f) => (
                <li key={f.friendshipId} className="flex items-center gap-2 text-sm">
                  <Link href={`/profile/${f.handle}`} className="flex-1 hover:underline">
                    {f.displayName} <span className="text-ink-400">@{f.handle}</span>
                  </Link>
                  <button className="text-xs text-ink-400 underline hover:text-red-300" onClick={() => confirm(`Remove ${f.displayName}?`) && void run(() => api('DELETE', `/api/social/friends/${f.friendshipId}`))}>
                    remove
                  </button>
                </li>
              ))}
            </ul>
            {friends && friends.outgoing.length > 0 && <p className="mt-3 text-xs text-ink-400">Waiting on: {friends.outgoing.map((f) => `@${f.handle}`).join(', ')}</p>}
          </section>
          <p className="text-xs text-ink-400">
            <Chip>chronological</Chip> No ranking or recommendations engine: just what your friends shared. Block or report from a profile or post.
          </p>
        </aside>
      </div>
    </div>
  );
}
