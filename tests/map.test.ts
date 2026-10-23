import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

const dir = mkdtempSync(path.join(tmpdir(), 'lyricscape-map-'));
process.env.LYRICSCAPE_DATA_DIR = dir;
process.env.LYRICSCAPE_SECRET = 'test-secret-test-secret-test-secret';

const { Database, swapDatabase, db } = await import('@/lib/server/db');
const party = await import('@/lib/server/party');
const map = await import('@/lib/server/map');
const sec = await import('@/lib/server/security');
const { PRECISION_GRID } = await import('@/lib/map/schemas');

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

const user = (h = 'mapper') => party.loginLocalUser(h, h);
const track = { provider: 'demo' as const, providerTrackId: 'neon-static', title: 'Neon Static', artists: ['Lab'] };
const nowIso = (offsetMs = 0) => new Date(Date.now() + offsetMs).toISOString();
const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return e instanceof sec.HttpError ? `${e.status}:${e.code}` : `ERR:${(e as Error).message}`;
  }
  return 'ok';
};

describe('opt-in', () => {
  it('collects nothing until the user opts in', () => {
    const u = user();
    expect(map.getSettings(u.id).enabled).toBe(false);
    expect(code(() => map.recordSession(u, { track, startedAt: nowIso(), lat: 40.7, lng: -74 }))).toBe('403:location_off');
    expect(map.listSessions(u.id)).toHaveLength(0);
  });

  it('pausing or revoking stops future capture immediately', () => {
    const u = user();
    map.updateSettings(u.id, { enabled: true });
    expect(code(() => map.recordSession(u, { track, startedAt: nowIso(), lat: 40.7, lng: -74 }))).toBe('ok');
    map.updateSettings(u.id, { paused: true });
    expect(code(() => map.recordSession(u, { track: { ...track, title: 'Other' }, startedAt: nowIso(), lat: 40.7, lng: -74 }))).toBe('409:location_paused');
    map.updateSettings(u.id, { paused: false, enabled: false });
    expect(code(() => map.recordSession(u, { track, startedAt: nowIso(), lat: 40.7, lng: -74 }))).toBe('403:location_off');
    expect(map.listSessions(u.id)).toHaveLength(1);
  });
});

describe('precision: exact coordinates are never stored', () => {
  it('quantizes to a grid cell within the promised distance for every precision level', () => {
    const rnd = (() => {
      let s = 7;
      return () => ((s = (s * 16807) % 2147483647) / 2147483647);
    })();
    for (const precision of ['coarse', 'approx', 'precise'] as const) {
      for (let i = 0; i < 300; i++) {
        const lat = rnd() * 160 - 80;
        const lng = rnd() * 358 - 179;
        const q = map.quantize(lat, lng, precision);
        // the stored point is a cell centre: never the original, and within half a cell diagonal
        expect(map.distanceM(lat, lng, q.lat, q.lng)).toBeLessThanOrEqual(PRECISION_GRID[precision].meters * 1.2);
        expect(q.lat === lat && q.lng === lng).toBe(false);
      }
    }
  });

  it('persists only the cell centre and never the submitted coordinate', () => {
    const u = user();
    map.updateSettings(u.id, { enabled: true, precision: 'approx' });
    const lat = 40.712776;
    const lng = -74.005974;
    map.recordSession(u, { track, startedAt: nowIso(), lat, lng, accuracyM: 12 });
    const raw = JSON.stringify([map.M.locations().all(), map.M.sessions().all()]);
    expect(raw).not.toContain('40.712776');
    expect(raw).not.toContain('74.005974');
    const place = map.M.locations().all()[0]!;
    expect(place.precisionM).toBe(PRECISION_GRID.approx.meters);
    expect(map.distanceM(lat, lng, place.approxLat, place.approxLng)).toBeLessThan(900);
  });

  it('the same place maps to the same cell (clustering) and different places to different cells', () => {
    const u = user();
    map.updateSettings(u.id, { enabled: true, precision: 'approx' });
    map.recordSession(u, { track, startedAt: nowIso(-3 * 3600_000), lat: 40.7121, lng: -74.0059 });
    map.recordSession(u, { track: { ...track, title: 'B' }, startedAt: nowIso(-2 * 3600_000), lat: 40.7124, lng: -74.0061 });
    map.recordSession(u, { track: { ...track, title: 'C' }, startedAt: nowIso(-1 * 3600_000), lat: 48.8566, lng: 2.3522 });
    expect(map.M.locations().all()).toHaveLength(2);
  });

  it('coarser precision hides more: two nearby points merge', () => {
    const u = user();
    map.updateSettings(u.id, { enabled: true, precision: 'coarse' });
    map.recordSession(u, { track, startedAt: nowIso(-3000), lat: 40.71, lng: -74.01 });
    map.recordSession(u, { track: { ...track, title: 'B' }, startedAt: nowIso(-2000), lat: 40.73, lng: -74.03 });
    expect(map.M.locations().all()).toHaveLength(1);
  });
});

