import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

const dir = mkdtempSync(path.join(tmpdir(), 'lyricscape-social-'));
process.env.LYRICSCAPE_DATA_DIR = dir;
process.env.LYRICSCAPE_SECRET = 'test-secret-test-secret-test-secret';

const { Database, swapDatabase, db } = await import('@/lib/server/db');
const party = await import('@/lib/server/party');
const social = await import('@/lib/server/social');
const sec = await import('@/lib/server/security');

let n = 0;
beforeEach(() => {
  const d = path.join(dir, `db${++n}`);
  mkdirSync(d, { recursive: true });
  swapDatabase(new Database(d));
  sec.resetRateLimits();
});
afterAll(() => {
  db().dispose();
  rmSync(dir, { recursive: true, force: true });
});

const u = (h: string) => party.loginLocalUser(h, h.toUpperCase());
const track = { provider: 'demo' as const, providerTrackId: 'neon-static', title: 'Neon Static', artists: ['Lab'] };
const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return e instanceof sec.HttpError ? `${e.status}:${e.code}` : `ERR:${(e as Error).message}`;
  }
  return 'ok';
};
const befriend = (a: ReturnType<typeof u>, b: ReturnType<typeof u>) => {
  const f = social.sendFriendRequest(a, b.handle);
  social.respondToRequest(b, f.id, true);
};
const today = () => new Date().toISOString().slice(0, 10);

describe('friends', () => {
  it('request -> accept, with notifications both ways', () => {
    const a = u('alice');
    const b = u('bobby');
    const f = social.sendFriendRequest(a, 'bobby');
    expect(social.listFriends(b).incoming).toHaveLength(1);
    expect(social.listNotifications(b).notifications[0]!.type).toBe('friend.request');
    social.respondToRequest(b, f.id, true);
    expect(social.areFriends(a.id, b.id)).toBe(true);
    expect(social.listNotifications(a).notifications[0]!.type).toBe('friend.accepted');
    expect(code(() => social.sendFriendRequest(a, 'bobby'))).toBe('409:already');
  });

  it('only the recipient can answer; declining removes the request; crossing requests auto-accept', () => {
    const a = u('alice');
    const b = u('bobby');
    const c = u('carol');
    const f = social.sendFriendRequest(a, 'bobby');
    expect(code(() => social.respondToRequest(c, f.id, true))).toBe('404:not_found');
    expect(code(() => social.respondToRequest(a, f.id, true))).toBe('404:not_found');
    social.respondToRequest(b, f.id, false);
    expect(social.friendshipBetween(a.id, b.id)).toBeUndefined();
    social.sendFriendRequest(a, 'carol');
    social.sendFriendRequest(c, 'alice');
    expect(social.areFriends(a.id, c.id)).toBe(true);
  });

  it('cannot friend yourself or unknown handles; blocked users look like unknown handles', () => {
    const a = u('alice');
    const b = u('bobby');
    expect(code(() => social.sendFriendRequest(a, 'alice'))).toBe('404:not_found');
    expect(code(() => social.sendFriendRequest(a, 'ghost'))).toBe('404:not_found');
    social.blockUser(b, 'alice');
    expect(code(() => social.sendFriendRequest(a, 'bobby'))).toBe('404:not_found'); // does not reveal the block
  });
});

