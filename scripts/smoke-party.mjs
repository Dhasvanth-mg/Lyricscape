// HTTP-level smoke test for the whole party flow against a running dev/prod server.
//   node scripts/smoke-party.mjs [baseUrl]
// Uses two independent cookie jars (host + guest) like two phones would.

const BASE = process.argv[2] ?? 'http://127.0.0.1:3000';
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

class Client {
  jar = new Map();
  constructor(name) {
    this.name = name;
  }
  async req(method, path, body, extra = {}) {
    const headers = { ...(body !== undefined && !(body instanceof Buffer) ? { 'content-type': 'application/json' } : {}), ...extra.headers };
    const cookie = [...this.jar].map(([k, v]) => `${k}=${v}`).join('; ');
    if (cookie) headers.cookie = cookie;
    const res = await fetch(BASE + path, {
      method,
      headers,
      body: body === undefined ? undefined : body instanceof Buffer ? body : JSON.stringify(body),
    });
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [pair] = c.split(';');
      const i = pair.indexOf('=');
      const k = pair.slice(0, i);
      const v = pair.slice(i + 1);
      if (/Max-Age=0|expires=Thu, 01 Jan 1970/i.test(c)) this.jar.delete(k);
      else this.jar.set(k, v);
    }
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
    return { status: res.status, json, headers: res.headers };
  }
}

let failures = 0;
function check(label, cond, detail = '') {
  if (cond) console.log(`  ✓ ${label}`);
  else {
    failures++;
    console.log(`  ✗ ${label} ${detail}`);
  }
}

const host = new Client('host');
const guest = new Client('guest');
const stranger = new Client('stranger');

console.log('health');
check('GET /api/health', (await host.req('GET', '/api/health')).json.ok === true);

console.log('host creates a party');
const handle = 'smoke_' + Math.random().toString(36).slice(2, 8);
let r = await host.req('POST', '/api/auth/local', { handle, displayName: 'Smoke Host' });
check('login', r.status === 200, JSON.stringify(r.json));
r = await host.req('POST', '/api/events', { title: 'Smoke Test Party', settings: { guestUploads: 'approval', songApproval: true } });
check('create event', r.status === 201 && r.json.inviteToken, JSON.stringify(r.json));
const { event, inviteToken } = r.json;

console.log('public preview + isolation');
r = await stranger.req('GET', `/api/join/${inviteToken}`);
check('preview works without auth', r.status === 200 && r.json.eventTitle === 'Smoke Test Party');
r = await stranger.req('GET', `/api/events/${event.id}`);
check('event id alone grants nothing (404)', r.status === 404);
r = await stranger.req('GET', `/api/events/${event.slug}`);
check('slug alone grants nothing (404)', r.status === 404);
r = await stranger.req('GET', `/api/events/${event.id}/stream`);
check('stream requires auth (404)', r.status === 404);

console.log('guest joins from "another phone"');
r = await guest.req('POST', `/api/events/${event.id}/join`, { token: inviteToken, displayName: 'Guesty McGuest' });
check('join', r.status === 200 && r.json.role === 'guest', JSON.stringify(r.json));
r = await guest.req('GET', `/api/events/${event.id}`);
check('guest snapshot', r.status === 200 && r.json.me.role === 'guest');
check('no secrets in snapshot', !/passcodeHash|guestSecretHash|tokenHash/.test(JSON.stringify(r.json)));

console.log('songs');
r = await guest.req('POST', `/api/events/${event.id}/song-requests`, { provider: 'demo', providerTrackId: 'neon-static', title: 'Neon Static', artists: ['Lyricscape Demo Lab'] });
check('suggest', r.status === 201 && r.json.status === 'pending', JSON.stringify(r.json));
const reqId = r.json.id;
r = await guest.req('PATCH', `/api/events/${event.id}/requests/${reqId}`, { status: 'approved' });
check('guest cannot approve (403)', r.status === 403);
r = await host.req('PATCH', `/api/events/${event.id}/requests/${reqId}`, { status: 'approved' });
check('host approves', r.status === 200 && r.json.queue.includes(reqId));
r = await host.req('POST', `/api/events/${event.id}/requests/${reqId}/vote`, { value: 1 });
check('vote', r.status === 200);

