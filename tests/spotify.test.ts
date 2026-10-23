import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Minimal browser-ish globals so the (client-only) Spotify modules run under Node.
function installWindow(origin = 'http://127.0.0.1:3000') {
  const store = new Map<string, string>();
  const session = new Map<string, string>();
  const mk = (m: Map<string, string>) => ({
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  });
  const url = new URL(origin);
  (globalThis as unknown as { window: unknown }).window = {
    localStorage: mk(store),
    sessionStorage: mk(session),
    location: { protocol: url.protocol, hostname: url.hostname, port: url.port, assign: vi.fn() },
    dispatchEvent: () => true,
  };
  (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = class {
    constructor(public type: string) {}
  };
  return { store, session };
}

const json = (body: unknown, init: ResponseInit & { headers?: Record<string, string> } = {}) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json', ...(init.headers ?? {}) }, ...init });

describe('PKCE', () => {
  beforeEach(() => installWindow());

  it('matches the RFC 7636 test vector', async () => {
    const { challengeFor } = await import('@/lib/spotify/auth');
    expect(await challengeFor('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });

  it('generates url-safe random verifiers of sufficient length', async () => {
    const { randomString } = await import('@/lib/spotify/auth');
    const v = randomString(64);
    expect(v).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(v.length).toBeGreaterThanOrEqual(43);
    expect(randomString(64)).not.toBe(v);
  });

  it('builds an auth URL with S256, state, scopes and a loopback redirect', async () => {
    const auth = await import('@/lib/spotify/auth');
    auth.setClientId('client123');
    const url = new URL(await auth.buildAuthUrl());
    expect(url.origin + url.pathname).toBe('https://accounts.spotify.com/authorize');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('client_id')).toBe('client123');
    expect(url.searchParams.get('redirect_uri')).toBe('http://127.0.0.1:3000/spotify/callback');
    expect(url.searchParams.get('scope')).toContain('streaming');
    expect(url.searchParams.get('state')!.length).toBeGreaterThan(20);
    expect(url.searchParams.has('client_secret')).toBe(false);
  });

  it('rewrites localhost to 127.0.0.1 for the redirect URI (Spotify rejects localhost)', async () => {
    installWindow('http://localhost:3000');
    const { redirectUri } = await import('@/lib/spotify/auth');
    expect(redirectUri()).toBe('http://127.0.0.1:3000/spotify/callback');
  });

  it('refuses a callback whose state does not match (CSRF)', async () => {
    const auth = await import('@/lib/spotify/auth');
    auth.setClientId('client123');
    await auth.buildAuthUrl();
    await expect(auth.completeLogin('?code=abc&state=attacker')).rejects.toMatchObject({ code: 'state-mismatch' });
  });

  it('exchanges the code and stores tokens; the verifier is single-use', async () => {
    const auth = await import('@/lib/spotify/auth');
    auth.setClientId('client123');
    const authUrl = new URL(await auth.buildAuthUrl());
    const state = authUrl.searchParams.get('state')!;
    const fetchMock = vi.fn().mockResolvedValue(json({ access_token: 'AT', refresh_token: 'RT', expires_in: 3600 }));
    vi.stubGlobal('fetch', fetchMock);
    await auth.completeLogin(`?code=thecode&state=${state}`);
    const body = fetchMock.mock.calls[0]![1].body as URLSearchParams;
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('code_verifier')!.length).toBeGreaterThan(42);
    expect(body.has('client_secret')).toBe(false);
    expect(auth.readTokens()?.accessToken).toBe('AT');
    await expect(auth.completeLogin(`?code=thecode&state=${state}`)).rejects.toMatchObject({ code: 'state-mismatch' });
  });

  it('reports a declined login clearly', async () => {
    const auth = await import('@/lib/spotify/auth');
    await expect(auth.completeLogin('?error=access_denied')).rejects.toMatchObject({ code: 'denied' });
  });
});

describe('token refresh', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('refreshes once when expired, shared across concurrent callers', async () => {
    const { store } = installWindow();
    const auth = await import('@/lib/spotify/auth');
    auth.setClientId('client123');
    store.set('lyricscape.spotify.tokens', JSON.stringify({ accessToken: 'old', refreshToken: 'RT', expiresAt: Date.now() - 1000 }));
    const fetchMock = vi.fn().mockResolvedValue(json({ access_token: 'new', expires_in: 3600 }));
    vi.stubGlobal('fetch', fetchMock);
    const [a, b] = await Promise.all([auth.getAccessToken(), auth.getAccessToken()]);
    expect(a).toBe('new');
    expect(b).toBe('new');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(auth.readTokens()?.refreshToken).toBe('RT'); // kept when Spotify omits a new one
  });

  it('drops the session when the refresh token is revoked', async () => {
    const { store } = installWindow();
    const auth = await import('@/lib/spotify/auth');
    auth.setClientId('client123');
    store.set('lyricscape.spotify.tokens', JSON.stringify({ accessToken: 'old', refreshToken: 'RT', expiresAt: 0 }));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ error: 'invalid_grant' }, { status: 400 })));
    await expect(auth.getAccessToken()).rejects.toMatchObject({ code: 'refresh-failed' });
    expect(auth.isConnected()).toBe(false);
  });
});

