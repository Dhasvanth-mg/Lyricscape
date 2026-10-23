'use client';

import { useRef, useState } from 'react';
import { Camera, RotateCcw, X } from 'lucide-react';
import clsx from 'clsx';
import { ApiError, api, uploadWithProgress } from '@/lib/party/client';
import { MEDIA_MIME } from '@/lib/party/schemas';
import { Button } from '@/components/ui/bits';

type Item = {
  key: string;
  file: File;
  state: 'queued' | 'uploading' | 'processing' | 'done' | 'pending' | 'error';
  pct: number;
  error?: string;
  attempts: number;
  abort?: AbortController;
};

const MAX_RETRIES = 3;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function guessMime(f: File): string {
  if (f.type) return f.type;
  const ext = f.name.split('.').pop()?.toLowerCase();
  return ({ heic: 'image/heic', heif: 'image/heic', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm' } as Record<string, string>)[ext ?? ''] ?? '';
}

/**
 * Direct-to-storage uploads with progress, retries (network errors only) and per-file results.
 * Flow: upload-intent -> PUT to signed URL -> complete (server verifies bytes).
 */
export function Uploader({ eventId, onUploaded, compact }: { eventId: string; onUploaded?: () => void; compact?: boolean }) {
  const [items, setItems] = useState<Item[]>([]);
  const [consent, setConsent] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const patch = (key: string, p: Partial<Item>) => setItems((cur) => cur.map((i) => (i.key === key ? { ...i, ...p } : i)));

  const run = async (item: Item) => {
    const mime = guessMime(item.file);
    if (!(MEDIA_MIME as readonly string[]).includes(mime)) return patch(item.key, { state: 'error', error: 'Unsupported file type. Use a photo or video (JPG, PNG, HEIC, MP4, MOV, WebM).' });
    const ctl = new AbortController();
    patch(item.key, { state: 'uploading', pct: 0, error: undefined, abort: ctl });
    try {
      const intent = await api<{ mediaId: string; uploadUrl: string }>('POST', `/api/events/${eventId}/media/upload-intent`, {
        fileName: item.file.name,
        mime,
        size: item.file.size,
        takenAt: item.file.lastModified ? new Date(item.file.lastModified).toISOString() : undefined,
        recapConsent: consent,
      });
      let attempt = 0;
      for (;;) {
        try {
          await uploadWithProgress(intent.uploadUrl, item.file, mime, (pct) => patch(item.key, { pct }), ctl.signal);
          break;
        } catch (e) {
          const err = e as ApiError;
          if (err.code === 'network' && attempt < MAX_RETRIES && !ctl.signal.aborted) {
            attempt++;
            patch(item.key, { error: `Connection hiccup, retrying (${attempt}/${MAX_RETRIES})…` });
            await sleep(800 * 2 ** attempt);
            continue;
          }
          throw err;
        }
      }
      patch(item.key, { state: 'processing', pct: 100, error: undefined });
      const done = await api<{ status: string }>('POST', `/api/events/${eventId}/media/complete`, { mediaId: intent.mediaId });
      patch(item.key, { state: done.status === 'approved' ? 'done' : 'pending' });
      onUploaded?.();
    } catch (e) {
      const err = e as ApiError;
      patch(item.key, { state: 'error', error: err.code === 'aborted' ? 'Canceled' : err.message });
    }
  };

  const add = (files: File[]) => {
    const fresh: Item[] = files.map((file) => ({ key: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 7)}`, file, state: 'queued', pct: 0, attempts: 0 }));
    setItems((c) => [...fresh, ...c]);
    // modest concurrency keeps phones responsive
    void (async () => {
      const queue = [...fresh];
      const worker = async () => {
        for (let it = queue.shift(); it; it = queue.shift()) await run(it);
      };
      await Promise.all([worker(), worker()]);
    })();
  };

  return (
    <div className={clsx('rounded-2xl border border-ink-700 bg-ink-900', compact ? 'p-4' : 'p-5')}>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" size="lg" onClick={() => input.current?.click()} className="flex-1 sm:flex-none">
          <Camera size={18} /> Add photos & videos
        </Button>
        <input
          ref={input}
          type="file"
          accept="image/*,video/*"
          multiple
          className="sr-only"
          data-testid="upload-input"
          onChange={(e) => {
            add([...(e.target.files ?? [])]);
            e.target.value = '';
          }}
        />
        <label className="flex min-w-[220px] flex-1 cursor-pointer items-start gap-2 text-sm text-ink-300">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--color-signal)]" />
          <span>It&apos;s OK to use my uploads in the party recap video. You can change this later.</span>
        </label>
      </div>

      {items.length > 0 && (
        <ul className="mt-4 space-y-2" aria-live="polite">
          {items.slice(0, 12).map((it) => (
            <li key={it.key} className="rounded-xl bg-ink-850 p-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate">{it.file.name}</span>
                <span
                  className={clsx(
                    'shrink-0 text-xs font-semibold uppercase',
                    it.state === 'done' && 'text-aqua',
                    it.state === 'pending' && 'text-sun',
                    it.state === 'error' && 'text-red-300',
                    (it.state === 'uploading' || it.state === 'processing' || it.state === 'queued') && 'text-ink-300',
                  )}
                >
                  {it.state === 'pending' ? 'waiting for host' : it.state === 'done' ? 'added' : it.state === 'uploading' ? `${it.pct}%` : it.state}
                </span>
                {it.state === 'uploading' && (
                  <button aria-label="Cancel upload" onClick={() => it.abort?.abort()} className="rounded-full p-1 text-ink-400 hover:text-bone">
                    <X size={14} />
                  </button>
                )}
                {it.state === 'error' && (
                  <button aria-label="Retry upload" onClick={() => void run(it)} className="rounded-full p-1 text-ink-300 hover:text-bone">
                    <RotateCcw size={14} />
                  </button>
                )}
              </div>
              {(it.state === 'uploading' || it.state === 'processing') && (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-700" role="progressbar" aria-valuenow={it.pct} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-full bg-signal transition-[width]" style={{ width: `${it.pct}%` }} />
                </div>
              )}
              {it.error && <p className={clsx('mt-1 text-xs', it.state === 'error' ? 'text-red-300' : 'text-ink-400')}>{it.error}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
