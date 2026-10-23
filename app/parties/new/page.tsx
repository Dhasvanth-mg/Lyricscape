'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, useMe } from '@/lib/party/client';
import { Button, PageHeader } from '@/components/ui/bits';

export default function NewParty() {
  const router = useRouter();
  const { me } = useMe();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [place, setPlace] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [passcode, setPasscode] = useState('');
  const [uploads, setUploads] = useState<'off' | 'approval' | 'open'>('approval');
  const [songApproval, setSongApproval] = useState(true);
  const [voting, setVoting] = useState<'open' | 'host-only'>('open');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (me === null) router.replace('/login?next=/parties/new');
  }, [me, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{ event: { slug: string; id: string }; inviteToken: string }>('POST', '/api/events', {
        title,
        description: description || undefined,
        place: place || undefined,
        startsAt: startsAt ? new Date(startsAt).toISOString() : undefined,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        passcode: passcode || undefined,
        settings: { guestUploads: uploads, songApproval, songVoting: voting },
      });
      // the plaintext link is only returned once; remember it for the host's share panel
      try {
        localStorage.setItem(`lyricscape.invite.${r.event.id}`, r.inviteToken);
      } catch {
        /* ignore */
      }
      router.push(`/parties/${r.event.slug}`);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };

  const field = 'h-11 w-full rounded-lg border border-ink-600 bg-ink-850 px-3 text-sm outline-none focus:border-aqua';
  return (
    <div className="max-w-2xl">
      <PageHeader eyebrow="Party mode" title="New party" />
      <form onSubmit={submit} className="space-y-5">
        <label className="block text-sm">
          <span className="mb-1 block text-ink-300">Name</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required minLength={2} maxLength={80} placeholder="Roof party for Sam" className={field} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-ink-300">Description (optional)</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={2} className="w-full rounded-lg border border-ink-600 bg-ink-850 p-3 text-sm outline-none focus:border-aqua" />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-ink-300">When (optional)</span>
            <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={field} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-ink-300">Where (optional, general area)</span>
            <input value={place} onChange={(e) => setPlace(e.target.value)} maxLength={120} placeholder="Brooklyn" className={field} />
          </label>
        </div>
        <label className="block text-sm">
          <span className="mb-1 block text-ink-300">Passcode (optional): guests must enter it to join</span>
          <input value={passcode} onChange={(e) => setPasscode(e.target.value)} minLength={4} maxLength={64} placeholder="min. 4 characters" className={field} />
        </label>

        <fieldset className="space-y-3 rounded-xl border border-ink-700 p-4">
          <legend className="px-2 text-sm font-semibold">Rules</legend>
          <label className="block text-sm">
            <span className="mb-1 block text-ink-300">Guest photo & video uploads</span>
            <select value={uploads} onChange={(e) => setUploads(e.target.value as typeof uploads)} className={field}>
              <option value="approval">Allowed: I approve each upload first</option>
              <option value="open">Allowed: show right away</option>
              <option value="off">Off</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={songApproval} onChange={(e) => setSongApproval(e.target.checked)} className="h-4 w-4 accent-[var(--color-signal)]" />
            I approve song suggestions before they join the queue
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-ink-300">Voting</span>
            <select value={voting} onChange={(e) => setVoting(e.target.value as typeof voting)} className={field}>
              <option value="open">Everyone can vote</option>
              <option value="host-only">Only hosts</option>
            </select>
          </label>
        </fieldset>

        {err && (
          <p role="alert" className="text-sm text-red-300">
            {err}
          </p>
        )}
        <Button variant="primary" size="lg" type="submit" disabled={busy || !title.trim()}>
          Create party
        </Button>
      </form>
    </div>
  );
}
