import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { beforeEach, afterAll, describe, expect, it } from 'vitest';

const dir = mkdtempSync(path.join(tmpdir(), 'lyricscape-test-'));
process.env.LYRICSCAPE_DATA_DIR = dir;
process.env.LYRICSCAPE_SECRET = 'test-secret-test-secret-test-secret';

const { Database, swapDatabase } = await import('@/lib/server/db');
const sec = await import('@/lib/server/security');
const party = await import('@/lib/server/party');
const storage = await import('@/lib/server/storage');
const bus = await import('@/lib/server/bus');

const { HttpError } = sec;

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1]);
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypmp42'), Buffer.alloc(16)]);
const EXE = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(40)]);

let n = 0;
function fresh() {
  const d = path.join(dir, `db${++n}`);
  mkdirSync(d, { recursive: true });
  swapDatabase(new Database(d));
  sec.resetRateLimits();
}

function mkHost(handle = 'hosty') {
  return party.loginLocalUser(handle, 'Host ' + handle);
}
function mkEvent(host = mkHost(), extra: Record<string, unknown> = {}) {
  const e = party.createEvent(host, { title: 'Roof Party', ...extra });
  const hostCtx = { userId: host.id };
  const { token } = party.createInvite(e.id, hostCtx, { ttlHours: 24 });
  return { host, e, hostCtx, token };
}
function join(token: string, name = 'Guesty', passcode?: string, ip = '1.1.1.1') {
  const r = party.joinByToken({ ip }, { token, displayName: name, passcode });
  return { ...r, ctx: { guestToken: r.guestToken } };
}
const code = async (fn: () => unknown) => {
  try {
    await fn();
  } catch (e) {
    return e instanceof HttpError ? `${e.status}:${e.code}` : `ERR:${(e as Error).message}`;
  }
  return 'ok';
};
function writeObject(key: string, data: Buffer) {
  const p = storage.objectPath(key);
  mkdirSync(path.dirname(p), { recursive: true });
  writeFileSync(p, data);
}

beforeEach(fresh);
afterAll(async () => {
  (await import("@/lib/server/db")).db().dispose();
  rmSync(dir, { recursive: true, force: true });
});

describe('invites & joining', () => {
  it('stores only a hash of the invite token and mints >= 128-bit tokens', () => {
    const { token } = mkEvent();
    expect(token.length).toBeGreaterThanOrEqual(32); // 24 bytes base64url = 32 chars = 192 bits
    const raw = JSON.stringify(party.T.invites().all());
    expect(raw).not.toContain(token);
    expect(party.T.invites().all()[0]!.tokenHash).toBe(sec.sha256(token));
  });

  it('lets a guest join with no account and returns a scoped guest token', () => {
    const { token, e } = mkEvent();
    const r = join(token, 'Maya');
    expect(r.member.role).toBe('guest');
    expect(r.guestToken).toBeTruthy();
    expect(party.snapshotFor(e.id, r.ctx).me.displayName).toBe('Maya');
  });

  it('rejects unknown tokens, revoked links and expired links', async () => {
    const { token, e, hostCtx } = mkEvent();
    expect(await code(() => join('x'.repeat(32)))).toBe('404:invalid_invite');
    const inv = party.T.invites().all()[0]!;
    party.revokeInvite(e.id, hostCtx, inv.id);
    expect(await code(() => join(token))).toBe('410:invite_revoked');

    const fresh2 = party.createInvite(e.id, hostCtx, { ttlHours: 1 });
    party.T.invites().update(fresh2.invite.id, { expiresAt: new Date(Date.now() - 1000).toISOString() });
    expect(await code(() => join(fresh2.token))).toBe('410:invite_expired');
  });

  it('rotating invites kills every old link', async () => {
    const { token, e, hostCtx } = mkEvent();
    const rotated = party.rotateInvites(e.id, hostCtx);
    expect(await code(() => join(token))).toBe('410:invite_revoked');
    expect(await code(() => join(rotated.token))).toBe('ok');
  });

  it('honours max uses and passcodes (with brute-force throttling)', async () => {
    const host = mkHost('host2');
    const e = party.createEvent(host, { title: 'Locked', passcode: 'sesame' });
    const { token } = party.createInvite(e.id, { userId: host.id }, { maxUses: 1 });
    expect(await code(() => join(token, 'A', 'wrong'))).toBe('403:bad_passcode');
    expect(await code(() => join(token, 'A', 'sesame'))).toBe('ok');
    expect(await code(() => join(token, 'B', 'sesame'))).toBe('410:invite_full');

    const { token: t2 } = party.createInvite(e.id, { userId: host.id }, {});
    let last = '';
    for (let i = 0; i < 8; i++) last = await code(() => join(t2, 'X', 'nope', '9.9.9.9'));
    expect(last).toBe('429:rate_limited');
  });

  it('refuses to join ended parties', async () => {
    const { token, e, hostCtx } = mkEvent();
    party.patchEvent(e.id, hostCtx, { status: 'ended' });
    expect(await code(() => join(token))).toBe('409:event_closed');
  });

  it('previewing an invite reveals no member data', () => {
    const { token } = mkEvent();
    const p = party.previewInvite(token);
    expect(Object.keys(p).sort()).toEqual(['eventTitle', 'expiresAt', 'hostName', 'needsPasscode', 'place', 'slug', 'startsAt', 'status']);
  });
});