describe('privacy zones and no invented history', () => {
  it('stores nothing at all inside a privacy zone (home/work)', () => {
    const u = user();
    map.updateSettings(u.id, { enabled: true, zones: [{ label: 'Home', lat: 40.7128, lng: -74.006, radiusM: 400 }] });
    const r = map.recordSession(u, { track, startedAt: nowIso(), lat: 40.713, lng: -74.0055 });
    expect(r.skipped).toBe('privacy-zone');
    expect(map.M.sessions().all()).toHaveLength(0);
    expect(map.M.locations().all()).toHaveLength(0);
    // outside the zone it records normally
    expect(map.recordSession(u, { track, startedAt: nowIso(), lat: 40.8, lng: -73.9 }).session).toBeTruthy();
  });

  it('refuses retroactive and future sessions', () => {
    const u = user();
    map.updateSettings(u.id, { enabled: true });
    expect(code(() => map.recordSession(u, { track, startedAt: nowIso(-30 * 86400_000), lat: 1, lng: 1 }))).toBe('400:no_backfill');
    expect(code(() => map.recordSession(u, { track, startedAt: nowIso(3600_000), lat: 1, lng: 1 }))).toBe('400:bad_time');
    expect(code(() => map.recordSession(u, { track, startedAt: nowIso(), lat: 1 }))).toBe('400:bad_location');
  });

  it('can log a listening session with no place at all', () => {
    const u = user();
    map.updateSettings(u.id, { enabled: true });
    const r = map.recordSession(u, { track, startedAt: nowIso() });
    expect(r.session?.locationId).toBeUndefined();
    expect(map.M.locations().all()).toHaveLength(0);
  });

  it('merges continuous listening to the same song in the same place', () => {
    const u = user();
    map.updateSettings(u.id, { enabled: true });
    map.recordSession(u, { track, startedAt: nowIso(-300_000), lat: 40.705, lng: -74.005 });
    map.recordSession(u, { track, startedAt: nowIso(-120_000), lat: 40.7052, lng: -74.0052 });
    expect(map.listSessions(u.id)).toHaveLength(1);
  });
});

