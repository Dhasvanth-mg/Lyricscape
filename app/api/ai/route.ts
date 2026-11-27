// Which AI backend the optional AI features use on this machine (GET), and a one-line test of it (POST) for the Settings page.
// Neither sends any song data: the test prompt is fixed.

import { NextResponse } from 'next/server';
import { availableProviders, completeLlm, modelFor, resolveProvider, unconfiguredMessage } from '@/lib/server/llm';

export const dynamic = 'force-dynamic';

export function GET() {
  const provider = resolveProvider();
  return NextResponse.json({
    provider,
    model: provider ? modelFor(provider) || null : null,
    available: availableProviders(),
    setting: (process.env.LYRICSCAPE_AI_PROVIDER ?? 'auto').trim().toLowerCase() || 'auto',
    message: provider ? null : unconfiguredMessage(),
  });
}

export async function POST() {
  const t0 = Date.now();
  const out = await completeLlm({ system: 'Answer only JSON.', user: 'Reply with exactly {"ok": true}', timeoutMs: 90000 });
  const ms = Date.now() - t0;
  if (!out.ok) return NextResponse.json({ ok: false, code: out.code, message: out.message, ms }, { status: out.status });
  const ok = /"ok"\s*:\s*true/.test(out.text);
  return NextResponse.json({ ok, provider: out.provider, model: out.model, ms, message: ok ? null : `Unexpected reply: ${out.text.slice(0, 120)}` }, { status: ok ? 200 : 502 });
}