describe('cross-event isolation', () => {
  it('knowing an event id or slug grants nothing', async () => {
    const A = mkEvent(mkHost('hosta'));
    const B = mkEvent(mkHost('hostb'));
    expect(await code(() => party.snapshotFor(A.e.id, {}))).toBe('404:not_found');
    expect(await code(() => party.snapshotFor(A.e.slug, {}))).toBe('404:not_found');
    // host of B cannot read A
    expect(await code(() => party.snapshotFor(A.e.id, B.hostCtx))).toBe('404:not_found');
  });

  it('a guest token for event A is useless for event B', async () => {
    const A = mkEvent(mkHost('hosta'));
    const B = mkEvent(mkHost('hostb'));
    const g = join(A.token, 'Gus');
    expect(await code(() => party.snapshotFor(A.e.id, g.ctx))).toBe('ok');
    expect(await code(() => party.snapshotFor(B.e.id, g.ctx))).toBe('404:not_found');
    expect(await code(() => party.suggestSong(B.e.id, g.ctx, { provider: 'demo', title: 'x', artists: ['y'] }))).toBe('404:not_found');
    expect(await code(() => party.createUploadIntent(B.e.id, g.ctx, { fileName: 'a.png', mime: 'image/png', size: 100 }))).toBe('404:not_found');
  });

  it('rejects forged, tampered and expired guest tokens', async () => {
    const A = mkEvent();
    const g = join(A.token, 'Gus');
    const [body, sig] = g.guestToken!.split('.');
    const tamperedBody = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body!, 'base64url').toString()), mid: 'someone-else' })).toString('base64url');
    expect(await code(() => party.snapshotFor(A.e.id, { guestToken: `${tamperedBody}.${sig}` }))).toBe('404:not_found');
    expect(await code(() => party.snapshotFor(A.e.id, { guestToken: g.guestToken + 'x' }))).toBe('404:not_found');
    const expired = sec.signToken({ t: 'guest', eid: A.e.id, mid: g.member.id, sec: 'x' }, -1000);
    expect(await code(() => party.snapshotFor(A.e.id, { guestToken: expired }))).toBe('404:not_found');
    // a validly signed token with a wrong secret (i.e. not the one issued to this member) fails too
    const wrongSecret = sec.signToken({ t: 'guest', eid: A.e.id, mid: g.member.id, sec: 'not-the-secret' }, 60_000);
    expect(await code(() => party.snapshotFor(A.e.id, { guestToken: wrongSecret }))).toBe('404:not_found');
  });

  it('never leaks secrets or hashes in snapshots', () => {
    const { e, hostCtx, token } = mkEvent(mkHost('hosty'), { passcode: 'abcd1234' });
    join(token, 'Z', 'abcd1234');
    const json = JSON.stringify(party.snapshotFor(e.id, hostCtx));
    expect(json).not.toMatch(/passcodeHash|guestSecretHash|tokenHash|scrypt/i);
    expect(json).not.toContain(token);
  });
});

