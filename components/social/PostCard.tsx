'use client';

import Link from 'next/link';
import { Flag, Flame, Heart, Play, ThumbsUp, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import type { PostDto } from '@/lib/server/social';
import { api } from '@/lib/party/client';
import { loadDemoCatalog } from '@/lib/player/providers';
import { playerTrackFromRef } from '@/lib/party/tracks';
import { player } from '@/lib/player/controller';
import { Chip } from '@/components/ui/bits';

const KINDS = [
  ['like', ThumbsUp],
  ['fire', Flame],
  ['heart', Heart],
] as const;

const LABEL = { sotd: 'Song of the day', recommendation: 'Recommended to you', journal: 'Journal' } as const;

export function PostCard({ post, onChange }: { post: PostDto; onChange: () => void }) {
  const play = async () => {
    const t = playerTrackFromRef(post.track, await loadDemoCatalog().catch(() => []));
    if (t) await player.playTrack(t);
  };
  const playable = post.track.provider === 'demo' || !!post.track.providerTrackId;

  return (
    <article className="rounded-2xl border border-ink-700 bg-ink-900 p-4">
      <header className="mb-2 flex flex-wrap items-center gap-2 text-sm">
        <Link href={`/profile/${post.author.handle}`} className="font-semibold hover:underline">
          {post.author.displayName}
        </Link>
        <span className="text-ink-400">@{post.author.handle}</span>
        <Chip tone={post.kind === 'recommendation' ? 'good' : 'default'}>{post.toMe ? 'for you' : LABEL[post.kind]}</Chip>
        {post.visibility !== 'friends' && !post.toMe && <Chip>{post.visibility}</Chip>}
        <time className="ml-auto text-xs text-ink-400" dateTime={post.createdAt}>
          {new Date(post.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
        </time>
      </header>
      <div className="flex items-center gap-3">
        <button
          onClick={() => void play()}
          disabled={!playable}
          aria-label={`Play ${post.track.title}`}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-bone text-ink-950 transition hover:scale-105 disabled:opacity-30"
        >
          <Play size={18} fill="currentColor" className="translate-x-px" />
        </button>
        <div className="min-w-0">
          <p className="truncate font-display text-2xl tracking-wide uppercase">{post.track.title}</p>
          <p className="truncate text-sm text-ink-300">{post.track.artists.join(', ')}</p>
        </div>
      </div>
      {post.caption && <p className="mt-3 text-sm text-ink-200">{post.caption}</p>}
      <footer className="mt-3 flex items-center gap-1">
        {KINDS.map(([k, Icon]) => (
          <button
            key={k}
            aria-label={`${k}${post.reactions[k] ? ` (${post.reactions[k]})` : ''}`}
            aria-pressed={post.myReaction === k}
            onClick={() => void api('POST', `/api/social/posts/${post.id}/react`, { kind: post.myReaction === k ? null : k }).then(onChange)}
            className={clsx('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs transition', post.myReaction === k ? 'bg-signal/20 text-signal' : 'text-ink-300 hover:bg-ink-800')}
          >
            <Icon size={14} /> {post.reactions[k] ?? ''}
          </button>
        ))}
        <span className="flex-1" />
        {post.mine ? (
          <button aria-label="Delete post" className="p-1.5 text-ink-400 hover:text-red-300" onClick={() => confirm('Delete this post?') && void api('DELETE', `/api/social/posts/${post.id}`).then(onChange)}>
            <Trash2 size={14} />
          </button>
        ) : (
          <button
            aria-label="Report post"
            className="p-1.5 text-ink-400 hover:text-bone"
            onClick={() => {
              const reason = prompt('What is wrong with this post?');
              if (reason && reason.trim().length > 1) void api('POST', `/api/social/posts/${post.id}/report`, { reason }).then(() => alert('Thanks, we recorded your report.'));
            }}
          >
            <Flag size={13} />
          </button>
        )}
      </footer>
    </article>
  );
}
