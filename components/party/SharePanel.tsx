'use client';

import { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, Check, RefreshCcw, Share2 } from 'lucide-react';
import { api, joinUrl } from '@/lib/party/client';
import { Button, Chip } from '@/components/ui/bits';

type InviteInfo = { id: string; label?: string; expiresAt: string; revokedAt?: string; uses: number; maxUses?: number };

export function QrImage({ url, size = 240, className }: { url: string; size?: number; className?: string }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let alive = true;
    void QRCode.toDataURL(url, { margin: 1, width: size * 2, errorCorrectionLevel: 'M', color: { dark: '#08080a', light: '#ffffff' } }).then((d) => alive && setSrc(d));
    return () => {
      alive = false;
    };
  }, [url, size]);
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} width={size} height={size} alt="QR code to join the party" className={className} /> : <div style={{ width: size, height: size }} className="animate-pulse rounded-lg bg-ink-700" />;
}

/**
 * Plaintext invite tokens exist only at creation time (the server stores a hash), so the share
 * link is shown right after creating/rotating and kept in this browser's sessionStorage for the host.
 */
export function SharePanel({ eventId, slug }: { eventId: string; slug: string }) {
  const storeKey = `lyricscape.invite.${eventId}`;
  const [token, setToken] = useState<string | null>(null);
  const [invites, setInvites] = useState<InviteInfo[]>([]);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [nowTs] = useState(() => Date.now());

  const load = useCallback(async () => {
    try {
      setInvites((await api<{ invites: InviteInfo[] }>('GET', `/api/events/${eventId}/invites`)).invites);
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [eventId]);

  useEffect(() => {
    try {
      setToken(sessionStorage.getItem(storeKey) ?? localStorage.getItem(storeKey));
    } catch {
      /* ignore */
    }
    void load();
  }, [storeKey, load]);

  const remember = (t: string) => {
    setToken(t);
    try {
      localStorage.setItem(storeKey, t);
    } catch {
      /* ignore */
    }
  };

  const create = async (rotate: boolean) => {
    if (rotate && !confirm('Rotate the link? Everyone who has the old link or QR will be unable to join with it.')) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{ token: string }>('POST', `/api/events/${eventId}/invites`, rotate ? { rotate: true } : { label: 'share link', ttlHours: 72 });
      remember(r.token);
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id: string) => {
    await api('DELETE', `/api/events/${eventId}/invites?inviteId=${id}`);
    await load();
  };

  const url = token ? joinUrl(token) : null;
  const active = invites.filter((i) => !i.revokedAt && Date.parse(i.expiresAt) > nowTs);

  return (
    <div className="rounded-2xl border border-ink-700 bg-ink-900 p-5">
      <h3 className="mb-3 font-display text-2xl tracking-wide uppercase">Invite guests</h3>
      {url ? (
        <div className="flex flex-col items-center gap-4 xl:flex-row xl:items-start">
          <div className="rounded-xl bg-white p-2">
            <QrImage url={url} size={176} />
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <code className="block overflow-x-auto rounded-lg bg-ink-800 px-3 py-2 font-mono text-xs whitespace-nowrap" data-testid="invite-link">
              {url}
            </code>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => {
                  void navigator.clipboard?.writeText(url);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy link'}
              </Button>
              {typeof navigator !== 'undefined' && 'share' in navigator && (
                <Button size="sm" onClick={() => void navigator.share({ title: 'Join my party', url }).catch(() => undefined)}>
                  <Share2 size={14} /> Share
                </Button>
              )}
              <Button size="sm" variant="danger" onClick={() => void create(true)} disabled={busy}>
                <RefreshCcw size={14} /> Rotate link
              </Button>
            </div>
            <p className="text-xs text-ink-400">On a phone on the same Wi-Fi, replace “127.0.0.1” with this computer&apos;s LAN address (e.g. 192.168.x.x:3000).</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-ink-300">
            Links are shown once when created (only a hash is stored). Create one to get a link and QR code for <code>{slug}</code>.
          </p>
          <Button variant="primary" onClick={() => void create(false)} disabled={busy}>
            Create invite link
          </Button>
        </div>
      )}
      {err && (
        <p role="alert" className="mt-3 text-sm text-red-300">
          {err}
        </p>
      )}
      {active.length > 0 && (
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer text-ink-300">Active links ({active.length})</summary>
          <ul className="mt-2 space-y-1.5">
            {active.map((i) => (
              <li key={i.id} className="flex items-center gap-2">
                <span className="flex-1">
                  {i.label ?? 'link'} · {i.uses} joined{i.maxUses ? ` / ${i.maxUses}` : ''} · expires {new Date(i.expiresAt).toLocaleString()}
                </span>
                <button className="text-xs text-red-300 underline" onClick={() => void revoke(i.id)}>
                  revoke
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
      {invites.length > 0 && active.length === 0 && <Chip tone="warn" className="mt-3">All links revoked or expired</Chip>}
    </div>
  );
}