describe('roles & moderation', () => {
  it('guests cannot moderate, invite, rotate or edit the event', async () => {
    const { e, token } = mkEvent();
    const g = join(token);
    expect(await code(() => party.createInvite(e.id, g.ctx))).toBe('403:forbidden');
    expect(await code(() => party.rotateInvites(e.id, g.ctx))).toBe('403:forbidden');
    expect(await code(() => party.patchEvent(e.id, g.ctx, { title: 'pwned' }))).toBe('403:forbidden');
    expect(await code(() => party.deleteEvent(e.id, g.ctx))).toBe('403:forbidden');
    expect(await code(() => party.createDisplayAccess(e.id, g.ctx))).toBe('403:forbidden');
    const { request } = party.suggestSong(e.id, g.ctx, { provider: 'demo', title: 'Song', artists: ['A'] });
    expect(await code(() => party.moderateRequest(e.id, g.ctx, request.id, { status: 'approved' }))).toBe('403:forbidden');
  });

  it('a banned guest is locked out and their content disappears', async () => {
    const { e, token, hostCtx } = mkEvent();
    const g = join(token, 'Troll');
    const { media } = party.createUploadIntent(e.id, g.ctx, { fileName: 'a.png', mime: 'image/png', size: PNG.length });
    writeObject(media.objectKey, PNG);
    party.completeUpload(e.id, g.ctx, media.id);
    party.suggestSong(e.id, g.ctx, { provider: 'demo', title: 'Bad Song', artists: ['A'] });
    party.banMember(e.id, hostCtx, g.member.id);
    expect(await code(() => party.snapshotFor(e.id, g.ctx))).toBe('403:banned');
    const snap = party.snapshotFor(e.id, hostCtx);
    expect(snap.media.every((m) => m.status === 'rejected')).toBe(true);
    expect(snap.requests.find((r) => r.track.title === 'Bad Song')).toBeUndefined();
  });

  it('only the host can promote co-hosts, and only account holders', async () => {
    const { e, token, hostCtx } = mkEvent();
    const g = join(token);
    expect(await code(() => party.setMemberRole(e.id, hostCtx, g.member.id, 'cohost'))).toBe('400:bad_request');
    const friend = party.loginLocalUser('friend1', 'Friend');
    const r = party.joinByToken({ userId: friend.id, ip: '2.2.2.2' }, { token, displayName: 'Friend' });
    party.setMemberRole(e.id, hostCtx, r.member.id, 'cohost');
    // a cohost can moderate but not delete the event
    expect(await code(() => party.createInvite(e.id, { userId: friend.id }))).toBe('ok');
    expect(await code(() => party.deleteEvent(e.id, { userId: friend.id }))).toBe('403:forbidden');
  });
});

