'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Pin, Play, ThumbsDown, ThumbsUp, X } from 'lucide-react';
import type { PartySnapshot, Role, SongRequestDto } from '@/lib/party/schemas';
import type { Track } from '@/lib/types';
import { api } from '@/lib/party/client';
import { playerTrackFromRef, trackKeyOfRef } from '@/lib/party/tracks';
import { loadDemoCatalog } from '@/lib/player/providers';
import { player, usePlayer } from '@/lib/player/controller';
import { Button, Chip, IconButton } from '@/components/ui/bits';

type Props = { snap: PartySnapshot; role: Role; refresh: () => void };

export function SongQueue({ snap, role, refresh }: Props) {
  const mod = role === 'host' || role === 'cohost';
  const eventId = snap.event.id;
  const byId = new Map(snap.requests.map((r) => [r.id, r]));
  const queue = snap.queue.map((id) => byId.get(id)).filter((r): r is SongRequestDto => !!r);
  const pending = snap.requests.filter((r) => r.status === 'pending');
  const [err, setErr] = useState<string | null>(null);
  const votingAllowed = snap.event.settings.songVoting === 'open' || mod;

  const act = async (fn: () => Promise<unknown>) => {
    setErr(null);
    try {
      await fn();
      refresh();
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  const vote = (r: SongRequestDto, value: 1 | -1) => act(() => api('POST', `/api/events/${eventId}/requests/${r.id}/vote`, { value: r.myVote === value ? 0 : value }));
  const patch = (r: SongRequestDto, body: Record<string, unknown>) => act(() => api('PATCH', `/api/events/${eventId}/requests/${r.id}`, body));

  return (
    <div className="space-y-6">
      {err && (
        <p role="alert" className="rounded-lg border border-red-500/30 bg-red-950/40 p-3 text-sm text-red-200">
          {err}
        </p>
      )}

      {snap.nowPlaying && (
        <div className="rounded-2xl border border-signal/40 bg-signal/10 p-4">
          <p className="mb-1 font-mono text-[11px] tracking-[0.18em] text-signal uppercase">Now playing</p>
          <p className="font-display text-3xl tracking-wide uppercase">{snap.nowPlaying.track.title}</p>
          <p className="text-sm text-ink-200">{snap.nowPlaying.track.artists.join(', ')}</p>
        </div>
      )}

      {mod && pending.length > 0 && (
        <section aria-label="Waiting for approval">
          <h3 className="mb-2 font-display text-2xl tracking-wide uppercase">Needs approval ({pending.length})</h3>
          <ul className="space-y-1.5">
            {pending.map((r) => (
              <li key={r.id} className="flex items-center gap-3 rounded-xl border border-sun/30 bg-sun/5 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{r.track.title}</p>
                  <p className="truncate text-xs text-ink-300">
                    {r.track.artists.join(', ')} · suggested by {r.requesterName}
                  </p>
                </div>
                <Button size="sm" variant="primary" onClick={() => void patch(r, { status: 'approved' })}>
                  <Check size={14} /> Approve
                </Button>
                <IconButton label="Reject" onClick={() => void patch(r, { status: 'rejected' })}>
                  <X size={16} />
                </IconButton>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Queue">
        <div className="mb-2 flex items-center gap-2">
          <h3 className="font-display text-2xl tracking-wide uppercase">Up next</h3>
          <Chip>{snap.event.settings.queueOrder === 'fair' ? 'fair order' : 'host order'}</Chip>
          {mod && snap.event.settings.queueOrder === 'manual' && (
            <button className="text-xs text-ink-300 underline" onClick={() => void act(() => api('PATCH', `/api/events/${eventId}`, { settings: { queueOrder: 'fair' } }))}>
              back to fair order
            </button>
          )}
        </div>
        {queue.filter((r) => r.status !== 'playing').length === 0 ? (
          <p className="rounded-2xl border border-dashed border-ink-700 p-6 text-center text-sm text-ink-400">The queue is empty. Suggest a song!</p>
        ) : (
          <ol className="space-y-1.5">
            {queue
              .filter((r) => r.status !== 'playing')
              .map((r, i) => (
                <li key={r.id} className="flex items-center gap-2 rounded-xl bg-ink-900 p-3">
                  <span className="w-6 text-center font-mono text-xs text-ink-400">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">
                      {r.pinned && <Pin size={12} className="mr-1 inline text-signal" />}
                      {r.track.title}
                    </p>
                    <p className="truncate text-xs text-ink-300">
                      {r.track.artists.join(', ')} · {r.requesterName}
                    </p>
                  </div>
                  {votingAllowed && (
                    <div className="flex items-center">
                      <IconButton label="Upvote" active={r.myVote === 1} onClick={() => void vote(r, 1)} className="h-8 w-8">
                        <ThumbsUp size={15} />
                      </IconButton>
                      <span className="w-6 text-center font-mono text-xs tabular-nums" aria-label={`${r.score} votes`}>
                        {r.score}
                      </span>
                      <IconButton label="Downvote" active={r.myVote === -1} onClick={() => void vote(r, -1)} className="h-8 w-8">
                        <ThumbsDown size={15} />
                      </IconButton>
                    </div>
                  )}
                  {!votingAllowed && <span className="font-mono text-xs text-ink-400">{r.score}</span>}
                  {mod && (
                    <div className="flex items-center">
                      <IconButton label="Move up" onClick={() => void patch(r, { moveTo: Math.max(0, i - 1) })} disabled={i === 0} className="h-8 w-8">
                        <ChevronUp size={15} />
                      </IconButton>
                      <IconButton label="Move down" onClick={() => void patch(r, { moveTo: i + 1 })} disabled={i === queue.length - 1} className="h-8 w-8">
                        <ChevronDown size={15} />
                      </IconButton>
                      <IconButton label={r.pinned ? 'Unpin' : 'Pin to top'} active={r.pinned} onClick={() => void patch(r, { pinned: !r.pinned })} className="h-8 w-8">
                        <Pin size={14} />
                      </IconButton>
                      <IconButton label="Remove" onClick={() => void patch(r, { status: 'rejected' })} className="h-8 w-8">
                        <X size={15} />
                      </IconButton>
                    </div>
                  )}
                </li>
              ))}
          </ol>
        )}
      </section>

      {!mod && snap.requests.some((r) => r.requesterId === snap.me.memberId && r.status === 'pending') && (
        <p className="text-sm text-ink-300">Your suggestion is waiting for the host to approve it.</p>
      )}

      {snap.history.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-ink-300">Played earlier ({snap.history.filter((h) => h.endedAt).length})</summary>
          <ul className="mt-2 space-y-1">
            {snap.history
              .filter((h) => h.endedAt)
              .map((h) => (
                <li key={h.id} className="text-ink-300">
                  {h.track.title} <span className="text-ink-500">· {h.track.artists[0]}</span>
                </li>
              ))}
          </ul>
        </details>
      )}
    </div>
  );
}

/**
 * Host-only: drive the real player from the party queue.
 *  - "Start" loads the approved queue into the player
 *  - the player's upcoming list then follows the live party queue
 *  - track changes are reported back (playing / played) so every phone and the big screen update.
 * Guests never stream audio; one authorized host device plays (README §3.D).
 */
export function HostPlayback({ snap, refresh }: { snap: PartySnapshot; refresh: () => void }) {
  const [catalog, setCatalog] = useState<Track[]>([]);
  const [active, setActive] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const track = usePlayer((s) => s.track);
  const lastReported = useRef<string | null>(null);
  const eventId = snap.event.id;

  useEffect(() => {
    void loadDemoCatalog().then(setCatalog).catch(() => undefined);
  }, []);

  const byId = new Map(snap.requests.map((r) => [r.id, r]));
  const upcoming = snap.queue
    .map((id) => byId.get(id))
    .filter((r): r is SongRequestDto => !!r && r.status === 'approved')
    .map((r) => ({ r, t: playerTrackFromRef(r.track, catalog) }));
  const playable = upcoming.filter((u) => u.t);
  const unplayable = upcoming.filter((u) => !u.t);

  // follow the live party queue after the currently playing track
  const signature = playable.map((u) => u.r.id).join(',');
  useEffect(() => {
    if (!active) return;
    player.setUpcoming(playable.map((u) => u.t!));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, active]);

  // report player track changes back to the party
  useEffect(() => {
    if (!active || !track) return;
    const key = track.id;
    if (lastReported.current === key) return;
    const prevKey = lastReported.current;
    lastReported.current = key;
    const req = snap.requests.find((r) => trackKeyOfRef(r.track) === key && (r.status === 'approved' || r.status === 'playing'));
    const prev = prevKey ? snap.requests.find((r) => trackKeyOfRef(r.track) === prevKey && r.status === 'playing') : undefined;
    void (async () => {
      try {
        if (prev && prev.id !== req?.id) await api('PATCH', `/api/events/${eventId}/requests/${prev.id}`, { status: 'played' });
        if (req) await api('PATCH', `/api/events/${eventId}/requests/${req.id}`, { status: 'playing' });
        refresh();
      } catch (e) {
        setNote((e as Error).message);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track?.id, active]);

  const start = async () => {
    const first = playable[0];
    if (!first) return setNote('Nothing playable in the queue yet. Approve a song that has a real source (a demo song or a Spotify track).');
    setNote(null);
    lastReported.current = null;
    setActive(true);
    await player.playQueue(
      playable.map((u) => u.t!),
      0,
    );
  };

  return (
    <div className="rounded-2xl border border-ink-700 bg-ink-900 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-2xl tracking-wide uppercase">Host playback</h3>
          <p className="text-sm text-ink-300">
            Plays from <strong>this device</strong>. Guests suggest and vote; they don&apos;t stream.
          </p>
        </div>
        {active ? (
          <Button
            onClick={() => {
              setActive(false);
              lastReported.current = null;
            }}
          >
            Stop following queue
          </Button>
        ) : (
          <Button variant="primary" onClick={() => void start()} disabled={playable.length === 0}>
            <Play size={16} fill="currentColor" /> Start party playback
          </Button>
        )}
      </div>
      {unplayable.length > 0 && (
        <p className="mt-3 text-sm text-sun">
          {unplayable.length} approved suggestion{unplayable.length > 1 ? 's are' : ' is'} text-only (no playable source) and will be skipped:{' '}
          {unplayable.map((u) => u.r.track.title).join(', ')}.
        </p>
      )}
      {note && <p className="mt-3 text-sm text-red-300">{note}</p>}
      <p className="mt-2 text-xs text-ink-400">{playable.length} playable in queue</p>
    </div>
  );
}
