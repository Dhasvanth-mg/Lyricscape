// Optional bridge to the local lyric aligner (tools/aligner, `pnpm aligner`).
//
// The aligner reads audio you hold: a local file or the bundled demo songs. It is never given Spotify audio (the app
// has none). It must be on this machine: the target is restricted to a loopback address so this route can never be
// used to make the server call somewhere else, and the audio never leaves your computer.

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 1800;

const DEFAULT_URL = 'http://127.0.0.1:8765';
const MAX_AUDIO_BYTES = 300 * 1024 * 1024;

function target(): URL | null {
  try {
    const u = new URL(process.env.ALIGNER_URL || DEFAULT_URL);
    return ['127.0.0.1', 'localhost', '[::1]', '::1'].includes(u.hostname) && (u.protocol === 'http:' || u.protocol === 'https:') ? u : null;
  } catch {
    return null;
  }
}

export async function GET() {
  const base = target();
  if (!base) return NextResponse.json({ available: false, reason: 'ALIGNER_URL must point at this machine (127.0.0.1 / localhost).' });
  try {
    const res = await fetch(new URL('/health', base), { signal: AbortSignal.timeout(1500), cache: 'no-store' });
    if (!res.ok) return NextResponse.json({ available: false, reason: `Aligner answered ${res.status}` });
    return NextResponse.json({ available: true, ...(await res.json()) });
  } catch {
    return NextResponse.json({ available: false, reason: 'The local aligner is not running. Start it with: pnpm aligner' });
  }
}

export async function POST(req: Request) {
  const base = target();
  if (!base) return NextResponse.json({ code: 'bad_config', message: 'ALIGNER_URL must point at this machine.' }, { status: 400 });
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ code: 'bad_request', message: 'Expected multipart form data (audio + lyrics).' }, { status: 400 });
  }
  const audio = form.get('audio');
  const lyrics = form.get('lyrics');
  if (!(audio instanceof Blob) || typeof lyrics !== 'string' || !lyrics.trim()) {
    return NextResponse.json({ code: 'bad_request', message: 'audio (file) and lyrics (text) are required.' }, { status: 400 });
  }
  if (audio.size > MAX_AUDIO_BYTES) return NextResponse.json({ code: 'too_large', message: 'Audio file is too large.' }, { status: 413 });

  const out = new FormData();
  out.set('audio', audio, 'audio');
  out.set('lyrics', lyrics.slice(0, 200_000));
  out.set('separate', String(form.get('separate') ?? 'true') === 'false' ? 'false' : 'true');
  out.set('language', String(form.get('language') ?? 'en').slice(0, 8));
  try {
    const res = await fetch(new URL('/align', base), { method: 'POST', body: out, signal: AbortSignal.timeout(25 * 60_000), cache: 'no-store' });
    const body = (await res.json().catch(() => ({}))) as { detail?: string };
    if (!res.ok) return NextResponse.json({ code: 'aligner_error', message: body.detail ?? `Aligner failed (${res.status})` }, { status: res.status === 400 || res.status === 422 ? res.status : 502 });
    return NextResponse.json(body);
  } catch (e) {
    const timeout = (e as Error).name === 'TimeoutError';
    return NextResponse.json({ code: timeout ? 'timeout' : 'unreachable', message: timeout ? 'The aligner took too long.' : 'The local aligner is not running. Start it with: pnpm aligner' }, { status: 502 });
  }
}
