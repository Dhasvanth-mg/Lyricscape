'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ApiError, useMe } from '@/lib/party/client';
import type { PostDto } from '@/lib/server/social';
import { PostCard } from '@/components/social/PostCard';
import { Button, Chip, Empty, PageHeader, Spinner } from '@/components/ui/bits';

type Profile = { handle: string; displayName: string; memberSince: string; isMe: boolean; relationship: 'none' | 'friends' | 'requested' | 'incoming'; friendshipId: string | null; posts: PostDto[] };

export default function ProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = use(params);
  const { me } = useMe();
  const [p, setP] = useState<Profile | null>(null);
  const [err, setErr] = useState<ApiError | null>(null);

  const load = useCallback(async () => {
    try {
      setP(await api<Profile>('GET', `/api/social/profile/${encodeURIComponent(handle)}`));
      setErr(null);
    } catch (e) {
      setErr(e as ApiError);
    }
  }, [handle]);
  useEffect(() => void load(), [load, me]);

  if (err) return <Empty title="Profile not found">This person doesn&apos;t exist, or isn&apos;t available to you.</Empty>;
  if (!p) return <Spinner />;

  return (
    <div>
      <PageHeader eyebrow={`@${p.handle}`} title={p.displayName}>
        {me && !p.isMe && (
          <div className="flex flex-wrap gap-2">
            {p.relationship === 'none' && <Button variant="primary" onClick={() => void api('POST', '/api/social/friends', { handle: p.handle }).then(load).catch((e) => alert(e.message))}>Add friend</Button>}
            {p.relationship === 'requested' && <Chip tone="warn">request sent</Chip>}
            {p.relationship === 'incoming' && p.friendshipId && <Button variant="primary" onClick={() => void api('PATCH', `/api/social/friends/${p.friendshipId}`, { accept: true }).then(load)}>Accept request</Button>}
            {p.relationship === 'friends' && <Chip tone="good">friends</Chip>}
            <Button variant="danger" onClick={() => confirm(`Block @${p.handle}? You will no longer see each other's posts.`) && void api('POST', '/api/social/blocks', { handle: p.handle }).then(load)}>
              Block
            </Button>
          </div>
        )}
      </PageHeader>
      <p className="mb-6 text-sm text-ink-400">Here since {new Date(p.memberSince).toLocaleDateString()}</p>
      {p.posts.length === 0 ? (
        <Empty title="Nothing to see">{me ? 'No posts you can see yet.' : <>Only public posts are visible when signed out. <Link className="underline" href={`/login?next=/profile/${p.handle}`}>Sign in</Link> to see more.</>}</Empty>
      ) : (
        <ul className="max-w-2xl space-y-3">
          {p.posts.map((post) => (
            <li key={post.id}>
              <PostCard post={post} onChange={() => void load()} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