describe('visibility rules (every read path uses canView)', () => {
  it('public / friends / private / direct', () => {
    const a = u('alice');
    const friend = u('bobby');
    const stranger = u('carol');
    befriend(a, friend);
    const mk = (visibility: 'public' | 'friends' | 'private', day: string) => social.createPost(a, { kind: 'journal', track, caption: visibility, visibility, day });
    const pub = mk('public', today());
    const fr = mk('friends', today());
    const priv = mk('private', today());
    expect(social.canView(pub, stranger.id)).toBe(true);
    expect(social.canView(pub, null)).toBe(true);
    expect(social.canView(fr, friend.id)).toBe(true);
    expect(social.canView(fr, stranger.id)).toBe(false);
    expect(social.canView(fr, null)).toBe(false);
    expect(social.canView(priv, friend.id)).toBe(false);
    expect(social.canView(priv, a.id)).toBe(true);
  });

  it('recommendations are direct: only the friend it was sent to (and the author) can see them', () => {
    const a = u('alice');
    const b = u('bobby');
    const c = u('carol');
    befriend(a, b);
    befriend(a, c);
    const r = social.createPost(a, { kind: 'recommendation', track, caption: 'you will love this', toHandle: 'bobby' });
    expect(r.visibility).toBe('direct');
    expect(social.canView(r, b.id)).toBe(true);
    expect(social.canView(r, c.id)).toBe(false);
    expect(social.feed(c, { scope: 'friends' }).posts).toHaveLength(0);
    expect(social.feed(b, { scope: 'friends' }).posts[0]!.toMe).toBe(true);
    expect(social.listNotifications(b).notifications[0]!.type).toBe('recommendation');
    expect(code(() => social.createPost(a, { kind: 'recommendation', track, toHandle: 'dave' }))).toBe('404:not_found');
    const d = u('dave');
    expect(code(() => social.createPost(a, { kind: 'recommendation', track, toHandle: d.handle }))).toBe('403:not_friends');
    expect(code(() => social.createPost(a, { kind: 'journal', track, visibility: 'direct' }))).toBe('400:bad_request');
  });

  it('blocking hides everything both ways and removes the friendship', () => {
    const a = u('alice');
    const b = u('bobby');
    befriend(a, b);
    const post = social.createPost(a, { kind: 'journal', track, visibility: 'public', day: today() });
    expect(social.canView(post, b.id)).toBe(true);
    social.blockUser(b, 'alice');
    expect(social.areFriends(a.id, b.id)).toBe(false);
    expect(social.canView(post, b.id)).toBe(false);
    expect(code(() => social.profile(b, 'alice'))).toBe('404:not_found');
    expect(code(() => social.profile(a, 'bobby'))).toBe('404:not_found');
    expect(code(() => social.react(b, post.id, 'like'))).toBe('404:not_found');
    social.unblockUser(b, 'alice');
    expect(social.canView(post, b.id)).toBe(true);
  });

  it('feeds never leak: friends scope only has friends/me/direct-to-me; public scope only public', () => {
    const a = u('alice');
    const b = u('bobby');
    const s = u('carol');
    befriend(a, b);
    social.createPost(s, { kind: 'journal', track, visibility: 'public', caption: 'carol public', day: today() });
    social.createPost(s, { kind: 'journal', track, visibility: 'friends', caption: 'carol friends', day: today() });
    social.createPost(b, { kind: 'journal', track, visibility: 'friends', caption: 'bobby friends', day: today() });
    social.createPost(a, { kind: 'journal', track, visibility: 'private', caption: 'alice private', day: today() });
    const friendsFeed = social.feed(a, { scope: 'friends' }).posts.map((p) => p.caption);
    expect(friendsFeed.sort()).toEqual(['alice private', 'bobby friends']);
    expect(social.feed(a, { scope: 'public' }).posts.map((p) => p.caption)).toEqual(['carol public']);
    expect(social.feed(a, { scope: 'mine' }).posts.map((p) => p.caption)).toEqual(['alice private']);
  });
});

