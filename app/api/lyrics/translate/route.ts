// Optional lyric translation through the AI gateway the operator configures (the same one as the AI theme reading). Only used when
// the browser has no on-device translator and the listener allowed it (Settings -> Lyrics). Off unless configured: 501 without
// OMNIROUTE_API_KEY. It sends the lyric lines and the two language codes, nothing else. The reply must keep one line per line.

import { NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const body = z.object({
  lines: z.array(z.string().max(500)).min(1).max(300),
  target: z.string().regex(/^[a-z]{2,3}$/),
  source: z.string().regex(/^[a-z]{2,3}$/).nullable().optional(),
});
const reply = z.object({ lines: z.array(z.string().max(1000)) });

export async function POST(req: Request) {
  const key = process.env.OMNIROUTE_API_KEY;
  if (!key) return NextResponse.json({ code: 'ai_unconfigured', message: 'No AI gateway is configured (set OMNIROUTE_API_KEY).' }, { status: 501 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ code: 'bad_request', message: 'lines and target are required' }, { status: 400 });
  const { lines, target, source } = parsed.data;
  const base = (process.env.OMNIROUTE_BASE_URL ?? 'http://127.0.0.1:20128/v1').replace(/\/$/, '');
  const model = process.env.LYRICSCAPE_AI_MODEL ?? 'auto';
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 60000);
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `You translate song lyrics${source ? ` from the language with code "${source}"` : ''} into the language with code "${target}". Translate each line on its own, keeping the meaning plain and singable, without notes. Answer only JSON: {"lines": [...]} with exactly one string per input line, in order. An empty input line stays empty.`,
          },
          { role: 'user', content: JSON.stringify({ lines }) },
        ],
      }),
      signal: ctl.signal,
      cache: 'no-store',
    });
    if (!res.ok) return NextResponse.json({ code: 'upstream', message: `The AI gateway answered ${res.status}` }, { status: 502 });
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    let out: z.infer<typeof reply> | null = null;
    try {
      out = reply.parse(JSON.parse(data.choices?.[0]?.message?.content ?? ''));
    } catch {
      out = null;
    }
    if (!out || out.lines.length !== lines.length) return NextResponse.json({ code: 'bad_reply', message: 'The AI reply did not keep one line per lyric line and was discarded.' }, { status: 502 });
    return NextResponse.json({ lines: out.lines });
  } catch (e) {
    return NextResponse.json({ code: 'upstream', message: e instanceof Error ? e.message : 'AI request failed' }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
