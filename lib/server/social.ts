import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { db } from './db';
import { HttpError, cleanText, rateLimit } from './security';
import { T, type UserRow } from './party';
import { trackRefSchema, type TrackRef } from '../party/schemas';

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------
export type FriendshipRow = { id: string; requesterId: string; recipientId: string; status: 'pending' | 'accepted'; createdAt: string };
export type BlockRow = { id: string; blockerId: string; blockedId: string; createdAt: string };
export type Visibility = 'public' | 'friends' | 'private' | 'direct';
export type PostRow = { id: string; authorId: string; kind: 'sotd' | 'recommendation' | 'journal'; track: TrackRef; caption: string; visibility: Visibility; recipientId?: string; day?: string; createdAt: string };
export type ReactionRow = { id: string; postId: string; userId: string; kind: 'like' | 'fire' | 'heart'; createdAt: string };
export type NotificationRow = { id: string; userId: string; type: 'friend.request' | 'friend.accepted' | 'recommendation' | 'reaction'; payload: Record<string, unknown>; seenAt?: string; createdAt: string };
export type SocialReportRow = { id: string; reporterId: string; postId: string; reason: string; createdAt: string };

export const S = {
  friendships: () => db().table<FriendshipRow>('friendships'),
  blocks: () => db().table<BlockRow>('blocks'),
  posts: () => db().table<PostRow>('social_posts'),
  reactions: () => db().table<ReactionRow>('reactions'),
  notifications: () => db().table<NotificationRow>('notifications'),
  reports: () => db().table<SocialReportRow>('social_reports'),
};

const now = () => new Date().toISOString();

