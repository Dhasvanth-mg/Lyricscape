// Spotify Authorization Code flow with PKCE, entirely in the browser (public client:
// no client secret anywhere). Tokens live in localStorage on this machine only.

export const SPOTIFY_SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
].join(' ');

const TOKEN_KEY = 'lyricscape.spotify.tokens';
const CLIENT_KEY = 'lyricscape.spotify.clientId';
const FLOW_KEY = 'lyricscape.spotify.flow';

export type SpotifyTokens = { accessToken: string; refreshToken?: string; expiresAt: number; scope?: string };

export class SpotifyAuthError extends Error {
  constructor(
    message: string,
    public code: 'not-configured' | 'not-connected' | 'refresh-failed' | 'state-mismatch' | 'denied' | 'exchange-failed' | 'bad-origin',
  ) {
    super(message);
  }
}

const hasWindow = () => typeof window !== 'undefined';

function safeGet(key: string): string | null {
  try {
    return hasWindow() ? window.localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}
function safeSet(key: string, value: string | null) {
  try {
    if (!hasWindow()) return;
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
}

export function getClientId(): string | null {
  return safeGet(CLIENT_KEY) || process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID || null;
}
export function setClientId(id: string) {
  safeSet(CLIENT_KEY, id.trim() || null);
}

/** Spotify only accepts loopback IP literals (not "localhost") for http redirect URIs. */
export function redirectUri(): string {
  if (!hasWindow()) return 'http://127.0.0.1:3000/spotify/callback';
  const o = window.location;
  const host = o.hostname === 'localhost' ? '127.0.0.1' : o.hostname;
  return `${o.protocol}//${host}${o.port ? ':' + o.port : ''}/spotify/callback`;
}

export function isLocalhostOrigin(): boolean {
  return hasWindow() && window.location.hostname === 'localhost';
}

export function readTokens(): SpotifyTokens | null {
  const raw = safeGet(TOKEN_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SpotifyTokens;
  } catch {
    return null;
  }
}
function writeTokens(t: SpotifyTokens | null) {
  safeSet(TOKEN_KEY, t ? JSON.stringify(t) : null);
  if (hasWindow()) window.dispatchEvent(new CustomEvent('lyricscape:spotify-auth'));
}

export function isConnected(): boolean {
  return !!readTokens();
}

export function disconnect() {
  writeTokens(null);
  safeSet(FLOW_KEY, null);
}

// ---- PKCE helpers --------------------------------------------------------------
function base64Url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function randomString(byteLen = 48): string {
  const a = new Uint8Array(byteLen);
  crypto.getRandomValues(a);
  return base64Url(a);
}

export async function challengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64Url(digest);
}

export async function buildAuthUrl(): Promise<string> {
  const clientId = getClientId();
  if (!clientId) throw new SpotifyAuthError('Add your Spotify Client ID in Settings first.', 'not-configured');
  const verifier = randomString(64);
  const state = randomString(24);
  const challenge = await challengeFor(verifier);
  // sessionStorage keeps the verifier scoped to this tab/flow
  window.sessionStorage.setItem(FLOW_KEY, JSON.stringify({ verifier, state, redirect: redirectUri(), at: Date.now() }));
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: SPOTIFY_SCOPES,
    redirect_uri: redirectUri(),
    state,
    code_challenge_method: 'S256',
    code_challenge: challenge,
  });
  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

export async function startLogin() {
  window.location.assign(await buildAuthUrl());
}

export async function completeLogin(search: string): Promise<void> {
  const params = new URLSearchParams(search);
  const error = params.get('error');
  if (error) throw new SpotifyAuthError(error === 'access_denied' ? 'You declined the Spotify permissions.' : `Spotify error: ${error}`, 'denied');
  const code = params.get('code');
  const state = params.get('state');
  const raw = window.sessionStorage.getItem(FLOW_KEY);
  window.sessionStorage.removeItem(FLOW_KEY);
  if (!raw || !code) throw new SpotifyAuthError('No login in progress. Start again from Settings.', 'state-mismatch');
  const flow = JSON.parse(raw) as { verifier: string; state: string; redirect: string; at: number };
  if (flow.state !== state) throw new SpotifyAuthError('Security check failed (state mismatch). Start again.', 'state-mismatch');
  if (Date.now() - flow.at > 15 * 60_000) throw new SpotifyAuthError('Login took too long. Start again.', 'state-mismatch');
  const clientId = getClientId();
  if (!clientId) throw new SpotifyAuthError('Client ID missing.', 'not-configured');

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: flow.redirect,
      client_id: clientId,
      code_verifier: flow.verifier,
    }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error_description?: string };
    throw new SpotifyAuthError(body.error_description ?? `Token exchange failed (${res.status})`, 'exchange-failed');
  }
  const data = (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number; scope?: string };
  writeTokens({
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    scope: data.scope,
  });
}

let refreshing: Promise<SpotifyTokens> | null = null;

async function refresh(tokens: SpotifyTokens): Promise<SpotifyTokens> {
  const clientId = getClientId();
  if (!tokens.refreshToken || !clientId) {
    writeTokens(null);
    throw new SpotifyAuthError('Spotify session expired. Reconnect in Settings.', 'refresh-failed');
  }
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: tokens.refreshToken, client_id: clientId }),
  });
  if (!res.ok) {
    if (res.status === 400 || res.status === 401) writeTokens(null); // revoked / invalid grant
    throw new SpotifyAuthError('Spotify session expired or was revoked. Reconnect in Settings.', 'refresh-failed');
  }
  const data = (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number; scope?: string };
  const next: SpotifyTokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? tokens.refreshToken,
    expiresAt: Date.now() + data.expires_in * 1000,
    scope: data.scope ?? tokens.scope,
  };
  writeTokens(next);
  return next;
}

/** A valid access token, refreshing (once, shared across callers) when within 60s of expiry. */
export async function getAccessToken(forceRefresh = false): Promise<string> {
  const tokens = readTokens();
  if (!tokens) throw new SpotifyAuthError('Not connected to Spotify.', 'not-connected');
  if (!forceRefresh && tokens.expiresAt - Date.now() > 60_000) return tokens.accessToken;
  refreshing ??= refresh(tokens).finally(() => {
    refreshing = null;
  });
  return (await refreshing).accessToken;
}
