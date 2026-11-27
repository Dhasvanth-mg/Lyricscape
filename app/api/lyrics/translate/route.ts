// Optional lyric translation through the same AI backend as the AI theme reading (lib/server/llm.ts: a gateway, or the local
// Claude Code or Codex CLI). Only used when the browser has no on-device translator and the listener allowed it (Settings -> Lyrics).
// Off unless a backend is available (501). It sends the lyric lines and the two language codes, nothing else. The reply must keep
// one line per line.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { completeLlm } from '@/lib/server/llm';

export const dynamic = 'force-dynamic';

const body = z.object({
  lines: z.array(z.string().max(500)).min(1).max(300),
  target: z.string().regex(/^[a-z]{2,3}$/),
  source: z.string().regex(/^[a-z]{2,3}$/).nullable().optional(),
});
const reply = z.object({ lines: z.array(z.string().max(1000)) });

export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ code: 'bad_request', message: 'lines and target are required' }, { status: 400 });
  const { lines, target, source } = parsed.data;
  const out = await completeLlm({
    system: `You translate song lyrics${source ? ` from the language with code "${source}"` : ''} into the language with code "${target}". Translate each line on its own, keeping the meaning plain and singable, without notes. Answer only JSON: {"lines": [...]} with exactly one string per input line, in order. An empty input line stays empty.`,
    user: JSON.stringify({ lines }),
    timeoutMs: 120000,
  });
  if (!out.ok) return NextResponse.json({ code: out.code, message: out.message }, { status: out.status });
  let res: z.infer<typeof reply> | null = null;
  try {
    // A CLI may wrap the JSON in a code fence; take the outermost object.
    res = reply.parse(JSON.parse(out.text.slice(out.text.indexOf('{'), out.text.lastIndexOf('}') + 1)));
  } catch {
    res = null;
  }
  if (!res || res.lines.length !== lines.length) return NextResponse.json({ code: 'bad_reply', message: 'The AI reply did not keep one line per lyric line and was discarded.' }, { status: 502 });
  return NextResponse.json({ lines: res.lines });
}