export const postSchema = z.object({
  kind: z.enum(['sotd', 'recommendation', 'journal']).default('sotd'),
  track: trackRefSchema,
  caption: z.string().trim().max(500).default(''),
  visibility: z.enum(['public', 'friends', 'private', 'direct']).default('friends'),
  /** handle of the friend a recommendation is sent to */
  toHandle: z.string().trim().max(24).optional(),
  /** the author's local calendar day (YYYY-MM-DD): "one Song of the Day per day" follows the author's timezone */
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

// ---------------------------------------------------------------------------
// Relationships
// ---------------------------------------------------------------------------
const byHandle = (handle: string) => T.users().find((u) => u.handle === handle.trim().toLowerCase().replace(/^@/, ''));

export function isBlockedEitherWay(a: string, b: string): boolean {
  return !!S.blocks().find((x) => (x.blockerId === a && x.blockedId === b) || (x.blockerId === b && x.blockedId === a));
}
export function friendshipBetween(a: string, b: string): FriendshipRow | undefined {
  return S.friendships().find((f) => (f.requesterId === a && f.recipientId === b) || (f.requesterId === b && f.recipientId === a));
}
export const areFriends = (a: string, b: string) => friendshipBetween(a, b)?.status === 'accepted';

function notify(userId: string, type: NotificationRow['type'], payload: Record<string, unknown>) {
  S.notifications().insert({ id: randomUUID(), userId, type, payload, createdAt: now() });
}

export function sendFriendRequest(me: UserRow, handle: string): FriendshipRow {
  rateLimit(`friend:${me.id}`, 20, 60 * 60_000);
  const other = byHandle(handle);
  // same response for "no such user" and "blocked you": don't reveal blocks or enumerate users
  if (!other || other.id === me.id || isBlockedEitherWay(me.id, other.id)) throw new HttpError(404, 'not_found', 'No one with that handle can be added.');
  const existing = friendshipBetween(me.id, other.id);
  if (existing) {
    if (existing.status === 'pending' && existing.recipientId === me.id) return respondToRequest(me, existing.id, true); // they already asked: accept
    throw new HttpError(409, 'already', existing.status === 'accepted' ? 'You are already friends.' : 'Request already sent.');
  }
  const f = S.friendships().insert({ id: randomUUID(), requesterId: me.id, recipientId: other.id, status: 'pending', createdAt: now() });
  notify(other.id, 'friend.request', { from: me.handle, fromName: me.displayName, friendshipId: f.id });
  return f;
}

export function respondToRequest(me: UserRow, friendshipId: string, accept: boolean): FriendshipRow {
  const f = S.friendships().get(friendshipId);
  if (!f || f.recipientId !== me.id || f.status !== 'pending') throw new HttpError(404, 'not_found', 'Request not found');
  if (!accept) {
    S.friendships().delete(f.id);
    return { ...f, status: 'pending' };
  }
  const done = S.friendships().update(f.id, { status: 'accepted' });
  notify(f.requesterId, 'friend.accepted', { from: me.handle, fromName: me.displayName });
  return done;
}

export function removeFriend(me: UserRow, friendshipId: string) {
  const f = S.friendships().get(friendshipId);
  if (!f || (f.requesterId !== me.id && f.recipientId !== me.id)) throw new HttpError(404, 'not_found', 'Friendship not found');
  S.friendships().delete(f.id);
}

export function blockUser(me: UserRow, handle: string) {
  const other = byHandle(handle);
  if (!other || other.id === me.id) throw new HttpError(404, 'not_found', 'No one with that handle.');
  if (!S.blocks().find((b) => b.blockerId === me.id && b.blockedId === other.id)) S.blocks().insert({ id: randomUUID(), blockerId: me.id, blockedId: other.id, createdAt: now() });
  const f = friendshipBetween(me.id, other.id);
  if (f) S.friendships().delete(f.id);
  // posts sent to each other disappear from view; reactions are removed
  S.reactions().deleteWhere((r) => r.userId === other.id && S.posts().get(r.postId)?.authorId === me.id);
}

export function unblockUser(me: UserRow, handle: string) {
  const other = byHandle(handle);
  if (!other) return;
  S.blocks().deleteWhere((b) => b.blockerId === me.id && b.blockedId === other.id);
}

export function listFriends(me: UserRow) {
  const all = S.friendships().where((f) => f.requesterId === me.id || f.recipientId === me.id);
  const user = (id: string) => T.users().get(id);
  const dto = (f: FriendshipRow) => {
    const otherId = f.requesterId === me.id ? f.recipientId : f.requesterId;
    const u = user(otherId);
    return { friendshipId: f.id, handle: u?.handle ?? 'unknown', displayName: u?.displayName ?? 'Unknown' };
  };
  return {
    friends: all.filter((f) => f.status === 'accepted').map(dto),
    incoming: all.filter((f) => f.status === 'pending' && f.recipientId === me.id).map(dto),
    outgoing: all.filter((f) => f.status === 'pending' && f.requesterId === me.id).map(dto),
    blocked: S.blocks().where((b) => b.blockerId === me.id).map((b) => ({ handle: user(b.blockedId)?.handle ?? 'unknown' })),
  };
}

// ---------------------------------------------------------------------------
// Posts + visibility
// ---------------------------------------------------------------------------
/** Single source of truth for "may this viewer see this post?". Used by every read path. */
export function canView(post: PostRow, viewerId: string | null): boolean {
  if (viewerId && post.authorId === viewerId) return true;
  if (!viewerId) return post.visibility === 'public';
  if (isBlockedEitherWay(post.authorId, viewerId)) return false;
  switch (post.visibility) {
    case 'public':
      return true;
    case 'friends':
      return areFriends(post.authorId, viewerId);
    case 'direct':
      return post.recipientId === viewerId;
    default:
      return false;
  }
}

export function createPost(me: UserRow, raw: unknown): PostRow {
  rateLimit(`post:${me.id}`, 30, 60 * 60_000);
  const p = postSchema.parse(raw);
  let recipientId: string | undefined;
  let visibility = p.visibility;
  if (p.kind === 'recommendation') {
    const to = p.toHandle ? byHandle(p.toHandle) : undefined;
    if (!to || to.id === me.id || isBlockedEitherWay(me.id, to.id)) throw new HttpError(404, 'not_found', 'Pick a friend to send this to.');
    if (!areFriends(me.id, to.id)) throw new HttpError(403, 'not_friends', 'You can only recommend songs to friends.');
    recipientId = to.id;
    visibility = 'direct';
  } else if (visibility === 'direct') throw new HttpError(400, 'bad_request', 'Direct posts are only for recommendations.');

  let day: string | undefined;
  if (p.kind === 'sotd') {
    day = p.day ?? new Date().toISOString().slice(0, 10);
    const skew = Math.abs(Date.parse(day) - Date.parse(new Date().toISOString().slice(0, 10))) / 86_400_000;
    if (skew > 1.5) throw new HttpError(400, 'bad_day', 'That is not today.');
    if (S.posts().find((x) => x.authorId === me.id && x.kind === 'sotd' && x.day === day)) throw new HttpError(409, 'already_posted', 'You already picked a Song of the Day for today. Delete it to post another.');
  }
  const post = S.posts().insert({
    id: randomUUID(),
    authorId: me.id,
    kind: p.kind,
    track: { ...p.track, title: cleanText(p.track.title, 160), artists: p.track.artists.map((a) => cleanText(a, 120)) },
    caption: cleanText(p.caption, 500),
    visibility,
    recipientId,
    day,
    createdAt: now(),
  });
  if (recipientId) notify(recipientId, 'recommendation', { from: me.handle, fromName: me.displayName, postId: post.id, title: post.track.title });
  return post;
}

export function deletePost(me: UserRow, id: string) {
  const p = S.posts().get(id);
  if (!p || p.authorId !== me.id) throw new HttpError(404, 'not_found', 'Post not found');
  S.posts().delete(id);
  S.reactions().deleteWhere((r) => r.postId === id);
}

export function react(me: UserRow, postId: string, kind: ReactionRow['kind'] | null) {
  const p = S.posts().get(postId);
  if (!p || !canView(p, me.id)) throw new HttpError(404, 'not_found', 'Post not found');
  rateLimit(`react:${me.id}`, 120, 60_000);
  const id = `${postId}:${me.id}`;
  if (kind === null) return void S.reactions().delete(id);
  if (S.reactions().get(id)) S.reactions().update(id, { kind });
  else {
    S.reactions().insert({ id, postId, userId: me.id, kind, createdAt: now() });
    if (p.authorId !== me.id) notify(p.authorId, 'reaction', { from: me.handle, postId, kind, title: p.track.title });
  }
}

export type PostDto = {
  id: string;
  kind: PostRow['kind'];
  track: TrackRef;
  caption: string;
  visibility: Visibility;
  createdAt: string;
  day?: string;
  author: { handle: string; displayName: string };
  toMe: boolean;
  mine: boolean;
  reactions: Record<string, number>;
  myReaction: string | null;
};

function toDto(p: PostRow, viewerId: string | null): PostDto {
  const a = T.users().get(p.authorId);
  const rs = S.reactions().where((r) => r.postId === p.id);
  const counts: Record<string, number> = {};
  for (const r of rs) counts[r.kind] = (counts[r.kind] ?? 0) + 1;
  return {
    id: p.id,
    kind: p.kind,
    track: p.track,
    caption: p.caption,
    visibility: p.visibility,
    createdAt: p.createdAt,
    day: p.day,
    author: { handle: a?.handle ?? 'deleted', displayName: a?.displayName ?? 'Deleted user' },
    toMe: !!viewerId && p.recipientId === viewerId,
    mine: !!viewerId && p.authorId === viewerId,
    reactions: counts,
    myReaction: viewerId ? (rs.find((r) => r.userId === viewerId)?.kind ?? null) : null,
  };
}

/** Chronological feed (no ranking). scope=friends: friends + me + things sent to me. scope=public: everyone's public posts. */
export function feed(me: UserRow, opts: { scope: 'friends' | 'public' | 'mine'; before?: string; limit?: number }) {
  const limit = Math.min(opts.limit ?? 20, 50);
  const friendIds = new Set(
    S.friendships()
      .where((f) => f.status === 'accepted' && (f.requesterId === me.id || f.recipientId === me.id))
      .map((f) => (f.requesterId === me.id ? f.recipientId : f.requesterId)),
  );
  const rows = S.posts()
    .where((p) => {
      if (opts.before && p.createdAt >= opts.before) return false;
      if (!canView(p, me.id)) return false;
      if (opts.scope === 'mine') return p.authorId === me.id;
      if (opts.scope === 'public') return p.visibility === 'public';
      return p.authorId === me.id || friendIds.has(p.authorId) || p.recipientId === me.id;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit + 1);
  const page = rows.slice(0, limit);
  return { posts: page.map((p) => toDto(p, me.id)), nextBefore: rows.length > limit ? page[page.length - 1]!.createdAt : null };
}

export function profile(viewer: UserRow | null, handle: string) {
  const u = byHandle(handle);
  if (!u || (viewer && isBlockedEitherWay(viewer.id, u.id))) throw new HttpError(404, 'not_found', 'Profile not found');
  const f = viewer ? friendshipBetween(viewer.id, u.id) : undefined;
  const posts = S.posts()
    .where((p) => p.authorId === u.id && p.kind !== 'recommendation' && canView(p, viewer?.id ?? null))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 30)
    .map((p) => toDto(p, viewer?.id ?? null));
  return {
    handle: u.handle,
    displayName: u.displayName,
    memberSince: u.createdAt,
    isMe: viewer?.id === u.id,
    relationship: !viewer || viewer.id === u.id ? 'none' : !f ? 'none' : f.status === 'accepted' ? 'friends' : f.requesterId === viewer.id ? 'requested' : 'incoming',
    friendshipId: f?.id ?? null,
    posts,
  };
}

export function reportPost(me: UserRow, postId: string, reason: string) {
  const p = S.posts().get(postId);
  if (!p || !canView(p, me.id)) throw new HttpError(404, 'not_found', 'Post not found');
  rateLimit(`sreport:${me.id}`, 10, 60 * 60_000);
  S.reports().insert({ id: randomUUID(), reporterId: me.id, postId, reason: cleanText(reason, 300), createdAt: now() });
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------
export function listNotifications(me: UserRow) {
  const all = S.notifications().where((n) => n.userId === me.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { unread: all.filter((n) => !n.seenAt).length, notifications: all.slice(0, 50) };
}
export function markNotificationsSeen(me: UserRow) {
  for (const n of S.notifications().where((n) => n.userId === me.id && !n.seenAt)) S.notifications().update(n.id, { seenAt: now() });
}

/** Called when a user erases their account. */
export function eraseUserSocialData(userId: string) {
  const mine = new Set(S.posts().where((p) => p.authorId === userId).map((p) => p.id));
  S.reactions().deleteWhere((r) => r.userId === userId || mine.has(r.postId));
  S.posts().deleteWhere((p) => p.authorId === userId || p.recipientId === userId);
  S.friendships().deleteWhere((f) => f.requesterId === userId || f.recipientId === userId);
  S.blocks().deleteWhere((b) => b.blockerId === userId || b.blockedId === userId);
  S.notifications().deleteWhere((n) => n.userId === userId);
  S.reports().deleteWhere((r) => r.reporterId === userId);
}
