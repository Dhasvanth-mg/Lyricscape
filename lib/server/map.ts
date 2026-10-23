import { randomUUID } from 'node:crypto';
import { db } from './db';
import { HttpError, cleanText, rateLimit } from './security';
import { T, trackKeyOf, type UserRow } from './party';
import {
  PRECISION_GRID,
  mapSettingsPatchSchema,
  memorySchema,
  recordSessionSchema,
  tripSchema,
  type MapSettings,
  type MemoryDto,
  type PlaceDto,
  type Precision,
  type PrivacyZone,
  type SessionDto,
  type TripDto,
} from '../map/schemas';
import type { TrackRef } from '../party/schemas';

// ---------------------------------------------------------------------------
// Rows (everything is private to its owner; nothing here is ever public)
// ---------------------------------------------------------------------------
export type MapSettingsRow = { id: string; userId: string; enabled: boolean; paused: boolean; precision: Precision; retentionDays: number; zones: (PrivacyZone & { id: string })[] };
export type LocationRow = { id: string; userId: string; cell: string; approxLat: number; approxLng: number; precisionM: number; label?: string; createdAt: string };
export type SessionRow = { id: string; userId: string; track: TrackRef; trackKey: string; startedAt: string; endedAt?: string; locationId?: string; source: string };
export type MemoryRow = { id: string; userId: string; track: TrackRef; caption: string; photo?: string; capturedAt: string; unlockAt?: string; locationId?: string; createdAt: string };
export type TripRow = { id: string; userId: string; name: string; startedAt: string; endedAt: string };

export const M = {
  settings: () => db().table<MapSettingsRow>('map_settings'),
  locations: () => db().table<LocationRow>('listening_locations'),
  sessions: () => db().table<SessionRow>('listening_sessions'),
  memories: () => db().table<MemoryRow>('memories'),
  trips: () => db().table<TripRow>('trips'),
};

const now = () => new Date().toISOString();
const DEFAULTS = { enabled: false, paused: false, precision: 'approx' as Precision, retentionDays: 365, zones: [] };

export function getSettings(userId: string): MapSettings {
  const row = M.settings().find((s) => s.userId === userId);
  if (!row) return { ...DEFAULTS, zones: [] };
  return { enabled: row.enabled, paused: row.paused, precision: row.precision, retentionDays: row.retentionDays, zones: row.zones };
}

export function updateSettings(userId: string, raw: unknown): MapSettings {
  const p = mapSettingsPatchSchema.parse(raw);
  const cur = M.settings().find((s) => s.userId === userId);
  const zones = p.zones ? p.zones.map((z) => ({ ...z, label: cleanText(z.label, 60), id: z.id ?? randomUUID() })) : cur?.zones ?? [];
  const next = {
    enabled: p.enabled ?? cur?.enabled ?? DEFAULTS.enabled,
    paused: p.paused ?? cur?.paused ?? DEFAULTS.paused,
    precision: p.precision ?? cur?.precision ?? DEFAULTS.precision,
    retentionDays: p.retentionDays ?? cur?.retentionDays ?? DEFAULTS.retentionDays,
    zones,
  };
  if (cur) M.settings().update(cur.id, next);
  else M.settings().insert({ id: randomUUID(), userId, ...next });
  // turning capture off must never leave a half-state: stop here, history is kept until the user deletes it
  if (p.retentionDays !== undefined) sweepRetention(userId);
  return getSettings(userId);
}

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------
const R = 6371000;
export function distanceM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/**
 * Snap to the centre of a grid cell. The exact coordinate is discarded: only the cell is stored,
 * so the true position is never recoverable to better than the chosen precision.
 */
