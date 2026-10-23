'use client';

import { ArrowDown, ArrowUp, Trash2, X } from 'lucide-react';
import clsx from 'clsx';
import { player, usePlayer } from '@/lib/player/controller';
import { playOrder } from '@/lib/player/queue';
import { useUi } from '@/lib/ui-store';
import { Cover } from '@/components/ui/Cover';
import { Button, Chip, IconButton } from '@/components/ui/bits';

export function QueueDrawer() {
  const open = useUi((s) => s.queueOpen);
  const setOpen = useUi((s) => s.setQueueOpen);
  const queue = usePlayer((s) => s.queue);
  const status = usePlayer((s) => s.status);
  if (!open) return null;

  const order = playOrder(queue);
  const byQid = new Map(queue.entries.map((e) => [e.qid, e]));

  return (
    <aside
      aria-label="Queue"
      className="fixed top-0 right-0 bottom-[calc(var(--player-h)+var(--nav-h))] z-50 flex w-full max-w-sm flex-col border-l border-ink-700 bg-ink-900/98 shadow-2xl backdrop-blur-xl animate-rise md:bottom-[var(--player-h)]"
    >
      <header className="flex items-center justify-between border-b border-ink-700 p-4">
        <div>
          <h2 className="font-display text-2xl tracking-wide uppercase">Queue</h2>
          <p className="text-xs text-ink-400">
            {queue.entries.length} tracks {queue.shuffle && '· shuffled'}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {queue.entries.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => player.clearQueue()}>
              <Trash2 size={14} /> Clear
            </Button>
          )}
          <IconButton label="Close queue" onClick={() => setOpen(false)}>
            <X size={18} />
          </IconButton>
        </div>
      </header>
      <ol className="flex-1 overflow-y-auto p-2">
        {order.length === 0 && <li className="p-6 text-center text-sm text-ink-400">The queue is empty. Add songs from Listen.</li>}
        {order.map((qid, i) => {
          const e = byQid.get(qid);
          if (!e) return null;
          const current = qid === queue.currentQid;
          const userIdx = queue.entries.findIndex((x) => x.qid === qid);
          return (
            <li key={qid} className={clsx('group flex items-center gap-3 rounded-xl p-2', current ? 'bg-ink-800' : 'hover:bg-ink-850')}>
              <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => void player.jumpToQid(qid)}>
                <span className="w-5 text-center font-mono text-[11px] text-ink-400">{current ? (status === 'playing' ? '▶' : '•') : i + 1}</span>
                <Cover track={e.track} className="h-10 w-10 shrink-0 text-sm" />
                <span className="min-w-0">
                  <span className={clsx('block truncate text-sm font-semibold', current && 'text-signal')}>{e.track.title}</span>
                  <span className="block truncate text-xs text-ink-400">{e.track.artists.join(', ')}</span>
                </span>
              </button>
              {e.track.provider === 'spotify' && <Chip tone="spotify" className="hidden sm:inline-flex">SP</Chip>}
              <div className="flex opacity-0 transition group-focus-within:opacity-100 group-hover:opacity-100">
                {!queue.shuffle && (
                  <>
                    <IconButton label="Move up" onClick={() => player.moveInQueue(qid, userIdx - 1)} disabled={userIdx === 0} className="h-7 w-7">
                      <ArrowUp size={14} />
                    </IconButton>
                    <IconButton label="Move down" onClick={() => player.moveInQueue(qid, userIdx + 1)} disabled={userIdx === queue.entries.length - 1} className="h-7 w-7">
                      <ArrowDown size={14} />
                    </IconButton>
                  </>
                )}
                <IconButton label="Remove from queue" onClick={() => player.removeFromQueue(qid)} className="h-7 w-7">
                  <X size={14} />
                </IconButton>
              </div>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
