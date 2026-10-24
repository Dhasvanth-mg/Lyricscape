// Optional AI reading of a song's lyric themes, through an OpenAI-compatible gateway the operator configures (OmniRoute by default).
//
// Off unless configured: with no OMNIROUTE_API_KEY this answers 501 and the app carries on with its local logic. The client only
// calls this when the listener turned "AI interpretation" on, and caches the answer per song and lyric text, so a song costs at
// most one call. The reply is validated against a schema (lib/identity/ai.ts); anything else is discarded.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AI_MAX_LYRIC_CHARS, buildAiMessages, parseAiResponse } from '@/lib/identity/ai';

export const dynamic = 'force-dynamic';

const body = z.object({
  title: z.string().trim().min(1).max(200),
  artist: z.string().trim().min(1).max(200),
  tags: z.array(z.string().max(60)).max(20).default([]),
  lyrics: z.string().min(40).max(AI_MAX_LYRIC_CHARS * 3),
});

export async function POST(req: Request) {
  const key = process.env.OMNIROUTE_API_KEY;
  if (!key) return NextResponse.json({ code: 'ai_unconfigured', message: 'No AI gateway is configured (set OMNIROUTE_API_KEY). The local analysis is used instead.' }, { status: 501 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ code: 'bad_request', message: 'title, artist and lyrics are required' }, { status: 400 });
  const base = (process.env.OMNIROUTE_BASE_URL ?? 'http://127.0.0.1:20128/v1').replace(/\/$/, '');
  const model = process.env.LYRICSCAPE_AI_MODEL ?? 'auto';
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 30000);
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, temperature: 0.2, response_format: { type: 'json_object' }, messages: buildAiMessages(parsed.data) }),
      signal: ctl.signal,
      cache: 'no-store',
    });
    if (!res.ok) return NextResponse.json({ code: 'upstream', message: `The AI gateway answered ${res.status}` }, { status: 502 });
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const profile = parseAiResponse(data.choices?.[0]?.message?.content ?? '', model);
    if (!profile) return NextResponse.json({ code: 'bad_reply', message: 'The AI reply did not match the expected shape and was discarded.' }, { status: 502 });
    return NextResponse.json({ profile });
  } catch (e) {
    return NextResponse.json({ code: 'upstream', message: e instanceof Error ? e.message : 'AI request failed' }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
