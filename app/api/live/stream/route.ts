import { liveState, onLive } from '@/lib/server/live';

export const dynamic = 'force-dynamic';
export const maxDuration = 3600;

/** Server-Sent Events for overlays: `song` (track, lines, beats) when the song changes, `clock` on every clock sample. */
export async function GET(req: Request) {
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
        off = null;
        timer = null;
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      const s = liveState();
      send(`retry: 2000\n\n`);
      send(`event: song\ndata: ${JSON.stringify({ song: s.song, clock: s.clock })}\n\n`);
      off = onLive((kind, st) => send(kind === 'song' ? `event: song\ndata: ${JSON.stringify({ song: st.song, clock: st.clock })}\n\n` : `event: clock\ndata: ${JSON.stringify(st.clock)}\n\n`));
      timer = setInterval(() => send(`: ping ${Date.now()}\n\n`), 15_000);
      req.signal.addEventListener('abort', cleanup);
    },
    cancel() {
      off?.();
      if (timer) clearInterval(timer);
    },
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' } });
}
