'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { ApiError, api, useMe } from '@/lib/party/client';
import { Button, Chip, Empty, PageHeader, Spinner } from '@/components/ui/bits';

type Row = { id: string; slug: string; title: string; status: string; role: string; startsAt?: string; place?: string };

export default function PartiesPage() {
  const { me } = useMe();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (me === undefined) return;
    if (me === null) return setRows([]);
    api<{ events: Row[] }>('GET', '/api/events')
      .then((r) => setRows(r.events))
      .catch((e: ApiError) => setErr(e.message));
  }, [me]);

  return (
    <div>
      <PageHeader eyebrow="Collaborate" title="Parties">
        {me && (
          <Link href="/parties/new" className="inline-flex h-10 items-center gap-2 rounded-full bg-signal px-5 text-sm font-semibold text-white hover:bg-[#ff5a87]">
            <Plus size={16} /> New party
          </Link>
        )}
      </PageHeader>

      {me === undefined && <Spinner />}
      {me === null && (
        <Empty
          title="Sign in to host"
          action={
            <Link href="/login?next=/parties" className="inline-flex h-10 items-center rounded-full bg-bone px-5 text-sm font-semibold text-ink-950">
              Pick a profile
            </Link>
          }
        >
          Hosts need a (local) profile. Guests don&apos;t: they just open the invite link on their phone.
        </Empty>
      )}
      {err && <p className="text-red-300">{err}</p>}
      {me && rows && rows.length === 0 && (
        <Empty
          title="No parties yet"
          action={
            <Link href="/parties/new">
              <Button variant="primary">Create your first party</Button>
            </Link>
          }
        >
          Share a link or QR code. Guests add songs and photos from their phones, and the big screen shows it live.
        </Empty>
      )}
      <ul className="grid gap-3 sm:grid-cols-2">
        {rows?.map((r) => (
          <li key={r.id}>
            <Link href={r.role === 'host' || r.role === 'cohost' ? `/parties/${r.slug}` : `/p/${r.slug}`} className="block rounded-2xl border border-ink-700 bg-ink-900 p-5 transition hover:border-ink-400">
              <div className="mb-2 flex items-center gap-2">
                <Chip tone={r.status === 'live' ? 'good' : r.status === 'ended' || r.status === 'archived' ? 'default' : 'warn'}>{r.status}</Chip>
                <Chip>{r.role}</Chip>
              </div>
              <h2 className="font-display text-3xl tracking-wide uppercase">{r.title}</h2>
              <p className="text-sm text-ink-300">
                {r.startsAt ? new Date(r.startsAt).toLocaleString() : 'No date set'}
                {r.place ? ` · ${r.place}` : ''}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