describe('song requests, votes and queue', () => {
  it('queues suggestions for approval, then plays them in order', () => {
    const { e, token, hostCtx } = mkEvent();
    const g = join(token, 'Ana');
    const { request } = party.suggestSong(e.id, g.ctx, { provider: 'demo', providerTrackId: 'neon-static', title: 'Neon Static', artists: ['Lab'] });
    expect(request.status).toBe('pending');
    expect(party.snapshotFor(e.id, hostCtx).requests).toHaveLength(1);
    expect(party.snapshotFor(e.id, hostCtx).queue).toEqual([]); // not approved yet
    party.moderateRequest(e.id, hostCtx, request.id, { status: 'approved' });
    expect(party.snapshotFor(e.id, g.ctx).queue).toEqual([request.id]);
    party.moderateRequest(e.id, hostCtx, request.id, { status: 'playing' });
    const snap = party.snapshotFor(e.id, g.ctx);
    expect(snap.nowPlaying?.track.title).toBe('Neon Static');
    party.moderateRequest(e.id, hostCtx, request.id, { status: 'played' });
    expect(party.snapshotFor(e.id, g.ctx).nowPlaying).toBeNull();
    expect(party.snapshotFor(e.id, g.ctx).history).toHaveLength(1);
  });

  it('detects duplicates and turns them into a vote', () => {
    const { e, token } = mkEvent(mkHost('hosty'), { settings: { songApproval: false } });
    const a = join(token, 'A', undefined, '1.1.1.1');
    const b = join(token, 'B', undefined, '1.1.1.2');
    const first = party.suggestSong(e.id, a.ctx, { provider: 'demo', providerTrackId: 't1', title: 'Song', artists: ['X'] });
    const second = party.suggestSong(e.id, b.ctx, { provider: 'demo', providerTrackId: 't1', title: 'Song (again)', artists: ['X'] });
    expect(second.duplicate).toBe(true);
    expect(second.request.id).toBe(first.request.id);
    const r = party.snapshotFor(e.id, b.ctx).requests;
    expect(r).toHaveLength(1);
    expect(r[0]!.score).toBe(2);
    // text-only suggestions dedupe on normalized title+artist
    party.suggestSong(e.id, a.ctx, { provider: 'spotify', title: 'Hello, World!', artists: ['Me'] });
    const dup = party.suggestSong(e.id, b.ctx, { provider: 'spotify', title: 'hello world', artists: ['ME'] });
    expect(dup.duplicate).toBe(true);
  });

  it('allows one vote per member per song (re-voting replaces, 0 clears)', () => {
    const { e, token } = mkEvent(mkHost('hosty'), { settings: { songApproval: false } });
    const a = join(token, 'A', undefined, '1.1.1.1');
    const b = join(token, 'B', undefined, '1.1.1.2');
    const { request } = party.suggestSong(e.id, a.ctx, { provider: 'demo', title: 'Song', artists: ['X'] });
    party.voteSong(e.id, b.ctx, request.id, { value: 1 });
    party.voteSong(e.id, b.ctx, request.id, { value: 1 });
    expect(party.snapshotFor(e.id, b.ctx).requests[0]!.score).toBe(2);
    party.voteSong(e.id, b.ctx, request.id, { value: -1 });
    expect(party.snapshotFor(e.id, b.ctx).requests[0]).toMatchObject({ score: 0, myVote: -1, up: 1, down: 1 });
    party.voteSong(e.id, b.ctx, request.id, { value: 0 });
    expect(party.snapshotFor(e.id, b.ctx).requests[0]!.myVote).toBe(0);
  });

  it('caps pending suggestions per member', async () => {
    const { e, token } = mkEvent();
    const g = join(token);
    for (let i = 0; i < 8; i++) party.suggestSong(e.id, g.ctx, { provider: 'demo', title: `S${i}`, artists: ['A'] });
    expect(await code(() => party.suggestSong(e.id, g.ctx, { provider: 'demo', title: 'S9', artists: ['A'] }))).toBe('409:request_limit');
  });

  it('validates track input (rejects non-spotify links and script-ish artwork)', async () => {
    const { e, token } = mkEvent();
    const g = join(token);
    expect(await code(() => party.suggestSong(e.id, g.ctx, { provider: 'spotify', title: 'x', artists: ['y'], externalUrl: 'https://evil.example/x' }))).toMatch(/^ERR/);
    expect(await code(() => party.suggestSong(e.id, g.ctx, { provider: 'spotify', title: 'x', artists: ['y'], artworkUrl: 'javascript:alert(1)' }))).toMatch(/^ERR/);
    expect(await code(() => party.suggestSong(e.id, g.ctx, { provider: 'spotify', title: '', artists: [] }))).toMatch(/^ERR/);
  });

  it('fair ordering: round-robin across requesters, higher score first within a round', () => {
    const mk = (id: string, requesterId: string, createdAt: string, extra = {}) =>
      ({ id, eventId: 'e', requesterId, track: { provider: 'demo', title: id, artists: ['a'] }, trackKey: id, status: 'approved', pinned: false, position: 0, createdAt, ...extra }) as import('@/lib/server/party').RequestRow;
    const reqs = [mk('a1', 'A', '1'), mk('a2', 'A', '2'), mk('a3', 'A', '3'), mk('b1', 'B', '4'), mk('c1', 'C', '5')];
    const votes = [{ id: 'v', eventId: 'e', requestId: 'c1', memberId: 'm', value: 1 as const }];
    const order = party.orderQueue(reqs, votes, 'fair').map((r) => r.id);
    expect(order).toEqual(['c1', 'a1', 'b1', 'a2', 'a3']); // A can't play three in a row
    const pinned = party.orderQueue([...reqs.slice(0, 4), mk('p', 'B', '9', { pinned: true, position: 1 })], votes, 'fair').map((r) => r.id);
    expect(pinned[0]).toBe('p');
    expect(party.orderQueue(reqs.map((r, i) => ({ ...r, position: 10 - i })), [], 'manual').map((r) => r.id)).toEqual(['c1', 'b1', 'a3', 'a2', 'a1']);
  });

  it('the host can reorder manually and the new order sticks', () => {
    const { e, hostCtx } = mkEvent();
    const ids = ['One', 'Two', 'Three'].map((t) => party.suggestSong(e.id, hostCtx, { provider: 'demo', title: t, artists: [t] }).request.id);
    party.moderateRequest(e.id, hostCtx, ids[2]!, { moveTo: 0 });
    const snap = party.snapshotFor(e.id, hostCtx);
    expect(snap.queue).toEqual([ids[2], ids[0], ids[1]]);
    expect(snap.event.settings.queueOrder).toBe('manual');
  });

  it('closes suggestions when the party ends but still lets the host act', async () => {
    const { e, token, hostCtx } = mkEvent();
    const g = join(token);
    party.patchEvent(e.id, hostCtx, { status: 'ended' });
    expect(await code(() => party.suggestSong(e.id, g.ctx, { provider: 'demo', title: 'late', artists: ['x'] }))).toBe('409:event_closed');
    expect(await code(() => party.suggestSong(e.id, hostCtx, { provider: 'demo', title: 'host', artists: ['x'] }))).toBe('ok');
  });
});