export function quantize(lat: number, lng: number, precision: Precision): { lat: number; lng: number; cell: string; precisionM: number } {
  const { deg, meters } = PRECISION_GRID[precision];
  const clampLat = Math.max(-89.999, Math.min(89.999, lat));
  const iLat = Math.floor(clampLat / deg);
  const wrapped = (((lng + 180) % 360) + 360) % 360 - 180;
  const iLng = Math.floor(wrapped / deg);
  const cLat = (iLat + 0.5) * deg;
  const cLng = (iLng + 0.5) * deg;
  const r = (n: number) => Math.round(n * 1e6) / 1e6;
  return { lat: r(cLat), lng: r(cLng), cell: `${precision}:${iLat}:${iLng}`, precisionM: meters };
}

export function inPrivacyZone(lat: number, lng: number, zones: PrivacyZone[]): PrivacyZone | undefined {
  // a point is hidden if any part of its uncertainty cell could be inside the zone
  return zones.find((z) => distanceM(lat, lng, z.lat, z.lng) <= z.radiusM);
}

// ---------------------------------------------------------------------------
// Capture
// ---------------------------------------------------------------------------
const MAX_BACKDATE_MS = 6 * 3600_000; // never invent retroactive history
const FUTURE_SKEW_MS = 2 * 60_000;
const MERGE_WINDOW_MS = 10 * 60_000;

export function recordSession(user: UserRow, raw: unknown): { session?: SessionRow; place?: LocationRow; skipped?: 'privacy-zone' } {
  const input = recordSessionSchema.parse(raw);
  const settings = getSettings(user.id);
  if (!settings.enabled) throw new HttpError(403, 'location_off', 'Location history is off. Turn it on in the Map first.');
  if (settings.paused) throw new HttpError(409, 'location_paused', 'Location history is paused.');
  rateLimit(`map:${user.id}`, 60, 60_000);

  const started = Date.parse(input.startedAt);
  if (started > Date.now() + FUTURE_SKEW_MS) throw new HttpError(400, 'bad_time', 'That listening session is in the future.');
  if (started < Date.now() - MAX_BACKDATE_MS) throw new HttpError(400, 'no_backfill', 'Only live listening can be logged. Past history is never reconstructed.');
  const hasPlace = input.lat !== undefined && input.lng !== undefined;
  if ((input.lat === undefined) !== (input.lng === undefined)) throw new HttpError(400, 'bad_location', 'Send both latitude and longitude.');

  let place: LocationRow | undefined;
  if (hasPlace) {
    const q = quantize(input.lat!, input.lng!, settings.precision);
    // inside (or one cell away from) a privacy zone: store nothing at all
    if (inPrivacyZone(input.lat!, input.lng!, settings.zones) || inPrivacyZone(q.lat, q.lng, settings.zones)) return { skipped: 'privacy-zone' };
    place = M.locations().find((l) => l.userId === user.id && l.cell === q.cell);
    place ??= M.locations().insert({ id: randomUUID(), userId: user.id, cell: q.cell, approxLat: q.lat, approxLng: q.lng, precisionM: q.precisionM, createdAt: now() });
  }

  const track: TrackRef = { ...input.track, title: cleanText(input.track.title, 160), artists: input.track.artists.map((a) => cleanText(a, 120)) };
  const key = trackKeyOf(track);
  // continuous listening to the same song in the same place is one session
  const recent = M.sessions().find((s) => s.userId === user.id && s.trackKey === key && s.locationId === place?.id && Date.parse(s.endedAt ?? s.startedAt) > started - MERGE_WINDOW_MS);
  if (recent) {
    const session = M.sessions().update(recent.id, { endedAt: input.endedAt ?? input.startedAt });
    return { session, place };
  }
  const session = M.sessions().insert({
    id: randomUUID(),
    userId: user.id,
    track,
    trackKey: key,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    locationId: place?.id,
    source: input.source,
  });
  sweepRetention(user.id);
  return { session, place };
}

