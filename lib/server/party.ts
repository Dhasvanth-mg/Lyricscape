import { randomUUID, scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { db } from './db';
import { limits } from './config';
import { HttpError, cleanText, rateLimit, randomToken, sha256, signToken, slugify, sniffMedia, verifyToken } from './security';
import { publish, onlineMembers, currentSeq, touchPresence } from './bus';
import { deleteEventObjects, deleteObject, objectKey, objectSize, readHead } from './storage';
import {
  createEventSchema,
  createInviteSchema,
  eventSettingsSchema,
  joinSchema,
  mediaPatchSchema,
  patchEventSchema,
  reportSchema,
  requestPatchSchema,
  trackRefSchema,
  uploadIntentSchema,
  voteSchema,
  type DisplaySnapshot,
  type EventDto,
  type EventSettings,
  type EventStatus,
  type MediaDto,
  type MemberDto,
  type PartySnapshot,
  type PlaybackDto,
  type Role,
  type SongRequestDto,
  type TrackRef,
} from '../party/schemas';

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------
export type UserRow = { id: string; handle: string; displayName: string; createdAt: string };
export type EventRow = {
  id: string;
  slug: string;
  hostId: string;
  title: string;
  description?: string;
  place?: string;
  timezone: string;
  startsAt?: string;
  endsAt?: string;
  status: EventStatus;
  passcodeHash?: string;
  settings: EventSettings;
  createdAt: string;
  updatedAt: string;
  endedAt?: string;
};
export type MemberRow = {
  id: string;
  eventId: string;
  userId?: string;
  guestSecretHash?: string;
  displayName: string;
  role: Role;
  joinedAt: string;
  banned?: boolean;
};
export type InviteRow = {
  id: string;
  eventId: string;
  tokenHash: string;
  label?: string;
  expiresAt: string;
  revokedAt?: string;
  maxUses?: number;
  uses: number;
  createdBy: string;
  createdAt: string;
};
export type RequestRow = {
  id: string;
  eventId: string;
  requesterId: string;
  track: TrackRef;
  trackKey: string;
  status: SongRequestDto['status'];
  pinned: boolean;
  position: number;
  createdAt: string;
};
export type VoteRow = { id: string; eventId: string; requestId: string; memberId: string; value: 1 | -1 };
export type MediaRow = {
  id: string;
  eventId: string;
  uploaderId: string;
  objectKey: string;
  mediaType: 'image' | 'video' | 'audio';
  mime: string;
  declaredMime: string;
  /** soundtrack audio only: uploader attested they hold the rights to use it in a recap */
  rightsAttested?: boolean;
  size: number;
  declaredSize: number;
  originalName: string;
  takenAt?: string;
  status: MediaDto['status'];
  recapConsent: boolean;
  mustInclude: boolean;
  createdAt: string;
  completedAt?: string;
};
export type PlaybackRow = { id: string; eventId: string; track: TrackRef; trackKey: string; startedAt: string; endedAt?: string };
export type AuditRow = { id: string; eventId: string; actorId: string; action: string; metadata: Record<string, unknown>; createdAt: string };
export type ReportRow = { id: string; eventId: string; reporterId: string; targetType: string; targetId: string; reason: string; status: 'open' | 'resolved'; createdAt: string };

export const T = {
  users: () => db().table<UserRow>('users'),
  events: () => db().table<EventRow>('events'),
  members: () => db().table<MemberRow>('event_members'),
  invites: () => db().table<InviteRow>('event_invites'),
  requests: () => db().table<RequestRow>('event_song_requests'),
  votes: () => db().table<VoteRow>('event_votes'),
  media: () => db().table<MediaRow>('event_media'),
  playback: () => db().table<PlaybackRow>('event_playback_log'),
  audit: () => db().table<AuditRow>('audit_logs'),
  reports: () => db().table<ReportRow>('reports'),
};

const now = () => new Date().toISOString();

// ---------------------------------------------------------------------------
// Caller context + authorization
// ---------------------------------------------------------------------------
export type Ctx = { userId?: string; guestToken?: string; ip?: string };

const isMod = (r: Role) => r === 'host' || r === 'cohost';

export function findEvent(key: string): EventRow | undefined {
  return T.events().get(key) ?? T.events().find((e) => e.slug === key);
}

/**
 * The only way to obtain a member for an event. Knowing an event id/slug grants nothing:
 * the caller must hold a valid user session that is a member, or a valid signed guest token.
 * Non-members receive the same 404 as a missing event.
 */
export function requireMember(eventKey: string, ctx: Ctx): { event: EventRow; member: MemberRow } {
  const event = findEvent(eventKey);
  const notFound = new HttpError(404, 'not_found', 'Party not found');
  if (!event) throw notFound;
  let member: MemberRow | undefined;
  if (ctx.userId) member = T.members().find((m) => m.eventId === event.id && m.userId === ctx.userId);
  if (!member && ctx.guestToken) {
    const p = verifyToken<{ t: string; eid: string; mid: string; sec: string }>(ctx.guestToken);
    if (p && p.t === 'guest' && p.eid === event.id) {
      const m = T.members().get(p.mid);
      if (m && m.eventId === event.id && m.guestSecretHash && m.guestSecretHash === sha256(p.sec)) member = m;
    }
  }
  if (!member) throw notFound;
  if (member.banned) throw new HttpError(403, 'banned', 'You have been removed from this party');
  return { event, member };
}

export function requireMod(eventKey: string, ctx: Ctx) {
  const r = requireMember(eventKey, ctx);
  if (!isMod(r.member.role)) throw new HttpError(403, 'forbidden', 'Only the host or a co-host can do that');
  return r;
}

export function requireHost(eventKey: string, ctx: Ctx) {
  const r = requireMember(eventKey, ctx);
  if (r.member.role !== 'host') throw new HttpError(403, 'forbidden', 'Only the host can do that');
  return r;
}

function assertOpenForGuests(event: EventRow, member: MemberRow) {
  if (isMod(member.role)) return;
  if (event.status === 'draft') throw new HttpError(409, 'event_closed', 'The host has not opened this party yet');
  if (event.status === 'ended' || event.status === 'archived') throw new HttpError(409, 'event_closed', 'This party has ended');
}

function audit(eventId: string, actorId: string, action: string, metadata: Record<string, unknown> = {}) {
  T.audit().insert({ id: randomUUID(), eventId, actorId, action, metadata, createdAt: now() });
}

// ---------------------------------------------------------------------------
// Users (local profile; no cloud auth)
// ---------------------------------------------------------------------------
export function loginLocalUser(handleRaw: string, displayNameRaw: string): UserRow {
  const handle = handleRaw.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,24}$/.test(handle)) throw new HttpError(400, 'bad_handle', 'Handle must be 3–24 letters, numbers or underscores');
  const displayName = cleanText(displayNameRaw, 40) || handle;
  const existing = T.users().find((u) => u.handle === handle);
  if (existing) return existing;
  return T.users().insert({ id: randomUUID(), handle, displayName, createdAt: now() });
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------
function hashPasscode(p: string): string {
  const salt = randomBytes(16);
  return `${salt.toString('hex')}:${scryptSync(p, salt, 32).toString('hex')}`;
}
function checkPasscode(p: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const a = scryptSync(p, Buffer.from(salt, 'hex'), 32);
  const b = Buffer.from(hash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

function uniqueSlug(title: string): string {
  const base = slugify(title);
  for (let i = 0; i < 20; i++) {
    const slug = `${base}-${randomToken(3).toLowerCase().replace(/[^a-z0-9]/g, 'x').slice(0, 4)}`;
    if (!T.events().find((e) => e.slug === slug)) return slug;
  }
  return `${base}-${randomUUID().slice(0, 8)}`;
}

export function createEvent(user: UserRow, raw: unknown): EventRow {
  const input = createEventSchema.parse(raw);
  rateLimit(`create-event:${user.id}`, 10, 60 * 60 * 1000);
  const settings = eventSettingsSchema.parse(input.settings ?? {});
  const t = now();
  const event = T.events().insert({
    id: randomUUID(),
    slug: uniqueSlug(input.title),
    hostId: user.id,
    title: cleanText(input.title, 80),
    description: input.description ? cleanText(input.description, 500) : undefined,
    place: input.place ? cleanText(input.place, 120) : undefined,
    timezone: input.timezone,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    status: 'scheduled',
    passcodeHash: input.passcode ? hashPasscode(input.passcode) : undefined,
    settings,
    createdAt: t,
    updatedAt: t,
  });
  T.members().insert({ id: randomUUID(), eventId: event.id, userId: user.id, displayName: user.displayName, role: 'host', joinedAt: t });
  audit(event.id, user.id, 'event.create');
  return event;
}

export function listEventsForUser(userId: string): (EventRow & { role: Role })[] {
  const mine = T.members().where((m) => m.userId === userId && !m.banned);
  return mine
    .map((m) => {
      const e = T.events().get(m.eventId);
      return e ? { ...e, role: m.role } : null;
    })
    .filter((e): e is EventRow & { role: Role } => !!e)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function patchEvent(eventKey: string, ctx: Ctx, raw: unknown): EventRow {
  const { event, member } = requireHost(eventKey, ctx);
  const p = patchEventSchema.parse(raw);
  const patch: Partial<EventRow> = { updatedAt: now() };
  if (p.title !== undefined) patch.title = cleanText(p.title, 80);
  if (p.description !== undefined) patch.description = p.description ? cleanText(p.description, 500) : undefined;
  if (p.place !== undefined) patch.place = p.place ? cleanText(p.place, 120) : undefined;
  if (p.startsAt !== undefined) patch.startsAt = p.startsAt ?? undefined;
  if (p.endsAt !== undefined) patch.endsAt = p.endsAt ?? undefined;
  if (p.passcode !== undefined) patch.passcodeHash = p.passcode ? hashPasscode(p.passcode) : undefined;
  if (p.settings) patch.settings = eventSettingsSchema.parse({ ...event.settings, ...p.settings });
  if (p.status && p.status !== event.status) {
    patch.status = p.status;
    if (p.status === 'ended' || p.status === 'archived') patch.endedAt = event.endedAt ?? now();
    if (p.status === 'live' || p.status === 'scheduled') patch.endedAt = undefined; // host may reopen
  }
  const updated = T.events().update(event.id, patch);
  audit(event.id, member.id, 'event.update', { fields: Object.keys(p) });
  publish(event.id, 'event.updated', { fields: Object.keys(p) });
  return updated;
}

export function deleteEvent(eventKey: string, ctx: Ctx) {
  const { event, member } = requireHost(eventKey, ctx);
  deleteEventObjects(event.id);
  T.media().deleteWhere((r) => r.eventId === event.id);
  T.votes().deleteWhere((r) => r.eventId === event.id);
  T.requests().deleteWhere((r) => r.eventId === event.id);
  T.playback().deleteWhere((r) => r.eventId === event.id);
  T.invites().deleteWhere((r) => r.eventId === event.id);
  T.reports().deleteWhere((r) => r.eventId === event.id);
  // recap projects/jobs live in tables owned by lib/server/recap.ts (rendered videos are under the event's upload dir)
  const projectIds = new Set(db().table<{ id: string; eventId: string }>('recap_projects').where((p) => p.eventId === event.id).map((p) => p.id));
  db().table<{ id: string; projectId: string }>('render_jobs').deleteWhere((j) => projectIds.has(j.projectId));
  db().table<{ id: string; projectId: string }>('recap_timelines').deleteWhere((t) => projectIds.has(t.projectId));
  db().table<{ id: string; eventId: string }>('recap_projects').deleteWhere((p) => p.eventId === event.id);
  T.members().deleteWhere((r) => r.eventId === event.id);
  T.events().delete(event.id);
  T.audit().deleteWhere((r) => r.eventId === event.id);
  publish(event.id, 'event.deleted');
  void member;
}

// ---------------------------------------------------------------------------
// Invites + joining
// ---------------------------------------------------------------------------
export function createInvite(eventKey: string, ctx: Ctx, raw: unknown = {}) {
  const { event, member } = requireMod(eventKey, ctx);
  const input = createInviteSchema.parse(raw);
  const token = randomToken(24); // 192 bits
  const invite = T.invites().insert({
    id: randomUUID(),
    eventId: event.id,
    tokenHash: sha256(token),
    label: input.label ? cleanText(input.label, 60) : undefined,
    expiresAt: new Date(Date.now() + input.ttlHours * 3600_000).toISOString(),
    maxUses: input.maxUses,
    uses: 0,
    createdBy: member.id,
    createdAt: now(),
  });
  audit(event.id, member.id, 'invite.create', { inviteId: invite.id });
  return { token, invite };
}

export function listInvites(eventKey: string, ctx: Ctx) {
  const { event } = requireMod(eventKey, ctx);
  return T.invites()
    .where((i) => i.eventId === event.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((i) => ({ id: i.id, label: i.label, expiresAt: i.expiresAt, revokedAt: i.revokedAt, uses: i.uses, maxUses: i.maxUses, createdAt: i.createdAt }));
}

export function revokeInvite(eventKey: string, ctx: Ctx, inviteId: string) {
  const { event, member } = requireMod(eventKey, ctx);
  const inv = T.invites().get(inviteId);
  if (!inv || inv.eventId !== event.id) throw new HttpError(404, 'not_found', 'Invite not found');
  T.invites().update(inv.id, { revokedAt: now() });
  audit(event.id, member.id, 'invite.revoke', { inviteId });
}

/** Revoke every active link and mint a fresh one (link rotation). */
export function rotateInvites(eventKey: string, ctx: Ctx) {
  const { event, member } = requireHost(eventKey, ctx);
  for (const i of T.invites().where((i) => i.eventId === event.id && !i.revokedAt)) T.invites().update(i.id, { revokedAt: now() });
  audit(event.id, member.id, 'invite.rotate');
  return createInvite(event.id, ctx, { label: 'rotated' });
}

function resolveInvite(token: string): { invite: InviteRow; event: EventRow } {
  const hash = sha256(token);
  const invite = T.invites().find((i) => i.tokenHash === hash);
  if (!invite) throw new HttpError(404, 'invalid_invite', 'This invite link is not valid');
  const event = T.events().get(invite.eventId);
  if (!event) throw new HttpError(404, 'invalid_invite', 'This invite link is not valid');
  if (invite.revokedAt) throw new HttpError(410, 'invite_revoked', 'The host has turned this invite link off');
  if (Date.parse(invite.expiresAt) < Date.now()) throw new HttpError(410, 'invite_expired', 'This invite link has expired');
  return { invite, event };
}

/** Public preview for the join page: no member data, just what a guest needs to decide to join. */
export function previewInvite(token: string) {
  const { invite, event } = resolveInvite(token);
  const host = T.users().get(event.hostId);
  return {
    eventTitle: event.title,
    hostName: host?.displayName ?? 'Host',
    place: event.place,
    startsAt: event.startsAt,
    status: event.status,
    needsPasscode: !!event.passcodeHash,
    slug: event.slug,
    expiresAt: invite.expiresAt,
  };
}

export function joinByToken(ctx: Ctx, raw: unknown): { event: EventRow; member: MemberRow; guestToken?: string; created: boolean } {
  const input = joinSchema.parse(raw);
  if (ctx.ip) rateLimit(`join:${ctx.ip}`, 30, 60_000);
  const { invite, event } = resolveInvite(input.token);
  rateLimit(`join-invite:${invite.id}`, 240, 60_000);

  if (event.status === 'ended' || event.status === 'archived') throw new HttpError(409, 'event_closed', 'This party has ended');

  // returning user
  if (ctx.userId) {
    const existing = T.members().find((m) => m.eventId === event.id && m.userId === ctx.userId);
    if (existing) {
      if (existing.banned) throw new HttpError(403, 'banned', 'You have been removed from this party');
      return { event, member: existing, created: false };
    }
  }
  if (event.status === 'draft') throw new HttpError(409, 'event_closed', 'The host has not opened this party yet');

  if (event.passcodeHash) {
    rateLimit(`passcode:${invite.id}:${ctx.ip ?? 'x'}`, 6, 10 * 60_000);
    if (!input.passcode || !checkPasscode(input.passcode, event.passcodeHash)) throw new HttpError(403, 'bad_passcode', 'That passcode is not right');
  }
  if (invite.maxUses && invite.uses >= invite.maxUses) throw new HttpError(410, 'invite_full', 'This invite link has reached its limit');

  const user = ctx.userId ? T.users().get(ctx.userId) : undefined;
  const memberId = randomUUID();
  let guestToken: string | undefined;
  let guestSecretHash: string | undefined;
  if (!user) {
    const sec = randomToken(24);
    guestSecretHash = sha256(sec);
    guestToken = signToken({ t: 'guest', eid: event.id, mid: memberId, sec }, limits.guestTokenTtlMs);
  }
  const member = T.members().insert({
    id: memberId,
    eventId: event.id,
    userId: user?.id,
    guestSecretHash,
    displayName: cleanText(input.displayName, 40),
    role: user ? 'member' : 'guest',
    joinedAt: now(),
  });
  T.invites().update(invite.id, { uses: invite.uses + 1 });
  audit(event.id, member.id, 'member.join', { inviteId: invite.id });
  publish(event.id, 'event.member.joined', { memberId: member.id, displayName: member.displayName });
  return { event, member, guestToken, created: true };
}

export function setMemberRole(eventKey: string, ctx: Ctx, memberId: string, role: 'cohost' | 'member' | 'guest') {
  const { event, member } = requireHost(eventKey, ctx);
  const target = T.members().get(memberId);
  if (!target || target.eventId !== event.id) throw new HttpError(404, 'not_found', 'Member not found');
  if (target.role === 'host') throw new HttpError(400, 'bad_request', 'The host cannot be changed');
  // a guest without an account can't be promoted to cohost (no durable identity)
  if (role === 'cohost' && !target.userId) throw new HttpError(400, 'bad_request', 'Only signed-in members can be co-hosts');
  T.members().update(target.id, { role });
  audit(event.id, member.id, 'member.role', { memberId, role });
  publish(event.id, 'event.member.joined', { memberId });
}

export function banMember(eventKey: string, ctx: Ctx, memberId: string) {
  const { event, member } = requireMod(eventKey, ctx);
  const target = T.members().get(memberId);
  if (!target || target.eventId !== event.id) throw new HttpError(404, 'not_found', 'Member not found');
  if (target.role === 'host' || (target.role === 'cohost' && member.role !== 'host')) throw new HttpError(403, 'forbidden', 'You cannot remove that person');
  T.members().update(target.id, { banned: true });
  // pull their pending content out of public view
  for (const m of T.media().where((m) => m.eventId === event.id && m.uploaderId === target.id && m.status !== 'rejected')) T.media().update(m.id, { status: 'rejected' });
  for (const r of T.requests().where((r) => r.eventId === event.id && r.requesterId === target.id && (r.status === 'pending' || r.status === 'approved'))) T.requests().update(r.id, { status: 'rejected' });
  audit(event.id, member.id, 'member.ban', { memberId });
  publish(event.id, 'event.song.updated');
  publish(event.id, 'event.media.removed', { memberId });
  publish(event.id, 'event.member.joined', { memberId });
}

// ---------------------------------------------------------------------------
// Song requests
// ---------------------------------------------------------------------------
export function trackKeyOf(t: TrackRef): string {
  if (t.providerTrackId) return `${t.provider}:${t.providerTrackId}`;
  const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  return `text:${norm(t.title)}|${norm(t.artists[0] ?? '')}`;
}

export function suggestSong(eventKey: string, ctx: Ctx, raw: unknown): { request: RequestRow; duplicate: boolean } {
  const { event, member } = requireMember(eventKey, ctx);
  assertOpenForGuests(event, member);
  rateLimit(`suggest:${member.id}`, 12, 60_000);
  const parsed = trackRefSchema.parse(raw);
  const track: TrackRef = { ...parsed, title: cleanText(parsed.title, 160), artists: parsed.artists.map((a) => cleanText(a, 120)) };
  const key = trackKeyOf(track);

  const dup = T.requests().find((r) => r.eventId === event.id && r.trackKey === key && (r.status === 'pending' || r.status === 'approved' || r.status === 'playing'));
  if (dup) {
    // duplicate detection: count it as a vote instead of cluttering the queue
    setVote(dup, member, 1);
    publish(event.id, 'event.song.updated', { requestId: dup.id });
    return { request: dup, duplicate: true };
  }
  const active = T.requests().where((r) => r.eventId === event.id && r.requesterId === member.id && (r.status === 'pending' || r.status === 'approved')).length;
  if (!isMod(member.role) && active >= limits.maxSongRequestsPerMember) {
    throw new HttpError(409, 'request_limit', `You already have ${active} songs waiting. Let some play first.`);
  }
  const auto = isMod(member.role) || !event.settings.songApproval;
  const all = T.requests().where((r) => r.eventId === event.id);
  const request = T.requests().insert({
    id: randomUUID(),
    eventId: event.id,
    requesterId: member.id,
    track,
    trackKey: key,
    status: auto ? 'approved' : 'pending',
    pinned: false,
    position: Math.max(0, ...all.map((r) => r.position)) + 1,
    createdAt: now(),
  });
  setVote(request, member, 1); // requester's own implicit upvote
  audit(event.id, member.id, 'song.suggest', { requestId: request.id });
  publish(event.id, 'event.song.updated', { requestId: request.id });
  return { request, duplicate: false };
}

function setVote(request: RequestRow, member: MemberRow, value: 1 | -1 | 0) {
  const id = `${request.id}:${member.id}`;
  if (value === 0) T.votes().delete(id);
  else if (T.votes().get(id)) T.votes().update(id, { value });
  else T.votes().insert({ id, eventId: request.eventId, requestId: request.id, memberId: member.id, value });
}

export function voteSong(eventKey: string, ctx: Ctx, requestId: string, raw: unknown) {
  const { event, member } = requireMember(eventKey, ctx);
  assertOpenForGuests(event, member);
  rateLimit(`vote:${member.id}`, 60, 60_000);
  const { value } = voteSchema.parse(raw);
  const req = T.requests().get(requestId);
  if (!req || req.eventId !== event.id) throw new HttpError(404, 'not_found', 'Song request not found');
  if (req.status !== 'pending' && req.status !== 'approved') throw new HttpError(409, 'not_votable', 'This song is no longer open for votes');
  if (event.settings.songVoting === 'host-only' && !isMod(member.role)) throw new HttpError(403, 'forbidden', 'Voting is limited to the host in this party');
  setVote(req, member, value);
  publish(event.id, 'event.song.updated', { requestId });
}

export function moderateRequest(eventKey: string, ctx: Ctx, requestId: string, raw: unknown) {
  const { event, member } = requireMod(eventKey, ctx);
  const p = requestPatchSchema.parse(raw);
  const req = T.requests().get(requestId);
  if (!req || req.eventId !== event.id) throw new HttpError(404, 'not_found', 'Song request not found');
  const patch: Partial<RequestRow> = {};
  if (p.track) {
    patch.track = { ...p.track, title: cleanText(p.track.title, 160), artists: p.track.artists.map((a) => cleanText(a, 120)) };
    patch.trackKey = trackKeyOf(patch.track);
  }
  if (p.pinned !== undefined) patch.pinned = p.pinned;
  if (p.status) {
    patch.status = p.status;
    if (p.status === 'approved' && req.status !== 'approved') patch.position = Math.max(0, ...T.requests().where((r) => r.eventId === event.id).map((r) => r.position)) + 1;
    if (p.status === 'playing') startPlayback(event, { ...req, ...patch } as RequestRow);
    if (p.status === 'played' && req.status === 'playing') endPlayback(event.id, req.trackKey);
  }
  T.requests().update(req.id, patch);

  if (p.moveTo !== undefined) {
    // manual reorder: freeze the current ordering into explicit positions, then move
    const ordered = orderQueue(
      T.requests().where((r) => r.eventId === event.id && r.status === 'approved'),
      T.votes().where((v) => v.eventId === event.id),
      event.settings.queueOrder,
    );
    const ids = ordered.map((r) => r.id).filter((id) => id !== req.id);
    ids.splice(Math.min(p.moveTo, ids.length), 0, req.id);
    ids.forEach((id, i) => T.requests().update(id, { position: i + 1 }));
    if (event.settings.queueOrder !== 'manual') T.events().update(event.id, { settings: { ...event.settings, queueOrder: 'manual' }, updatedAt: now() });
  }
  audit(event.id, member.id, 'song.moderate', { requestId, ...p });
  publish(event.id, 'event.song.updated', { requestId });
}

function startPlayback(event: EventRow, req: RequestRow) {
  // only one song plays at a time
  for (const r of T.requests().where((r) => r.eventId === event.id && r.status === 'playing' && r.id !== req.id)) T.requests().update(r.id, { status: 'played' });
  for (const l of T.playback().where((l) => l.eventId === event.id && !l.endedAt)) T.playback().update(l.id, { endedAt: now() });
  T.playback().insert({ id: randomUUID(), eventId: event.id, track: req.track, trackKey: req.trackKey, startedAt: now() });
  publish(event.id, 'event.playback.changed', { requestId: req.id });
}
function endPlayback(eventId: string, trackKey: string) {
  for (const l of T.playback().where((l) => l.eventId === eventId && l.trackKey === trackKey && !l.endedAt)) T.playback().update(l.id, { endedAt: now() });
  publish(eventId, 'event.playback.changed');
}

/**
 * Fair queue: pinned first (explicit order), then round-robin across requesters so one person
 * can't monopolise the night; inside each round, higher-scored songs go first.
 * `manual` mode honours host-set positions verbatim.
 */
export function orderQueue(requests: RequestRow[], votes: VoteRow[], mode: 'fair' | 'manual'): RequestRow[] {
  const score = new Map<string, number>();
  for (const v of votes) score.set(v.requestId, (score.get(v.requestId) ?? 0) + v.value);
  const approved = requests.filter((r) => r.status === 'approved');
  if (mode === 'manual') return [...approved].sort((a, b) => a.position - b.position);
  const pinned = approved.filter((r) => r.pinned).sort((a, b) => a.position - b.position);
  const rest = approved.filter((r) => !r.pinned);
  const byUser = new Map<string, RequestRow[]>();
  for (const r of rest) byUser.set(r.requesterId, [...(byUser.get(r.requesterId) ?? []), r]);
  for (const list of byUser.values()) list.sort((a, b) => (score.get(b.id) ?? 0) - (score.get(a.id) ?? 0) || a.createdAt.localeCompare(b.createdAt));
  const out: RequestRow[] = [];
  for (let round = 0; ; round++) {
    const layer = [...byUser.values()].map((l) => l[round]).filter((r): r is RequestRow => !!r);
    if (!layer.length) break;
    layer.sort((a, b) => (score.get(b.id) ?? 0) - (score.get(a.id) ?? 0) || a.createdAt.localeCompare(b.createdAt));
    out.push(...layer);
  }
  return [...pinned, ...out];
}

// ---------------------------------------------------------------------------
// Media
// ---------------------------------------------------------------------------
const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'image/avif': 'avif',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/ogg': 'ogg',
  'audio/flac': 'flac',
  'audio/mp4': 'm4a',
};

/** Free storage held by uploads that never completed. */
export function sweepAbandonedUploads(olderThanMs = 60 * 60 * 1000) {
  const cutoff = Date.now() - olderThanMs;
  for (const m of T.media().where((m) => m.status === 'uploading' && Date.parse(m.createdAt) < cutoff)) {
    deleteObject(m.objectKey);
    T.media().delete(m.id);
  }
}

/** Retention: delete media files of ended events after `retentionDays`. */
export function sweepExpiredEvents(nowMs = Date.now()) {
  for (const e of T.events().all()) {
    if (!e.endedAt) continue;
    if (nowMs - Date.parse(e.endedAt) > e.settings.retentionDays * 86_400_000) {
      deleteEventObjects(e.id);
      T.media().deleteWhere((m) => m.eventId === e.id);
    }
  }
}

export function createUploadIntent(eventKey: string, ctx: Ctx, raw: unknown) {
  const { event, member } = requireMember(eventKey, ctx);
  assertOpenForGuests(event, member);
  rateLimit(`upload:${member.id}`, 30, 60_000);
  sweepAbandonedUploads();
  const input = uploadIntentSchema.parse(raw);

  const isAudio = input.mime.startsWith('audio/');
  if (isAudio) {
    if (!isMod(member.role)) throw new HttpError(403, 'forbidden', 'Only the host or a co-host can add a soundtrack');
    if (input.rightsAttested !== true) throw new HttpError(422, 'rights_required', 'Confirm you have the rights to use this audio in a recap video.');
  }
  if (!isMod(member.role) && event.settings.guestUploads === 'off') throw new HttpError(403, 'uploads_off', 'The host has turned uploads off');
  if (input.size > limits.maxUploadBytes) throw new HttpError(413, 'too_large', `Files can be at most ${Math.round(limits.maxUploadBytes / 1048576)} MB`);

  const mine = T.media().where((m) => m.eventId === event.id && m.uploaderId === member.id && m.status !== 'rejected' && m.mediaType !== 'audio');
  if (!isMod(member.role) && mine.length >= Math.min(event.settings.maxFilesPerGuest, limits.maxUploadsPerGuestPerEvent)) {
    throw new HttpError(409, 'upload_limit', 'You have reached the upload limit for this party');
  }
  const all = T.media().where((m) => m.eventId === event.id);
  if (all.length >= limits.maxFilesPerEvent) throw new HttpError(409, 'event_full', 'This party has reached its file limit');
  if (all.reduce((s, m) => s + (m.size || m.declaredSize), 0) + input.size > limits.maxBytesPerEvent) throw new HttpError(409, 'event_full', 'This party has reached its storage limit');

  const id = randomUUID();
  const ext = EXT_BY_MIME[input.mime]!;
  const media = T.media().insert({
    id,
    eventId: event.id,
    uploaderId: member.id,
    objectKey: objectKey(event.id, id, ext),
    mediaType: isAudio ? 'audio' : input.mime.startsWith('video/') ? 'video' : 'image',
    mime: input.mime,
    declaredMime: input.mime,
    rightsAttested: isAudio ? true : undefined,
    size: 0,
    declaredSize: input.size,
    originalName: cleanText(input.fileName, 120),
    takenAt: input.takenAt,
    status: 'uploading',
    recapConsent: input.recapConsent,
    mustInclude: false,
    createdAt: now(),
  });
  const token = signToken({ t: 'upload', mid: media.id, eid: event.id, max: input.size }, limits.uploadUrlTtlMs);
  return { media, uploadUrl: `/api/uploads/${media.id}?t=${encodeURIComponent(token)}`, maxBytes: input.size, expiresInMs: limits.uploadUrlTtlMs };
}

/** Validate a signed upload URL for the receiving route. */
export function authorizeUpload(mediaId: string, token: string | null): { media: MediaRow; maxBytes: number } {
  const p = verifyToken<{ t: string; mid: string; eid: string; max: number }>(token);
  if (!p || p.t !== 'upload' || p.mid !== mediaId) throw new HttpError(403, 'bad_signature', 'Upload link is invalid or expired');
  const media = T.media().get(mediaId);
  if (!media || media.eventId !== p.eid || media.status !== 'uploading') throw new HttpError(403, 'bad_signature', 'Upload link is invalid or expired');
  return { media, maxBytes: p.max };
}

export function recordUploadBytes(mediaId: string, bytes: number) {
  T.media().update(mediaId, { size: bytes });
}

export function completeUpload(eventKey: string, ctx: Ctx, mediaId: string) {
  const { event, member } = requireMember(eventKey, ctx);
  const media = T.media().get(mediaId);
  if (!media || media.eventId !== event.id || media.uploaderId !== member.id) throw new HttpError(404, 'not_found', 'Upload not found');
  if (media.status !== 'uploading') throw new HttpError(409, 'already_complete', 'Upload already completed');
  const size = objectSize(media.objectKey);
  const reject = (code: string, msg: string): never => {
    deleteObject(media.objectKey);
    T.media().delete(media.id);
    throw new HttpError(422, code, msg);
  };
  if (size === null || size === 0) return reject('missing_file', 'The file never arrived. Please try again.');
  if (size > media.declaredSize) return reject('size_mismatch', 'The file was larger than declared');
  const sniffed = sniffMedia(readHead(media.objectKey, 32));
  if (!sniffed) return reject('invalid_media', 'That file is not a supported photo or video');
  if (sniffed.kind !== media.mediaType) return reject('invalid_media', 'The file type does not match what was declared');

  // guests' uploads go to the approval queue unless the host opened uploads fully
  const autoApprove = isMod(member.role) || (event.settings.guestUploads === 'open' && media.mediaType !== 'audio');
  const done = T.media().update(media.id, {
    mime: sniffed.mime,
    size,
    status: autoApprove ? 'approved' : 'pending',
    completedAt: now(),
  });
  audit(event.id, member.id, 'media.upload', { mediaId });
  publish(event.id, autoApprove ? 'event.media.approved' : 'event.updated', { mediaId, kind: autoApprove ? undefined : 'media.pending' });
  return done;
}

export function moderateMedia(eventKey: string, ctx: Ctx, mediaId: string, raw: unknown) {
  const { event, member } = requireMod(eventKey, ctx);
  const p = mediaPatchSchema.parse(raw);
  const m = T.media().get(mediaId);
  if (!m || m.eventId !== event.id || m.status === 'uploading') throw new HttpError(404, 'not_found', 'Media not found');
  T.media().update(m.id, { ...(p.status ? { status: p.status } : {}), ...(p.mustInclude !== undefined ? { mustInclude: p.mustInclude } : {}), ...(p.recapConsent !== undefined ? { recapConsent: p.recapConsent } : {}) });
  audit(event.id, member.id, 'media.moderate', { mediaId, ...p });
  publish(event.id, p.status === 'approved' ? 'event.media.approved' : 'event.media.removed', { mediaId });
}

export function deleteMedia(eventKey: string, ctx: Ctx, mediaId: string) {
  const { event, member } = requireMember(eventKey, ctx);
  const m = T.media().get(mediaId);
  if (!m || m.eventId !== event.id) throw new HttpError(404, 'not_found', 'Media not found');
  if (!isMod(member.role) && m.uploaderId !== member.id) throw new HttpError(403, 'forbidden', 'You can only delete your own uploads');
  deleteObject(m.objectKey);
  T.media().delete(m.id);
  audit(event.id, member.id, 'media.delete', { mediaId });
  publish(event.id, 'event.media.removed', { mediaId });
}

export function reportContent(eventKey: string, ctx: Ctx, raw: unknown) {
  const { event, member } = requireMember(eventKey, ctx);
  rateLimit(`report:${member.id}`, 10, 60_000);
  const p = reportSchema.parse(raw);
  T.reports().insert({ id: randomUUID(), eventId: event.id, reporterId: member.id, targetType: p.targetType, targetId: p.targetId, reason: cleanText(p.reason, 300), status: 'open', createdAt: now() });
  publish(event.id, 'event.updated', { kind: 'report' });
}

export function listReports(eventKey: string, ctx: Ctx) {
  const { event } = requireMod(eventKey, ctx);
  return T.reports().where((r) => r.eventId === event.id && r.status === 'open');
}

export function listAudit(eventKey: string, ctx: Ctx) {
  const { event } = requireHost(eventKey, ctx);
  return T.audit()
    .where((a) => a.eventId === event.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 200);
}

/** Signed GET URL for a single object; only handed to authorized viewers. */
export function mediaUrl(mediaId: string, eventId: string): string {
  const token = signToken({ t: 'media', mid: mediaId, eid: eventId }, limits.mediaUrlTtlMs);
  return `/api/media/${mediaId}/file?t=${encodeURIComponent(token)}`;
}

export function authorizeMediaRead(mediaId: string, token: string | null): MediaRow {
  const p = verifyToken<{ t: string; mid: string; eid: string }>(token);
  if (!p || p.t !== 'media' || p.mid !== mediaId) throw new HttpError(403, 'bad_signature', 'This link has expired');
  const m = T.media().get(mediaId);
  if (!m || m.eventId !== p.eid || m.status === 'uploading') throw new HttpError(404, 'not_found', 'Media not found');
  return m;
}

// ---------------------------------------------------------------------------
// Snapshots (what clients see)
// ---------------------------------------------------------------------------
function eventDto(e: EventRow): EventDto {
  return {
    id: e.id,
    slug: e.slug,
    title: e.title,
    description: e.description,
    place: e.place,
    timezone: e.timezone,
    startsAt: e.startsAt,
    endsAt: e.endsAt,
    status: e.status,
    hasPasscode: !!e.passcodeHash,
    settings: e.settings,
    hostName: T.users().get(e.hostId)?.displayName ?? 'Host',
  };
}

function playbackDto(l: PlaybackRow): PlaybackDto {
  return { id: l.id, track: l.track, startedAt: l.startedAt, endedAt: l.endedAt };
}

function buildCommon(event: EventRow, viewer: MemberRow | null, opts: { moderator: boolean; displayMode: boolean }) {
  const members = T.members().where((m) => m.eventId === event.id && !m.banned);
  const name = new Map(members.map((m) => [m.id, m.displayName]));
  const allRequests = T.requests().where((r) => r.eventId === event.id);
  const votes = T.votes().where((v) => v.eventId === event.id);
  const up = new Map<string, number>();
  const down = new Map<string, number>();
  const mine = new Map<string, 1 | -1>();
  for (const v of votes) {
    (v.value === 1 ? up : down).set(v.requestId, ((v.value === 1 ? up : down).get(v.requestId) ?? 0) + 1);
    if (viewer && v.memberId === viewer.id) mine.set(v.requestId, v.value);
  }
  const visible = allRequests.filter((r) => {
    if (opts.displayMode) return r.status === 'approved' || r.status === 'playing';
    if (opts.moderator) return r.status !== 'rejected';
    // members see the live queue plus their own suggestions (so they can see "waiting for host approval")
    return r.status === 'approved' || r.status === 'playing' || (viewer !== null && r.requesterId === viewer.id && r.status !== 'played');
  });
  const requests: SongRequestDto[] = visible.map((r) => ({
    id: r.id,
    track: r.track,
    requesterId: r.requesterId,
    requesterName: name.get(r.requesterId) ?? 'Guest',
    status: r.status,
    pinned: r.pinned,
    up: up.get(r.id) ?? 0,
    down: down.get(r.id) ?? 0,
    score: (up.get(r.id) ?? 0) - (down.get(r.id) ?? 0),
    myVote: mine.get(r.id) ?? 0,
    createdAt: r.createdAt,
  }));
  const ordered = orderQueue(allRequests, votes, event.settings.queueOrder).map((r) => r.id);
  const playing = allRequests.filter((r) => r.status === 'playing').map((r) => r.id);
  const queue = [...playing, ...ordered];

  const media: MediaDto[] = T.media()
    .where((m) => {
      if (m.eventId !== event.id || m.status === 'uploading' || m.mediaType === 'audio') return false; // soundtracks never appear in galleries or on the big screen
      if (opts.displayMode) return m.status === 'approved'; // big screen never shows unmoderated media
      if (opts.moderator) return true;
      return m.status === 'approved' || (viewer !== null && m.uploaderId === viewer.id);
    })
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((m) => ({
      id: m.id,
      mediaType: m.mediaType as 'image' | 'video',
      mime: m.mime,
      size: m.size,
      status: m.status,
      uploaderId: m.uploaderId,
      uploaderName: name.get(m.uploaderId) ?? 'Guest',
      takenAt: m.takenAt,
      createdAt: m.createdAt,
      recapConsent: m.recapConsent,
      mustInclude: m.mustInclude,
      url: mediaUrl(m.id, event.id),
    }));

  const history = T.playback().where((l) => l.eventId === event.id).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const nowPlaying = history.find((l) => !l.endedAt) ?? null;
  const online = onlineMembers(event.id);
  const memberDtos: MemberDto[] = members.map((m) => ({ id: m.id, displayName: m.displayName, role: m.role, joinedAt: m.joinedAt, online: online.has(m.id) }));
  return { members: memberDtos, requests, queue, media, nowPlaying: nowPlaying ? playbackDto(nowPlaying) : null, history: history.slice(0, 30).map(playbackDto) };
}

export function snapshotFor(eventKey: string, ctx: Ctx): PartySnapshot {
  const { event, member } = requireMember(eventKey, ctx);
  touchPresence(event.id, member.id);
  const c = buildCommon(event, member, { moderator: isMod(member.role), displayMode: false });
  return {
    seq: currentSeq(event.id),
    event: eventDto(event),
    me: { memberId: member.id, role: member.role, displayName: member.displayName },
    ...c,
  };
}

// ---- Big-screen / TV mode --------------------------------------------------------------------

/** Mint a read-only display token and a dedicated QR invite for the projector. */
export function createDisplayAccess(eventKey: string, ctx: Ctx) {
  const { event, member } = requireMod(eventKey, ctx);
  const { token: joinToken } = createInvite(event.id, ctx, { label: 'big-screen QR', ttlHours: 12 });
  const displayToken = signToken({ t: 'display', eid: event.id, jt: joinToken }, limits.displayTokenTtlMs);
  audit(event.id, member.id, 'display.create');
  return { displayToken, url: `/parties/${event.slug}/screen?d=${encodeURIComponent(displayToken)}` };
}

export function requireDisplay(eventKey: string, token: string | null): { event: EventRow; joinToken?: string } {
  const event = findEvent(eventKey);
  const p = verifyToken<{ t: string; eid: string; jt?: string }>(token);
  if (!event || !p || p.t !== 'display' || p.eid !== event.id) throw new HttpError(404, 'not_found', 'Party not found');
  return { event, joinToken: p.jt };
}

export function displaySnapshot(eventKey: string, token: string | null): DisplaySnapshot & { joinToken?: string } {
  const { event, joinToken } = requireDisplay(eventKey, token);
  const c = buildCommon(event, null, { moderator: false, displayMode: true });
  return {
    seq: currentSeq(event.id),
    event: eventDto(event),
    ...c,
    // a screen shows first names only and no member roster
    members: [],
    joinToken,
  };
}

export const __internal = { isMod };
export { hashPasscode, checkPasscode };
