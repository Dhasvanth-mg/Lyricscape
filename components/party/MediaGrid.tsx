'use client';
import { Icon } from '@/components/ui/Icon';

import { useState } from 'react';
import { Check, Flag, Star, Trash2, X } from 'lucide-react';
import clsx from 'clsx';
import type { MediaDto, Role } from '@/lib/party/schemas';
import { api } from '@/lib/party/client';
import { Chip, IconButton } from '@/components/ui/bits';

export function MediaGrid({ eventId, media, role, meId, onChange }: { eventId: string; media: MediaDto[]; role: Role; meId: string; onChange: () => void }) {
  const [open, setOpen] = useState<MediaDto | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const mod = role === 'host' || role === 'cohost';

  const act = async (fn: () => Promise<unknown>) => {
    setErr(null);
    try {
      await fn();
      onChange();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const visible = [...media].sort((a, b) => (a.status === 'pending' ? -1 : 0) - (b.status === 'pending' ? -1 : 0) || b.createdAt.localeCompare(a.createdAt));

  if (visible.length === 0) {
    return <p className="rounded-2xl border border-dashed border-ink-700 p-8 text-center text-sm text-ink-400">No photos or videos yet. Be the first to add one.</p>;
  }

  return (
    <div>
      {err && (
        <p role="alert" className="mb-3 text-sm text-red-300">
          {err}
        </p>
      )}
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {visible.map((m) => (
          <li key={m.id} className={clsx('group relative aspect-square overflow-hidden rounded-xl bg-ink-800', m.status === 'rejected' && 'opacity-40')}>
            <button className="absolute inset-0" onClick={() => setOpen(m)} aria-label={`Open ${m.mediaType} by ${m.uploaderName}`}>
              {m.mediaType === 'image' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.url} alt={`Photo by ${m.uploaderName}`} loading="lazy" className="h-full w-full object-cover" />
              ) : (
                <video src={m.url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
              )}
            </button>
            <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-1 p-1.5">
              {m.status !== 'approved' && <Chip tone={m.status === 'pending' ? 'warn' : 'bad'}>{m.status === 'pending' ? 'pending' : 'hidden'}</Chip>}
              {m.mustInclude && <Chip tone="good">
                <Icon id="star" size={12} className="mr-1 inline align-[-2px]" />
                recap
              </Chip>}
            </div>
            <div className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-gradient-to-t from-black/80 to-transparent p-1.5 pt-6">
              <span className="min-w-0 flex-1 truncate text-[11px] text-white/80">{m.uploaderName}</span>
              {mod && (
                <>
                  {m.status !== 'approved' && (
                    <IconButton label="Approve" className="h-7 w-7 bg-aqua/20 text-aqua" onClick={() => void act(() => api('PATCH', `/api/events/${eventId}/media/${m.id}`, { status: 'approved' }))}>
                      <Check size={14} />
                    </IconButton>
                  )}
                  {m.status !== 'rejected' && (
                    <IconButton label="Hide" className="h-7 w-7" onClick={() => void act(() => api('PATCH', `/api/events/${eventId}/media/${m.id}`, { status: 'rejected' }))}>
                      <X size={14} />
                    </IconButton>
                  )}
                  <IconButton
                    label={m.mustInclude ? 'Unpin from recap' : 'Must include in recap'}
                    active={m.mustInclude}
                    className="h-7 w-7"
                    onClick={() => void act(() => api('PATCH', `/api/events/${eventId}/media/${m.id}`, { mustInclude: !m.mustInclude }))}
                  >
                    <Star size={14} fill={m.mustInclude ? 'currentColor' : 'none'} />
                  </IconButton>
                </>
              )}
              {(mod || m.uploaderId === meId) && (
                <IconButton
                  label="Delete"
                  className="h-7 w-7"
                  onClick={() => confirm('Delete this upload permanently?') && void act(() => api('DELETE', `/api/events/${eventId}/media/${m.id}`))}
                >
                  <Trash2 size={14} />
                </IconButton>
              )}
              {!mod && m.uploaderId !== meId && (
                <IconButton
                  label="Report"
                  className="h-7 w-7"
                  onClick={() => {
                    const reason = prompt('What is wrong with this upload?');
                    if (reason && reason.trim().length > 1) void act(() => api('POST', `/api/events/${eventId}/reports`, { targetType: 'media', targetId: m.id, reason }));
                  }}
                >
                  <Flag size={13} />
                </IconButton>
              )}
            </div>
          </li>
        ))}
      </ul>

      {open && (
        <div role="dialog" aria-modal="true" aria-label="Media viewer" className="fixed inset-0 z-[90] flex items-center justify-center bg-black/90 p-4" onClick={() => setOpen(null)}>
          <button className="absolute top-4 right-4 rounded-full bg-white/10 p-2" aria-label="Close" onClick={() => setOpen(null)}>
            <X size={22} />
          </button>
          {open.mediaType === 'image' ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={open.url} alt={`Photo by ${open.uploaderName}`} className="max-h-full max-w-full rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
          ) : (
            <video src={open.url} controls autoPlay playsInline className="max-h-full max-w-full rounded-lg" onClick={(e) => e.stopPropagation()} />
          )}
        </div>
      )}
    </div>
  );
}