export function sweepRetention(userId: string, nowMs = Date.now()) {
  const s = getSettings(userId);
  const cutoff = nowMs - s.retentionDays * 86_400_000;
  M.sessions().deleteWhere((r) => r.userId === userId && Date.parse(r.startedAt) < cutoff);
  M.memories().deleteWhere((r) => r.userId === userId && Date.parse(r.createdAt) < cutoff && !r.unlockAt);
  pruneOrphanLocations(userId);
}

function pruneOrphanLocations(userId: string) {
  const used = new Set<string>();
  for (const s of M.sessions().where((s) => s.userId === userId)) if (s.locationId) used.add(s.locationId);
  for (const m of M.memories().where((m) => m.userId === userId)) if (m.locationId) used.add(m.locationId);
  M.locations().deleteWhere((l) => l.userId === userId && !used.has(l.id));
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------
const placeDto = (l: LocationRow | undefined): PlaceDto | undefined => (l ? { id: l.id, lat: l.approxLat, lng: l.approxLng, precisionM: l.precisionM, label: l.label } : undefined);

export function listSessions(userId: string, opts: { from?: string; to?: string; limit?: number } = {}): SessionDto[] {
  const from = opts.from ? Date.parse(opts.from) : -Infinity;
  const to = opts.to ? Date.parse(opts.to) : Infinity;
  const places = new Map(M.locations().where((l) => l.userId === userId).map((l) => [l.id, l]));
  return M.sessions()
    .where((s) => s.userId === userId && Date.parse(s.startedAt) >= from && Date.parse(s.startedAt) <= to)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, Math.min(opts.limit ?? 1000, 5000))
    .map((s) => ({ id: s.id, track: s.track, trackKey: s.trackKey, startedAt: s.startedAt, endedAt: s.endedAt, source: s.source, place: placeDto(s.locationId ? places.get(s.locationId) : undefined) }));
}

export function deleteSession(userId: string, id: string) {
  const s = M.sessions().get(id);
  if (!s || s.userId !== userId) throw new HttpError(404, 'not_found', 'Spot not found');
  M.sessions().delete(id);
  pruneOrphanLocations(userId);
}

/** Delete every spot at one place (e.g. “hide this place”). */
export function deletePlace(userId: string, locationId: string) {
  const l = M.locations().get(locationId);
  if (!l || l.userId !== userId) throw new HttpError(404, 'not_found', 'Place not found');
  M.sessions().deleteWhere((s) => s.userId === userId && s.locationId === locationId);
  // memories keep their text; only the place link is removed
  for (const m of M.memories().where((m) => m.userId === userId && m.locationId === locationId)) M.memories().update(m.id, { locationId: undefined });
  M.locations().delete(locationId);
}

export function deleteAllMapHistory(userId: string) {
  M.sessions().deleteWhere((s) => s.userId === userId);
  M.memories().deleteWhere((s) => s.userId === userId);
  M.trips().deleteWhere((s) => s.userId === userId);
  M.locations().deleteWhere((s) => s.userId === userId);
}

// ---------------------------------------------------------------------------
// Memories (song memories + time capsules)
// ---------------------------------------------------------------------------
export function createMemory(user: UserRow, raw: unknown): MemoryRow {
  const p = memorySchema.parse(raw);
  rateLimit(`memory:${user.id}`, 30, 60_000);
  let locationId: string | undefined;
  if (p.sessionId) {
    const s = M.sessions().get(p.sessionId);
    if (!s || s.userId !== user.id) throw new HttpError(404, 'not_found', 'Listening spot not found');
    locationId = s.locationId;
  }
  const unlock = p.unlockAt ? Date.parse(p.unlockAt) : undefined;
  if (unlock !== undefined && unlock < Date.now() - 60_000) throw new HttpError(400, 'bad_time', 'A time capsule must unlock in the future.');
  return M.memories().insert({
    id: randomUUID(),
    userId: user.id,
    track: { ...p.track, title: cleanText(p.track.title, 160), artists: p.track.artists.map((a) => cleanText(a, 120)) },
    caption: cleanText(p.caption, 1000),
    photo: p.photo,
    capturedAt: p.capturedAt ?? now(),
    unlockAt: p.unlockAt,
    locationId,
    createdAt: now(),
  });
}