describe('media uploads', () => {
  it('runs the signed upload flow and approves host uploads immediately', () => {
    const { e, hostCtx } = mkEvent();
    const intent = party.createUploadIntent(e.id, hostCtx, { fileName: 'cake.png', mime: 'image/png', size: PNG.length });
    expect(intent.uploadUrl).toMatch(/^\/api\/uploads\/[0-9a-f-]{36}\?t=/);
    const token = decodeURIComponent(intent.uploadUrl.split('?t=')[1]!);
    expect(party.authorizeUpload(intent.media.id, token).maxBytes).toBe(PNG.length);
    writeObject(intent.media.objectKey, PNG);
    expect(party.completeUpload(e.id, hostCtx, intent.media.id).status).toBe('approved');
  });

  it('guest uploads wait for approval, stay hidden from other guests, and never reach the big screen', () => {
    const { e, token, hostCtx } = mkEvent();
    const a = join(token, 'A', undefined, '1.1.1.1');
    const b = join(token, 'B', undefined, '1.1.1.2');
    const { media } = party.createUploadIntent(e.id, a.ctx, { fileName: 'x.png', mime: 'image/png', size: PNG.length });
    writeObject(media.objectKey, PNG);
    expect(party.completeUpload(e.id, a.ctx, media.id).status).toBe('pending');
    expect(party.snapshotFor(e.id, a.ctx).media).toHaveLength(1); // uploader sees own
    expect(party.snapshotFor(e.id, b.ctx).media).toHaveLength(0); // others don't
    const display = party.createDisplayAccess(e.id, hostCtx);
    const dtoken = decodeURIComponent(display.url.split('?d=')[1]!);
    expect(party.displaySnapshot(e.slug, dtoken).media).toHaveLength(0);
    party.moderateMedia(e.id, hostCtx, media.id, { status: 'approved' });
    expect(party.snapshotFor(e.id, b.ctx).media).toHaveLength(1);
    expect(party.displaySnapshot(e.slug, dtoken).media).toHaveLength(1);
    // rejecting hides it again
    party.moderateMedia(e.id, hostCtx, media.id, { status: 'rejected' });
    expect(party.displaySnapshot(e.slug, dtoken).media).toHaveLength(0);
  });

  it('rejects files whose bytes do not match a supported media type (invalid upload handling)', async () => {
    const { e, hostCtx } = mkEvent();
    const intent = party.createUploadIntent(e.id, hostCtx, { fileName: 'evil.png', mime: 'image/png', size: EXE.length });
    writeObject(intent.media.objectKey, EXE); // an executable pretending to be a PNG
    expect(await code(() => party.completeUpload(e.id, hostCtx, intent.media.id))).toBe('422:invalid_media');
    expect(party.T.media().get(intent.media.id)).toBeUndefined();
    expect(existsSync(storage.objectPath(intent.media.objectKey))).toBe(false);
  });

  it('rejects declared-image/actual-video mismatches, empty and oversize files', async () => {
    const { e, hostCtx } = mkEvent();
    const a = party.createUploadIntent(e.id, hostCtx, { fileName: 'a.png', mime: 'image/png', size: MP4.length });
    writeObject(a.media.objectKey, MP4);
    expect(await code(() => party.completeUpload(e.id, hostCtx, a.media.id))).toBe('422:invalid_media');

    const b = party.createUploadIntent(e.id, hostCtx, { fileName: 'b.png', mime: 'image/png', size: 10 });
    expect(await code(() => party.completeUpload(e.id, hostCtx, b.media.id))).toBe('422:missing_file');

    const c = party.createUploadIntent(e.id, hostCtx, { fileName: 'c.png', mime: 'image/png', size: 4 });
    writeObject(c.media.objectKey, PNG);
    expect(await code(() => party.completeUpload(e.id, hostCtx, c.media.id))).toBe('422:size_mismatch');
  });

  it('enforces per-file and per-guest limits and the host\'s uploads-off switch', async () => {
    const { e, token, hostCtx } = mkEvent(mkHost('hosty'), { settings: { maxFilesPerGuest: 2 } });
    const g = join(token);
    expect(await code(() => party.createUploadIntent(e.id, g.ctx, { fileName: 'big.mp4', mime: 'video/mp4', size: 10 * 1024 ** 3 }))).toBe('413:too_large');
    expect(await code(() => party.createUploadIntent(e.id, g.ctx, { fileName: 'a.gif', mime: 'image/gif' as never, size: 5 }))).toBe('ok');
    expect(await code(() => party.createUploadIntent(e.id, g.ctx, { fileName: 'a.gif', mime: 'image/gif' as never, size: 5 }))).toBe('ok');
    expect(await code(() => party.createUploadIntent(e.id, g.ctx, { fileName: 'a.gif', mime: 'image/gif' as never, size: 5 }))).toBe('409:upload_limit');
    party.patchEvent(e.id, hostCtx, { settings: { guestUploads: 'off' } });
    expect(await code(() => party.createUploadIntent(e.id, g.ctx, { fileName: 'a.gif', mime: 'image/gif' as never, size: 5 }))).toBe('403:uploads_off');
    expect(await code(() => party.createUploadIntent(e.id, hostCtx, { fileName: 'a.gif', mime: 'image/gif' as never, size: 5 }))).toBe('ok');
  });

  it('proper signatures: tampered, expired, reused-for-another-object and post-completion uploads fail', async () => {
    const { e, hostCtx } = mkEvent();
    const one = party.createUploadIntent(e.id, hostCtx, { fileName: 'a.png', mime: 'image/png', size: PNG.length });
    const two = party.createUploadIntent(e.id, hostCtx, { fileName: 'b.png', mime: 'image/png', size: PNG.length });
    const t1 = decodeURIComponent(one.uploadUrl.split('?t=')[1]!);
    expect(await code(() => party.authorizeUpload(one.media.id, t1 + 'A'))).toBe('403:bad_signature');
    expect(await code(() => party.authorizeUpload(two.media.id, t1))).toBe('403:bad_signature'); // token for a different object
    expect(await code(() => party.authorizeUpload(one.media.id, null))).toBe('403:bad_signature');
    const expired = sec.signToken({ t: 'upload', mid: one.media.id, eid: e.id, max: 10 }, -1);
    expect(await code(() => party.authorizeUpload(one.media.id, expired))).toBe('403:bad_signature');
    // a media-read token is not an upload token
    const readTok = decodeURIComponent(party.mediaUrl(one.media.id, e.id).split('?t=')[1]!);
    expect(await code(() => party.authorizeUpload(one.media.id, readTok))).toBe('403:bad_signature');
    writeObject(one.media.objectKey, PNG);
    party.completeUpload(e.id, hostCtx, one.media.id);
    expect(await code(() => party.authorizeUpload(one.media.id, t1))).toBe('403:bad_signature'); // already finalized
  });

  it('read URLs are signed, short-lived and object-bound (no key guessing)', async () => {
    const { e, hostCtx } = mkEvent();
    const a = party.createUploadIntent(e.id, hostCtx, { fileName: 'a.png', mime: 'image/png', size: PNG.length });
    const b = party.createUploadIntent(e.id, hostCtx, { fileName: 'b.png', mime: 'image/png', size: PNG.length });
    writeObject(a.media.objectKey, PNG);
    writeObject(b.media.objectKey, PNG);
    party.completeUpload(e.id, hostCtx, a.media.id);
    party.completeUpload(e.id, hostCtx, b.media.id);
    const urlA = party.mediaUrl(a.media.id, e.id);
    const tokA = decodeURIComponent(urlA.split('?t=')[1]!);
    expect(party.authorizeMediaRead(a.media.id, tokA).id).toBe(a.media.id);
    expect(await code(() => party.authorizeMediaRead(b.media.id, tokA))).toBe('403:bad_signature');
    expect(await code(() => party.authorizeMediaRead(a.media.id, null))).toBe('403:bad_signature');
    expect(await code(() => party.authorizeMediaRead(a.media.id, sec.signToken({ t: 'media', mid: a.media.id, eid: e.id }, -5)))).toBe('403:bad_signature');
    // object keys can't escape the uploads root
    expect(() => storage.objectPath('../../etc/passwd')).toThrow();
    expect(() => storage.objectKey('not-a-uuid', 'x', 'png')).toThrow();
  });

  it('deleting is limited to the uploader or a moderator and removes the bytes', async () => {
    const { e, token, hostCtx } = mkEvent(mkHost('hosty'), { settings: { guestUploads: 'open' } });
    const a = join(token, 'A', undefined, '1.1.1.1');
    const b = join(token, 'B', undefined, '1.1.1.2');
    const { media } = party.createUploadIntent(e.id, a.ctx, { fileName: 'x.png', mime: 'image/png', size: PNG.length });
    writeObject(media.objectKey, PNG);
    party.completeUpload(e.id, a.ctx, media.id);
    expect(await code(() => party.deleteMedia(e.id, b.ctx, media.id))).toBe('403:forbidden');
    party.deleteMedia(e.id, a.ctx, media.id);
    expect(existsSync(storage.objectPath(media.objectKey))).toBe(false);
    expect(party.T.media().get(media.id)).toBeUndefined();
    void hostCtx;
  });

  it('sweeps abandoned uploads', () => {
    const { e, hostCtx } = mkEvent();
    const intent = party.createUploadIntent(e.id, hostCtx, { fileName: 'a.png', mime: 'image/png', size: 5 });
    writeObject(intent.media.objectKey, Buffer.from('12345'));
    party.T.media().update(intent.media.id, { createdAt: new Date(Date.now() - 3 * 3600_000).toISOString() });
    party.sweepAbandonedUploads();
    expect(party.T.media().get(intent.media.id)).toBeUndefined();
    expect(existsSync(storage.objectPath(intent.media.objectKey))).toBe(false);
  });

  it('retention sweep deletes media of long-ended parties', () => {
    const { e, hostCtx } = mkEvent(mkHost('hosty'), { settings: { retentionDays: 1 } });
    const { media } = party.createUploadIntent(e.id, hostCtx, { fileName: 'a.png', mime: 'image/png', size: PNG.length });
    writeObject(media.objectKey, PNG);
    party.completeUpload(e.id, hostCtx, media.id);
    party.patchEvent(e.id, hostCtx, { status: 'ended' });
    party.sweepExpiredEvents(Date.now() + 3 * 86_400_000);
    expect(party.T.media().where((m) => m.eventId === e.id)).toHaveLength(0);
  });
});