console.log('uploads (signed URL flow)');
r = await guest.req('POST', `/api/events/${event.id}/media/upload-intent`, { fileName: 'cake.png', mime: 'image/png', size: PNG.length });
check('upload intent', r.status === 201 && r.json.uploadUrl, JSON.stringify(r.json));
const { mediaId, uploadUrl } = r.json;
r = await stranger.req('PUT', uploadUrl.replace(/t=[^&]+/, 't=forged'), PNG, { headers: { 'content-type': 'image/png' } });
check('forged upload signature rejected (403)', r.status === 403);
r = await stranger.req('PUT', uploadUrl, PNG, { headers: { 'content-type': 'image/png' } });
check('signed PUT works with no cookies (like presigned R2)', r.status === 200, JSON.stringify(r.json));
r = await guest.req('POST', `/api/events/${event.id}/media/complete`, { mediaId });
check('complete -> pending (needs host approval)', r.status === 200 && r.json.status === 'pending', JSON.stringify(r.json));
r = await host.req('GET', `/api/events/${event.id}/media`);
const m = r.json.media.find((x) => x.id === mediaId);
check('host sees pending upload', !!m && m.status === 'pending');
r = await host.req('PATCH', `/api/events/${event.id}/media/${mediaId}`, { status: 'approved' });
check('host approves media', r.status === 200);
r = await guest.req('GET', `/api/events/${event.id}/media`);
const url = r.json.media[0].url;
const img = await fetch(BASE + url);
const bytes = Buffer.from(await img.arrayBuffer());
check('signed GET returns the exact bytes', img.status === 200 && bytes.equals(PNG) && img.headers.get('content-type') === 'image/png');
const bad = await fetch(BASE + url.replace(/t=[^&]+/, 't=nope'));
check('forged read signature rejected', bad.status === 403);
const ranged = await fetch(BASE + url, { headers: { range: 'bytes=0-3' } });
check('range request supported', ranged.status === 206 && (await ranged.arrayBuffer()).byteLength === 4);

r = await guest.req('POST', `/api/events/${event.id}/media/upload-intent`, { fileName: 'evil.png', mime: 'image/png', size: 40 });
await stranger.req('PUT', r.json.uploadUrl, Buffer.concat([Buffer.from('MZ'), Buffer.alloc(38)]), { headers: { 'content-type': 'image/png' } });
const evil = await guest.req('POST', `/api/events/${event.id}/media/complete`, { mediaId: r.json.mediaId });
check('fake image rejected on completion (422)', evil.status === 422 && evil.json.code === 'invalid_media', JSON.stringify(evil.json));

console.log('big screen');
r = await guest.req('POST', `/api/events/${event.id}/display`);
check('guest cannot mint display link (403)', r.status === 403);
r = await host.req('POST', `/api/events/${event.id}/display`);
check('host mints display link', r.status === 200 && r.json.displayToken);
const dt = r.json.displayToken;
r = await stranger.req('GET', `/api/events/${event.id}/display?d=${encodeURIComponent(dt)}`);
check('display snapshot via token only', r.status === 200 && r.json.media.length === 1 && r.json.joinToken);
r = await stranger.req('GET', `/api/events/${event.id}/display?d=bad`);
check('bad display token rejected', r.status === 404);

console.log('realtime (SSE)');
{
  const ctl = new AbortController();
  const cookie = [...guest.jar].map(([k, v]) => `${k}=${v}`).join('; ');
  const res = await fetch(`${BASE}/api/events/${event.id}/stream`, { headers: { cookie }, signal: ctl.signal });
  check('SSE opens', res.status === 200 && (res.headers.get('content-type') ?? '').includes('text/event-stream'));
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  const readUntil = async (needle, ms = 4000) => {
    const t0 = Date.now();
    while (!buf.includes(needle) && Date.now() - t0 < ms) {
      const { value, done } = await Promise.race([reader.read(), new Promise((r) => setTimeout(() => r({ done: true }), ms))]);
      if (done) break;
      buf += dec.decode(value);
    }
    return buf.includes(needle);
  };
  check('hello frame', await readUntil('event: hello'));
  await host.req('POST', `/api/events/${event.id}/song-requests`, { provider: 'demo', title: 'Another Song', artists: ['X'] });
  check('guest receives event.song.updated live', await readUntil('event: event.song.updated'));
  ctl.abort();
}

console.log('CSRF');
r = await guest.req('POST', `/api/events/${event.id}/song-requests`, { provider: 'demo', title: 'x', artists: ['y'] }, { headers: { origin: 'https://evil.example' } });
check('cross-origin write blocked (403)', r.status === 403 && r.json.code === 'bad_origin');

console.log('moderation + cleanup');
r = await host.req('GET', `/api/events/${event.id}`);
const guestMember = r.json.members.find((x) => x.role === 'guest');
r = await host.req('DELETE', `/api/events/${event.id}/members/${guestMember.id}`);
check('host removes guest', r.status === 200);
r = await guest.req('GET', `/api/events/${event.id}`);
check('removed guest locked out (403)', r.status === 403 && r.json.code === 'banned');
r = await host.req('DELETE', `/api/events/${event.id}`);
check('host deletes party', r.status === 200);
r = await host.req('GET', `/api/events/${event.id}`);
check('deleted party is gone (404)', r.status === 404);

console.log(failures ? `\n${failures} check(s) FAILED` : '\nall smoke checks passed');
process.exit(failures ? 1 : 0);
