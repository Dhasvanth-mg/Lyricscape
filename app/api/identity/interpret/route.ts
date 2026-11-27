// Optional AI reading of a song's lyric themes, through whichever AI backend this machine has (lib/server/llm.ts): an
// OpenAI-compatible gateway (OmniRoute by default), or the Claude Code or Codex CLI installed and signed in locally.
//
// Off unless something is available: with no backend this answers 501 and the app carries on with its local logic. The client only
// calls this when the listener turned "AI interpretation" on, and caches the answer per song and lyric text, so a song costs at
// most one call. The reply is validated against a schema (lib/identity/ai.ts); anything else is discarded.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AI_MAX_LYRIC_CHARS, buildAiMessages, parseAiResponse } from '@/lib/identity/ai';
import { completeLlm } from '@/lib/server/llm';

export const dynamic = 'force-dynamic';

const body = z.object({
  title: z.string().trim().min(1).max(200),
  artist: z.string().trim().min(1).max(200),
  tags: z.array(z.string().max(60)).max(20).default([]),
  lyrics: z.string().min(40).max(AI_MAX_LYRIC_CHARS * 3),
});

export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ code: 'bad_request', message: 'title, artist and lyrics are required' }, { status: 400 });
  const [system, user] = buildAiMessages(parsed.data);
  const out = await completeLlm({ system: system!.content, user: user!.content, timeoutMs: 90000 });
  if (!out.ok) return NextResponse.json({ code: out.code, message: out.message }, { status: out.status });
  const profile = parseAiResponse(out.text, out.provider === 'gateway' ? out.model : `${out.provider}:${out.model}`);
  if (!profile) return NextResponse.json({ code: 'bad_reply', message: 'The AI reply did not match the expected shape and was discarded.' }, { status: 502 });
  return NextResponse.json({ profile });
}
