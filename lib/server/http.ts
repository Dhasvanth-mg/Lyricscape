import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { HttpError, signToken, verifyToken } from './security';
import { findEvent, T, type Ctx, type UserRow } from './party';

const SESSION_COOKIE = 'ls_session';
const guestCookie = (eventId: string) => `lsg_${eventId}`;

export type RouteCtx<P extends Record<string, string> = Record<string, string>> = { params: Promise<P> };

const secureCookies = () => (process.env.NEXT_PUBLIC_APP_URL ?? '').startsWith('https://');

export function clientIp(req: Request): string {
  const xf = req.headers.get('x-forwarded-for');
  return (xf?.split(',')[0] ?? req.headers.get('x-real-ip') ?? 'local').trim();
}

/** CSRF defence for cookie-authenticated writes: same-origin requests only. */
function assertSameOrigin(req: Request) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return;
  const origin = req.headers.get('origin');
  if (!origin) return; // non-browser clients (curl, tests) don't send one; cookies still need a browser
  const host = req.headers.get('host');
  let originHost = '';
  try {
    originHost = new URL(origin).host;
  } catch {
    /* fall through to rejection */
  }
  if (!host || originHost !== host) throw new HttpError(403, 'bad_origin', 'Cross-site requests are not allowed');
}

export async function currentUser(): Promise<UserRow | null> {
  const jar = await cookies();
  const p = verifyToken<{ t: string; uid: string }>(jar.get(SESSION_COOKIE)?.value);
  if (!p || p.t !== 'session') return null;
  return T.users().get(p.uid) ?? null;
}

export async function requireUser(): Promise<UserRow> {
  const u = await currentUser();
  if (!u) throw new HttpError(401, 'unauthenticated', 'Sign in first (pick a profile)');
  return u;
}

export async function setSession(user: UserRow) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, signToken({ t: 'session', uid: user.id }, 30 * 86_400_000), {
    httpOnly: true,
    sameSite: 'lax',
    secure: secureCookies(),
    path: '/',
    maxAge: 30 * 86_400,
  });
}

export async function clearSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function setGuestCookie(eventId: string, token: string) {
  (await cookies()).set(guestCookie(eventId), token, { httpOnly: true, sameSite: 'lax', secure: secureCookies(), path: '/', maxAge: 14 * 86_400 });
}

/** Resolve who is calling for a given event. Authorization still happens in the domain layer. */
export async function ctxFor(req: Request, eventKey: string): Promise<Ctx> {
  const jar = await cookies();
  const user = await currentUser();
  const event = findEvent(eventKey);
  return {
    userId: user?.id,
    guestToken: event ? jar.get(guestCookie(event.id))?.value : undefined,
    ip: clientIp(req),
  };
}

export async function readJson<T = unknown>(req: Request, maxBytes = 64 * 1024): Promise<T> {
  const type = req.headers.get('content-type') ?? '';
  if (!type.includes('application/json')) throw new HttpError(415, 'unsupported_media_type', 'Send JSON');
  const text = await req.text();
  if (text.length > maxBytes) throw new HttpError(413, 'too_large', 'Request body too large');
  try {
    return (text ? JSON.parse(text) : {}) as T;
  } catch {
    throw new HttpError(400, 'bad_json', 'Malformed JSON');
  }
}

type Handler = (req: Request) => Promise<Response | unknown>;

/** Uniform error shape: { code, message, requestId, retryAfter? } */
export function handle(fn: Handler) {
  return async (req: Request): Promise<Response> => {
    const requestId = randomUUID().slice(0, 8);
    try {
      assertSameOrigin(req);
      const out = await fn(req);
      if (out instanceof Response) return out;
      return NextResponse.json(out ?? { ok: true }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (e) {
      if (e instanceof HttpError) {
        return NextResponse.json(
          { code: e.code, message: e.message, requestId, ...(e.retryAfter ? { retryAfter: e.retryAfter } : {}) },
          { status: e.status, headers: e.retryAfter ? { 'Retry-After': String(e.retryAfter) } : undefined },
        );
      }
      if (e instanceof ZodError) {
        const issue = e.issues[0];
        return NextResponse.json(
          { code: 'validation', message: issue ? `${issue.path.join('.') || 'input'}: ${issue.message}` : 'Invalid input', requestId },
          { status: 400 },
        );
      }
      console.error(`[api ${requestId}]`, e);
      return NextResponse.json({ code: 'internal', message: 'Something went wrong on our side.', requestId }, { status: 500 });
    }
  };
}

/** Wrap a handler that needs route params. */
export function withParams<P extends Record<string, string>>(fn: (req: Request, params: P) => Promise<Response | unknown>) {
  return (req: Request, ctx: RouteCtx<P>) => handle(async (r) => fn(r, await ctx.params))(req);
}