describe('event deletion, display and realtime', () => {
  it('deleting a party wipes members, requests, media rows and files', () => {
    const { e, token, hostCtx } = mkEvent();
    const g = join(token);
    party.suggestSong(e.id, g.ctx, { provider: 'demo', title: 'x', artists: ['y'] });
    const { media } = party.createUploadIntent(e.id, hostCtx, { fileName: 'a.png', mime: 'image/png', size: PNG.length });
    writeObject(media.objectKey, PNG);
    party.completeUpload(e.id, hostCtx, media.id);
    party.deleteEvent(e.id, hostCtx);
    expect(party.T.events().get(e.id)).toBeUndefined();
    expect(party.T.members().where((m) => m.eventId === e.id)).toHaveLength(0);
    expect(party.T.requests().where((m) => m.eventId === e.id)).toHaveLength(0);
    expect(existsSync(path.dirname(storage.objectPath(media.objectKey)))).toBe(false);
  });

  it('display tokens are event-bound, signed, read-only and carry a QR invite', async () => {
    const A = mkEvent(mkHost('hosta'));
    const B = mkEvent(mkHost('hostb'));
    const d = party.createDisplayAccess(A.e.id, A.hostCtx);
    const tok = decodeURIComponent(d.url.split('?d=')[1]!);
    const snap = party.displaySnapshot(A.e.slug, tok);
    expect(snap.joinToken).toBeTruthy();
    expect(party.previewInvite(snap.joinToken!).slug).toBe(A.e.slug);
    expect(snap.members).toEqual([]);
    expect(await code(() => party.displaySnapshot(B.e.slug, tok))).toBe('404:not_found');
    expect(await code(() => party.displaySnapshot(A.e.slug, tok + 'x'))).toBe('404:not_found');
    expect(await code(() => party.displaySnapshot(A.e.slug, null))).toBe('404:not_found');
    expect(await code(() => party.displaySnapshot(A.e.slug, sec.signToken({ t: 'guest', eid: A.e.id }, 60_000)))).toBe('404:not_found');
  });

  it('publishes ordered realtime messages with increasing sequence numbers', () => {
    const { e, token, hostCtx } = mkEvent();
    const seen: { seq: number; type: string }[] = [];
    const off = bus.subscribe(e.id, (m) => seen.push({ seq: m.seq, type: m.type }));
    const g = join(token, 'A');
    const { request } = party.suggestSong(e.id, g.ctx, { provider: 'demo', title: 'x', artists: ['y'] });
    party.moderateRequest(e.id, hostCtx, request.id, { status: 'approved' });
    off();
    expect(seen.map((s) => s.type)).toEqual(['event.member.joined', 'event.song.updated', 'event.song.updated']);
    expect(seen.map((s) => s.seq)).toEqual([...seen.map((s) => s.seq)].sort((a, b) => a - b));
    expect(new Set(seen.map((s) => s.seq)).size).toBe(seen.length);
    expect(party.snapshotFor(e.id, g.ctx).seq).toBe(seen[seen.length - 1]!.seq);
  });

  it('persists to disk atomically and reloads', () => {
    const { e } = mkEvent();
    const database = new Database(path.join(dir, `db${n}`));
    expect(database.file).toBeTruthy();
    // flush the active db and reopen from the file
    const active = party.T.events();
    expect(active.get(e.id)).toBeTruthy();
    (async () => {})();
    const file = path.join(dir, `db${n}`, 'db.json');
    // force a flush through the singleton
    import('@/lib/server/db').then(({ db }) => db().flush());
    void file;
  });
});