describe('Song of the Day', () => {
  it('allows one per day per author, then again after deleting', () => {
    const a = u('alice');
    const p = social.createPost(a, { kind: 'sotd', track, caption: 'today' });
    expect(p.day).toBe(today());
    expect(code(() => social.createPost(a, { kind: 'sotd', track }))).toBe('409:already_posted');
    social.deletePost(a, p.id);
    expect(code(() => social.createPost(a, { kind: 'sotd', track }))).toBe('ok');
  });

  it('follows the author\'s day within a sane window and rejects bogus days', () => {
    const a = u('alice');
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    expect(code(() => social.createPost(a, { kind: 'sotd', track, day: tomorrow }))).toBe('ok'); // east-of-UTC authors
    expect(code(() => social.createPost(a, { kind: 'sotd', track, day: '2001-01-01' }))).toBe('400:bad_day');
  });

  it('only the author can delete; deleting removes reactions', () => {
    const a = u('alice');
    const b = u('bobby');
    befriend(a, b);
    const p = social.createPost(a, { kind: 'sotd', track, visibility: 'friends' });
    social.react(b, p.id, 'fire');
    expect(social.feed(a, { scope: 'mine' }).posts[0]!.reactions).toEqual({ fire: 1 });
    expect(code(() => social.deletePost(b, p.id))).toBe('404:not_found');
    social.deletePost(a, p.id);
    expect(social.S.reactions().all()).toHaveLength(0);
  });
});

describe('reactions, pagination, profiles, erase', () => {
  it('react / change / clear, with a notification to the author', () => {
    const a = u('alice');
    const b = u('bobby');
    befriend(a, b);
    const p = social.createPost(a, { kind: 'sotd', track, visibility: 'friends' });
    social.react(b, p.id, 'like');
    social.react(b, p.id, 'heart');
    expect(social.feed(b, { scope: 'friends' }).posts[0]).toMatchObject({ myReaction: 'heart', reactions: { heart: 1 } });
    social.react(b, p.id, null);
    expect(social.feed(b, { scope: 'friends' }).posts[0]!.myReaction).toBeNull();
    expect(social.listNotifications(a).notifications.filter((x) => x.type === 'reaction')).toHaveLength(1);
    social.markNotificationsSeen(a);
    expect(social.listNotifications(a).unread).toBe(0);
  });

  it('paginates chronologically with a cursor', () => {
    const a = u('alice');
    for (let i = 0; i < 7; i++) {
      const p = social.createPost(a, { kind: 'journal', track, caption: `p${i}`, visibility: 'private' });
      social.S.posts().update(p.id, { createdAt: new Date(Date.now() - (7 - i) * 1000).toISOString() });
    }
    const one = social.feed(a, { scope: 'mine', limit: 3 });
    expect(one.posts.map((p) => p.caption)).toEqual(['p6', 'p5', 'p4']);
    const two = social.feed(a, { scope: 'mine', limit: 3, before: one.nextBefore! });
    expect(two.posts.map((p) => p.caption)).toEqual(['p3', 'p2', 'p1']);
    const three = social.feed(a, { scope: 'mine', limit: 3, before: two.nextBefore! });
    expect(three.posts.map((p) => p.caption)).toEqual(['p0']);
    expect(three.nextBefore).toBeNull();
  });

  it('profiles show only what the viewer may see, and not recommendations', () => {
    const a = u('alice');
    const b = u('bobby');
    const c = u('carol');
    befriend(a, b);
    social.createPost(a, { kind: 'journal', track, visibility: 'public', caption: 'pub', day: today() });
    social.createPost(a, { kind: 'journal', track, visibility: 'friends', caption: 'frn', day: today() });
    social.createPost(a, { kind: 'recommendation', track, toHandle: 'bobby' });
    expect(social.profile(b, 'alice').posts.map((p) => p.caption).sort()).toEqual(['frn', 'pub']);
    expect(social.profile(c, 'alice').posts.map((p) => p.caption)).toEqual(['pub']);
    expect(social.profile(null, 'alice').posts.map((p) => p.caption)).toEqual(['pub']);
    expect(social.profile(b, 'alice').relationship).toBe('friends');
    expect(social.profile(c, 'alice').relationship).toBe('none');
  });

  it('erasing a user removes their posts, friendships, blocks and notifications', () => {
    const a = u('alice');
    const b = u('bobby');
    befriend(a, b);
    social.createPost(a, { kind: 'sotd', track });
    social.blockUser(b, 'alice');
    social.eraseUserSocialData(a.id);
    expect(social.S.posts().all()).toHaveLength(0);
    expect(social.S.friendships().all()).toHaveLength(0);
    expect(social.S.blocks().all()).toHaveLength(0);
  });
});