export function listMemories(userId: string, nowMs = Date.now()): MemoryDto[] {
  const places = new Map(M.locations().where((l) => l.userId === userId).map((l) => [l.id, l]));
  return M.memories()
    .where((m) => m.userId === userId)
    .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))
    .map((m) => {
      const locked = !!m.unlockAt && Date.parse(m.unlockAt) > nowMs;
      return {
        id: m.id,
        // a locked capsule reveals the song only after it opens (the point of a capsule)
        track: locked ? { provider: m.track.provider, title: 'Time capsule', artists: ['Sealed'] } : m.track,
        caption: locked ? undefined : m.caption,
        photo: locked ? undefined : m.photo,
        capturedAt: m.capturedAt,
        unlockAt: m.unlockAt,
        locked,
        place: placeDto(m.locationId ? places.get(m.locationId) : undefined),
      };
    });
}

export function deleteMemory(userId: string, id: string) {
  const m = M.memories().get(id);
  if (!m || m.userId !== userId) throw new HttpError(404, 'not_found', 'Memory not found');
  M.memories().delete(id);
  pruneOrphanLocations(userId);
}

// ---------------------------------------------------------------------------
// Trips → travel soundtracks
// ---------------------------------------------------------------------------
export function createTrip(user: UserRow, raw: unknown): TripRow {
  const p = tripSchema.parse(raw);
  if (Date.parse(p.endedAt) < Date.parse(p.startedAt)) throw new HttpError(400, 'bad_time', 'A trip cannot end before it starts.');
  return M.trips().insert({ id: randomUUID(), userId: user.id, name: cleanText(p.name, 80), startedAt: p.startedAt, endedAt: p.endedAt });
}

export function listTrips(userId: string): TripDto[] {
  return M.trips()
    .where((t) => t.userId === userId)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .map((t) => {
      const sessions = M.sessions().where((s) => s.userId === userId && s.startedAt >= t.startedAt && s.startedAt <= t.endedAt).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
      const seen = new Set<string>();
      const tracks: TrackRef[] = [];
      for (const s of sessions) if (!seen.has(s.trackKey)) (seen.add(s.trackKey), tracks.push(s.track));
      return { id: t.id, name: t.name, startedAt: t.startedAt, endedAt: t.endedAt, tracks, sessionCount: sessions.length };
    });
}

export function deleteTrip(userId: string, id: string) {
  const t = M.trips().get(id);
  if (!t || t.userId !== userId) throw new HttpError(404, 'not_found', 'Trip not found');
  M.trips().delete(id);
}

// ---------------------------------------------------------------------------
// Export / erase everything (DELETE /api/me/data, POST /api/me/export)
// ---------------------------------------------------------------------------
export function exportUserData(user: UserRow) {
  return {
    exportedAt: now(),
    profile: { handle: user.handle, displayName: user.displayName, createdAt: user.createdAt },
    mapSettings: getSettings(user.id),
    places: M.locations().where((l) => l.userId === user.id),
    listeningSessions: M.sessions().where((s) => s.userId === user.id),
    memories: M.memories().where((m) => m.userId === user.id),
    trips: M.trips().where((t) => t.userId === user.id),
    parties: T.members()
      .where((m) => m.userId === user.id)
      .map((m) => ({ eventId: m.eventId, role: m.role, joinedAt: m.joinedAt, title: T.events().get(m.eventId)?.title })),
  };
}

/** Erase the user's map data, settings and profile. Hosted parties are deleted via deleteEvent first (by the route). */
export function eraseUserMapData(userId: string) {
  deleteAllMapHistory(userId);
  M.settings().deleteWhere((s) => s.userId === userId);
}
