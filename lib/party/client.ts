'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DisplaySnapshot, PartySnapshot } from './schemas';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public retryAfter?: number,
  ) {
    super(message);
  }
}

export async function api<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
  } catch {
    throw new ApiError(0, 'network', 'You appear to be offline. Check your connection and try again.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.code ?? 'error', data.message ?? `Request failed (${res.status})`, data.retryAfter);
  return data as T;
}

export type Me = { id: string; handle: string; displayName: string } | null;

export function useMe() {
  const [me, setMe] = useState<Me | undefined>(undefined);
  const refresh = useCallback(async () => {
    try {
      setMe((await api<{ user: Me }>('GET', '/api/auth/local')).user);
    } catch {
      setMe(null);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return { me, refresh };
}

export type RoomState<S> = {
  snap: S | null;
  error: ApiError | null;
  connected: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
};

/**
 * Subscribes to a party: initial snapshot -> SSE hints -> refetch.
 * Durable truth stays on the server; `seq` gaps and reconnects always trigger a full snapshot fetch.
 * `displayToken` switches to the read-only big-screen endpoints.
 */
export function usePartyRoom<S extends PartySnapshot | DisplaySnapshot = PartySnapshot>(slug: string, displayToken?: string | null): RoomState<S> {
  const [snap, setSnap] = useState<S | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const lastSeq = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflight = useRef(false);
  const again = useRef(false);

  const snapshotPath = displayToken ? `/api/events/${slug}/display?d=${encodeURIComponent(displayToken)}` : `/api/events/${slug}`;
  const streamPath = displayToken ? `/api/events/${slug}/stream?d=${encodeURIComponent(displayToken)}` : `/api/events/${slug}/stream`;

  // the loader lives in a ref so its identity is stable for the stream effects below
  const loadRef = useRef<() => Promise<void>>(async () => undefined);
  useEffect(() => {
    loadRef.current = async () => {
      if (inflight.current) {
        again.current = true;
        return;
      }
      inflight.current = true;
      try {
        const s = await api<S>('GET', snapshotPath);
        lastSeq.current = Math.max(lastSeq.current, s.seq);
        setSnap(s);
        setError(null);
      } catch (e) {
        setError(e as ApiError);
      } finally {
        inflight.current = false;
        setLoading(false);
        if (again.current) {
          again.current = false;
          void loadRef.current();
        }
      }
    };
  }, [snapshotPath]);
  const load = useCallback(() => loadRef.current(), []);

  const refresh = useCallback(async () => {
    await loadRef.current();
  }, []);

  useEffect(() => {
    void loadRef.current();
  }, [snapshotPath]);

  useEffect(() => {
    if (error && (error.status === 404 || error.status === 403)) return; // don't open streams we're not allowed on
    let es: EventSource | null = null;
    let closed = false;
    const schedule = () => {
      if (timer.current) return;
      timer.current = setTimeout(() => {
        timer.current = null;
        void load();
      }, 150); // coalesce bursts
    };
    const connect = () => {
      es = new EventSource(streamPath);
      es.addEventListener('hello', (e) => {
        setConnected(true);
        const { seq } = JSON.parse((e as MessageEvent).data) as { seq: number };
        if (seq > lastSeq.current) schedule(); // missed messages while disconnected -> resync
      });
      const onMsg = (e: Event) => {
        const m = JSON.parse((e as MessageEvent).data) as { seq: number; type: string };
        if (m.type === 'event.deleted') {
          setError(new ApiError(404, 'not_found', 'This party was deleted.'));
          return;
        }
        if (m.seq > lastSeq.current + 1) schedule(); // gap
        lastSeq.current = Math.max(lastSeq.current, m.seq);
        schedule();
      };
      for (const t of ['event.updated', 'event.member.joined', 'event.song.updated', 'event.media.approved', 'event.media.removed', 'event.playback.changed', 'event.deleted', 'render.progress']) {
        es.addEventListener(t, onMsg);
      }
      es.onerror = () => {
        setConnected(false);
        // EventSource retries by itself (retry: 3000); make sure we resync when it returns
      };
    };
    connect();
    // media URLs are short-lived: refresh them before they expire, and when the tab wakes up
    const refreshTimer = setInterval(() => void load(), 4 * 60 * 1000);
    const onVisible = () => document.visibilityState === 'visible' && void load();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      closed = true;
      void closed;
      es?.close();
      clearInterval(refreshTimer);
      document.removeEventListener('visibilitychange', onVisible);
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    };
  }, [streamPath, load, error]);

  return { snap, error, connected, loading, refresh };
}

/** PUT bytes to a signed URL with progress (XHR gives upload progress events; fetch does not). */
export function uploadWithProgress(url: string, file: File, mime: string, onProgress: (pct: number) => void, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', mime);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else {
        let msg = `Upload failed (${xhr.status})`;
        try {
          msg = JSON.parse(xhr.responseText).message ?? msg;
        } catch {
          /* keep default */
        }
        reject(new ApiError(xhr.status, 'upload_failed', msg));
      }
    };
    xhr.onerror = () => reject(new ApiError(0, 'network', 'Connection lost during upload'));
    xhr.onabort = () => reject(new ApiError(0, 'aborted', 'Upload canceled'));
    signal?.addEventListener('abort', () => xhr.abort());
    xhr.send(file);
  });
}

export function joinUrl(token: string) {
  return `${typeof window === 'undefined' ? '' : window.location.origin}/join/${token}`;
}
