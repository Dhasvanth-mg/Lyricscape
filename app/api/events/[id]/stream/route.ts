import { ctxFor, withParams } from '@/lib/server/http';
import { findEvent, requireDisplay, requireMember } from '@/lib/server/party';
import { currentSeq, dropPresence, publish, subscribe, touchPresence } from '@/lib/server/bus';
import type { PartyMessage } from '@/lib/party/schemas';

export const dynamic = 'force-dynamic';
export const maxDuration = 3600;

/**
 * Server-Sent Events: the local replacement for Supabase Realtime channels
 * (party:<id>:queue / gallery / presence). Authorized per subscription (member cookie
 * or signed display token). Messages are hints; clients refetch the snapshot, and use
 * `seq` gaps to detect missed messages after reconnecting.
 */
export const GET = withParams<{ id: string }>(async (req, { id }) => {
  const display = new URL(req.url).searchParams.get('d');
  let eventId: string;
  let memberId: string | null = null;
  if (display) {
    eventId = requireDisplay(id, display).event.id;
  } else {
    const { event, member } = requireMember(id, await ctxFor(req, id));
    eventId = event.id;
    memberId = member.id;
  }
  if (!findEvent(eventId)) throw new Error('unreachable');

  const enc = new TextEncoder();
  let off: (() => void) | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(enc.encode(chunk));
        } catch {
          cleanup();
        }
      };
      const cleanup = () => {
        off?.();
        if (timer) clearInterval(timer);
        if (memberId) {
          dropPresence(eventId, memberId);
          publish(eventId, 'event.updated', { kind: 'presence' });
        }
        off = null;
        timer = null;
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      send(`retry: 3000\n\n`);
      send(`event: hello\ndata: ${JSON.stringify({ seq: currentSeq(eventId) })}\n\n`);
      off = subscribe(eventId, (m: PartyMessage) => send(`id: ${m.seq}\nevent: ${m.type}\ndata: ${JSON.stringify(m)}\n\n`));
      if (memberId) {
        touchPresence(eventId, memberId);
        publish(eventId, 'event.updated', { kind: 'presence' });
      }
      timer = setInterval(() => {
        if (memberId) touchPresence(eventId, memberId);
        send(`: ping ${Date.now()}\n\n`);
      }, 20_000);
      req.signal.addEventListener('abort', cleanup);
    },
    cancel() {
      off?.();
      if (timer) clearInterval(timer);
      if (memberId) dropPresence(eventId, memberId);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
});