describe('Spotify API error mapping', () => {
  beforeEach(async () => {
    const { store } = installWindow();
    store.set('lyricscape.spotify.tokens', JSON.stringify({ accessToken: 'AT', refreshToken: 'RT', expiresAt: Date.now() + 3600_000 }));
    vi.resetModules();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('maps 403 PREMIUM_REQUIRED, NO_ACTIVE_DEVICE and plain 403', async () => {
    const api = await import('@/lib/spotify/api');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ error: { reason: 'PREMIUM_REQUIRED', message: 'Player command failed: Premium required' } }, { status: 403 }))
      .mockResolvedValueOnce(json({ error: { reason: 'NO_ACTIVE_DEVICE', message: 'No active device found' } }, { status: 404 }))
      .mockResolvedValueOnce(json({ error: { message: 'User not registered in the Developer Dashboard' } }, { status: 403 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(api.pausePlayback()).rejects.toMatchObject({ kind: 'premium' });
    await expect(api.pausePlayback()).rejects.toMatchObject({ kind: 'no-device' });
    await expect(api.getMe()).rejects.toMatchObject({ kind: 'forbidden' });
  });

  it('honors 429 Retry-After with a global backoff (no hammering)', async () => {
    const api = await import('@/lib/spotify/api');
    const fetchMock = vi.fn().mockResolvedValue(json({}, { status: 429, headers: { 'retry-after': '7' } }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(api.getMe()).rejects.toMatchObject({ kind: 'rate-limit', retryAfterMs: 7000 });
    await expect(api.getMe()).rejects.toMatchObject({ kind: 'rate-limit' });
    expect(fetchMock).toHaveBeenCalledTimes(1); // second call short-circuited
    expect(api.rateLimitedUntil()).toBeGreaterThan(Date.now());
  });

  it('retries a 401 once after refreshing the token', async () => {
    (await import('@/lib/spotify/auth')).setClientId('client123');
    const api = await import('@/lib/spotify/api');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ error: { message: 'expired' } }, { status: 401 }))
      .mockResolvedValueOnce(json({ access_token: 'AT2', expires_in: 3600 })) // refresh
      .mockResolvedValueOnce(json({ id: 'me' }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await api.getMe()).toEqual({ id: 'me' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('treats 204 as "nothing playing" and maps tracks, skipping local files and episodes', async () => {
    const api = await import('@/lib/spotify/api');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    expect(await api.getPlaybackState()).toBeNull();
    expect(api.mapTrack({ id: null, name: 'x', duration_ms: 1, artists: [], is_local: true })).toBeNull();
    expect(api.mapTrack({ id: 'ep1', name: 'ep', duration_ms: 1, artists: [], type: 'episode' })).toBeNull();
    const t = api.mapTrack({
      id: 'abc',
      name: 'Song',
      duration_ms: 123000,
      artists: [{ name: 'A' }, { name: 'B' }],
      album: { name: 'Alb', images: [{ url: 'big', width: 1200 }, { url: 'mid', width: 640 }, { url: 'small', width: 64 }] },
      external_urls: { spotify: 'https://open.spotify.com/track/abc' },
    })!;
    expect(t).toMatchObject({ id: 'spotify:abc', provider: 'spotify', providerTrackId: 'abc', artworkUrl: 'mid', artists: ['A', 'B'] });
    expect(t.audioUrl).toBeUndefined(); // Spotify is never given an audio URL
  });
});