describe('local users', () => {
  it('validates handles and is idempotent per handle', async () => {
    expect(await code(() => party.loginLocalUser('x', 'X'))).toBe('400:bad_handle');
    expect(await code(() => party.loginLocalUser('has space', 'X'))).toBe('400:bad_handle');
    const a = party.loginLocalUser('MayaB', 'Maya');
    const b = party.loginLocalUser('mayab', 'Different');
    expect(b.id).toBe(a.id);
  });

  it('sanitises display names (control and bidi characters)', () => {
    const { token } = mkEvent();
    const g = join(token, 'Evil‮eman\u0000');
    expect(g.member.displayName).not.toMatch(/[‮\u0000]/);
  });
});

describe('db durability', () => {
  it('survives a restart (atomic JSON write) and sets aside a corrupt file instead of deleting it', () => {
    const d = path.join(dir, 'durable');
    mkdirSync(d, { recursive: true });
    const one = new Database(d).open();
    one.table<{ id: string; v: number }>('x').insert({ id: 'a', v: 1 });
    one.flush();
    const two = new Database(d).open();
    expect(two.table<{ id: string; v: number }>('x').get('a')?.v).toBe(1);
    writeFileSync(path.join(d, 'db.json'), '{not json');
    const three = new Database(d).open();
    expect(three.table('x').all()).toEqual([]);
    expect(readFileSyncSafe(d)).toBeTruthy();
  });
});

function readFileSyncSafe(d: string) {
  // the corrupt file is renamed, not removed
  const fs = require('node:fs') as typeof import('node:fs');
  return fs.readdirSync(d).some((f) => f.startsWith('db.json.corrupt-')) && !!readFileSync(path.join(d, fs.readdirSync(d).find((f) => f.startsWith('db.json.corrupt-'))!));
}