describe('ownership, delete, export, retention', () => {
  it('users only ever see their own spots, memories and trips', () => {
    const a = user('alice1');
    const b = user('bobby1');
    for (const u of [a, b]) map.updateSettings(u.id, { enabled: true });
    const s = map.recordSession(a, { track, startedAt: nowIso(), lat: 10, lng: 10 }).session!;
    map.createMemory(a, { track, caption: 'my secret memory' });
    expect(map.listSessions(b.id)).toHaveLength(0);
    expect(map.listMemories(b.id)).toHaveLength(0);
    expect(code(() => map.deleteSession(b.id, s.id))).toBe('404:not_found');
    expect(code(() => map.createMemory(b, { track, caption: 'x', sessionId: s.id }))).toBe('404:not_found');
    expect(JSON.stringify(map.exportUserData(b))).not.toContain('my secret memory');
  });

  it('deleting one spot removes its now-orphaned place', () => {
    const u = user();
    map.updateSettings(u.id, { enabled: true });
    const s = map.recordSession(u, { track, startedAt: nowIso(), lat: 10, lng: 10 }).session!;
    expect(map.M.locations().all()).toHaveLength(1);
    map.deleteSession(u.id, s.id);
    expect(map.M.locations().all()).toHaveLength(0);
  });

  it('"hide this place" deletes every spot there but keeps memory text', () => {
    const u = user();
    map.updateSettings(u.id, { enabled: true });
    const a = map.recordSession(u, { track, startedAt: nowIso(-9000), lat: 10, lng: 10 }).session!;
    map.recordSession(u, { track: { ...track, title: 'B' }, startedAt: nowIso(-8000), lat: 10.0001, lng: 10.0001 });
    map.createMemory(u, { track, caption: 'keep me', sessionId: a.id });
    map.deletePlace(u.id, a.locationId!);
    expect(map.listSessions(u.id)).toHaveLength(0);
    const mem = map.listMemories(u.id)[0]!;
    expect(mem.caption).toBe('keep me');
    expect(mem.place).toBeUndefined();
  });

  it('deleting the whole history leaves nothing behind', () => {
    const u = user();
    map.updateSettings(u.id, { enabled: true });
    map.recordSession(u, { track, startedAt: nowIso(), lat: 10, lng: 10 });
    map.createMemory(u, { track, caption: 'x' });
    map.createTrip(u, { name: 'Trip', startedAt: nowIso(-86400_000), endedAt: nowIso() });
    map.deleteAllMapHistory(u.id);
    const exp = map.exportUserData(u);
    expect([exp.places, exp.listeningSessions, exp.memories, exp.trips].map((x) => x.length)).toEqual([0, 0, 0, 0]);
  });

  it('exports everything the user owns', () => {
    const u = user();
    map.updateSettings(u.id, { enabled: true, precision: 'coarse' });
    map.recordSession(u, { track, startedAt: nowIso(), lat: 10, lng: 10 });
    const exp = map.exportUserData(u);
    expect(exp.profile.handle).toBe('mapper');
    expect(exp.mapSettings.precision).toBe('coarse');
    expect(exp.listeningSessions).toHaveLength(1);
    expect(exp.places).toHaveLength(1);
  });

  it('retention removes old history', () => {
    const u = user();
    map.updateSettings(u.id, { enabled: true });
    const s = map.recordSession(u, { track, startedAt: nowIso(-1000), lat: 10, lng: 10 }).session!;
    map.updateSettings(u.id, { retentionDays: 1 });
    map.sweepRetention(u.id, Date.now() + 5 * 86_400_000);
    expect(map.M.sessions().get(s.id)).toBeUndefined();
    expect(map.M.locations().all()).toHaveLength(0);
  });
});

describe('memories and time capsules', () => {
  it('seals a capsule (hiding song and text) until it unlocks', () => {
    const u = user();
    map.createMemory(u, { track, caption: 'open on my birthday', unlockAt: nowIso(86400_000) });
    const sealed = map.listMemories(u.id)[0]!;
    expect(sealed.locked).toBe(true);
    expect(sealed.caption).toBeUndefined();
    expect(sealed.track.title).toBe('Time capsule');
    const opened = map.listMemories(u.id, Date.now() + 2 * 86400_000)[0]!;
    expect(opened.locked).toBe(false);
    expect(opened.caption).toBe('open on my birthday');
    expect(opened.track.title).toBe('Neon Static');
    expect(code(() => map.createMemory(u, { track, caption: 'x', unlockAt: nowIso(-86400_000) }))).toBe('400:bad_time');
  });

  it('only accepts small JPEG data URLs as photos', () => {
    const u = user();
    expect(code(() => map.createMemory(u, { track, caption: 'x', photo: 'data:text/html;base64,PHNjcmlwdD4=' }))).toMatch(/^ERR/);
    expect(code(() => map.createMemory(u, { track, caption: 'x', photo: 'data:image/jpeg;base64,/9j/4AAQ' }))).toBe('ok');
  });
});

describe('trips', () => {
  it('builds a travel soundtrack from the songs heard during the trip', () => {
    const u = user();
    map.updateSettings(u.id, { enabled: true });
    map.recordSession(u, { track, startedAt: nowIso(-3000), lat: 10, lng: 10 });
    map.recordSession(u, { track: { ...track, title: 'Two', providerTrackId: 't2' }, startedAt: nowIso(-2000), lat: 11, lng: 11 });
    map.recordSession(u, { track, startedAt: nowIso(-1000), lat: 12, lng: 12 });
    map.createTrip(u, { name: 'Weekend', startedAt: nowIso(-86400_000), endedAt: nowIso(60_000) });
    const t = map.listTrips(u.id)[0]!;
    expect(t.tracks.map((x) => x.title).sort()).toEqual(['Neon Static', 'Two']);
    expect(t.sessionCount).toBe(3);
    expect(code(() => map.createTrip(u, { name: 'Bad', startedAt: nowIso(), endedAt: nowIso(-86400_000) }))).toBe('400:bad_time');
  });
});
