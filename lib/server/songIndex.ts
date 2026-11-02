// The song index repository: SQLite (node:sqlite, built into Node 22.5+) in .data/song-index.sqlite. If SQLite is not available the
// index reports `available: false` and the app carries on without it (nothing depends on it being there).
// Like the other repositories in lib/server, this is the only code that touches the store, so a cloud database can replace it later.

import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import type { DatabaseSync, StatementSync } from 'node:sqlite';
import { FEATURE_KINDS, featureSchemas, fingerprint, fingerprints, type FeatureKind, type IndexEntry, type IndexStats, type PutBody, type SongMeta } from '../index/types';
import { hasTempo } from '../analysis/types';

const SCHEMA_VERSION = 1;

/**
 * Where the index lives. NOT inside the project folder by default: `next dev` watches the project, and a database that is opened, read
 * and written while you use the app makes it rebuild and reload the page in a loop (found the hard way). LYRICSCAPE_INDEX_DIR overrides;
 * an explicit LYRICSCAPE_DATA_DIR (tests, a custom data folder) is respected; otherwise ~/.lyricscape.
 */
export function indexDir(): string {
  const dir = process.env.LYRICSCAPE_INDEX_DIR || process.env.LYRICSCAPE_DATA_DIR || path.join(os.homedir(), '.lyricscape');
  return path.resolve(process.cwd(), dir);
}

type Prepared = {
  getSong: StatementSync;
  getFeatures: StatementSync;
  upsertSong: StatementSync;
  upsertFeature: StatementSync;
  touch: StatementSync;
  byFp: StatementSync;
  del: StatementSync;
  delFeatures: StatementSync;
  delKind: StatementSync;
};

type State = { db: DatabaseSync; file: string; st: Prepared };
const g = globalThis as unknown as { __lyricscapeSongIndex?: State | null | 'unavailable'; __lyricscapeSongIndexDir?: string };

function open(): State | null {
  const dir = indexDir();
  const cached = g.__lyricscapeSongIndex;
  if (cached && cached !== 'unavailable' && g.__lyricscapeSongIndexDir === dir) return cached;
  if (cached && cached !== 'unavailable') closeIndex();
  let Database: typeof DatabaseSync;
  try {
    // loaded lazily so a Node without node:sqlite only loses the index, not the whole server
    // getBuiltinModule works inside the Next.js server bundle (where import.meta.url is not a real file); createRequire covers older Nodes
    const mod = (process as unknown as { getBuiltinModule?: (id: string) => unknown }).getBuiltinModule?.('node:sqlite') ?? createRequire(import.meta.url)('node:sqlite');
    Database = (mod as typeof import('node:sqlite')).DatabaseSync;
  } catch (e) {
    if (g.__lyricscapeSongIndex !== 'unavailable') console.warn('[song-index] node:sqlite is not available; the index is off:', (e as Error).message);
    g.__lyricscapeSongIndex = 'unavailable';
    return null;
  }
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'song-index.sqlite');
  const db = new Database(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = ON;');
  const v = (db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;
  if (v < SCHEMA_VERSION) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS songs (
        key TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        title TEXT NOT NULL,
        artists TEXT NOT NULL,
        duration_ms INTEGER NOT NULL,
        fp TEXT NOT NULL,
        first_seen INTEGER NOT NULL,
        last_seen INTEGER NOT NULL,
        plays INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS songs_fp ON songs(fp);
      CREATE INDEX IF NOT EXISTS songs_title ON songs(title COLLATE NOCASE);
      CREATE TABLE IF NOT EXISTS features (
        key TEXT NOT NULL REFERENCES songs(key) ON DELETE CASCADE,
        kind TEXT NOT NULL,
        version INTEGER NOT NULL,
        json TEXT NOT NULL,
        bytes INTEGER NOT NULL,
        has_tempo INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (key, kind)
      );
      CREATE INDEX IF NOT EXISTS features_kind ON features(kind);
      PRAGMA user_version = ${SCHEMA_VERSION};
    `);
  }
  const st: Prepared = {
    getSong: db.prepare('SELECT key, provider, title, artists, duration_ms, first_seen, last_seen, plays FROM songs WHERE key = ?'),
    getFeatures: db.prepare('SELECT kind, json FROM features WHERE key = ?'),
    upsertSong: db.prepare(
      `INSERT INTO songs (key, provider, title, artists, duration_ms, fp, first_seen, last_seen, plays) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
       ON CONFLICT(key) DO UPDATE SET provider = excluded.provider, title = excluded.title, artists = excluded.artists, duration_ms = excluded.duration_ms, fp = excluded.fp, last_seen = excluded.last_seen`,
    ),
    upsertFeature: db.prepare(
      `INSERT INTO features (key, kind, version, json, bytes, has_tempo, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(key, kind) DO UPDATE SET version = excluded.version, json = excluded.json, bytes = excluded.bytes, has_tempo = excluded.has_tempo, updated_at = excluded.updated_at`,
    ),
    touch: db.prepare('UPDATE songs SET plays = plays + 1, last_seen = ? WHERE key = ?'),
    byFp: db.prepare(`SELECT f.json FROM songs s JOIN features f ON f.key = s.key AND f.kind = 'audio' WHERE s.fp IN (?, ?, ?) AND s.key <> ? ORDER BY f.has_tempo DESC, f.updated_at DESC LIMIT 1`),
    del: db.prepare('DELETE FROM songs WHERE key = ?'),
    delFeatures: db.prepare('DELETE FROM features WHERE key = ?'),
    delKind: db.prepare('DELETE FROM features WHERE key = ? AND kind = ?'),
  };
  const state = { db, file, st };
  g.__lyricscapeSongIndex = state;
  g.__lyricscapeSongIndexDir = dir;
  return state;
}

function closeIndex() {
  const c = g.__lyricscapeSongIndex;
  if (c && c !== 'unavailable') {
    try {
      c.db.close();
    } catch {
      /* already closed */
    }
  }
  g.__lyricscapeSongIndex = undefined;
}

const parse = <K extends FeatureKind>(kind: K, json: string) => {
  const r = featureSchemas[kind].safeParse(JSON.parse(json));
  return r.success ? (r.data as never) : null; // a record that no longer fits the schema is ignored (and rewritten on the next save)
};

export const songIndex = {
  available(): boolean {
    return open() !== null;
  },

  /** Everything known about a song. If this id has no audio features but another copy of the same recording does, those are used. */
  get(key: string, meta?: Pick<SongMeta, 'title' | 'artists' | 'durationMs'>): IndexEntry | null {
    const s = open();
    if (!s) return null;
    const row = s.st.getSong.get(key) as { key: string; provider: string; title: string; artists: string; duration_ms: number; first_seen: number; last_seen: number; plays: number } | undefined;
    const entry: IndexEntry | null = row
      ? { key, song: { provider: row.provider, title: row.title, artists: JSON.parse(row.artists) as string[], durationMs: row.duration_ms, plays: row.plays, firstSeen: row.first_seen, lastSeen: row.last_seen }, features: {} }
      : null;
    if (entry) {
      for (const f of s.st.getFeatures.all(key) as { kind: FeatureKind; json: string }[]) {
        if (!FEATURE_KINDS.includes(f.kind)) continue;
        const v = parse(f.kind, f.json);
        if (v) (entry.features as Record<string, unknown>)[f.kind] = v;
      }
    }
    if ((!entry || !hasTempoOf(entry)) && meta) {
      const [a, b, c] = fingerprints(meta) as [string, string, string];
      const other = s.st.byFp.get(a, b, c, key) as { json: string } | undefined;
      const audio = other ? parse('audio', other.json) : null;
      if (audio && (!entry?.features.audio || (hasTempo(audio) && !hasTempo(entry.features.audio)))) {
        const base: IndexEntry = entry ?? { key, song: { provider: 'unknown', title: meta.title, artists: meta.artists, durationMs: meta.durationMs, plays: 0, firstSeen: 0, lastSeen: 0 }, features: {} };
        base.features.audio = audio;
        base.audioVia = 'fingerprint';
        return base;
      }
    }
    return entry;
  },

  /** Insert or update a song and the features given (others are left as they are). */
  put(key: string, body: PutBody): void {
    const s = open();
    if (!s) throw new Error('song index unavailable');
    const now = Date.now();
    s.db.exec('BEGIN');
    try {
      s.st.upsertSong.run(key, body.song.provider, body.song.title, JSON.stringify(body.song.artists), body.song.durationMs, fingerprint(body.song), now, now);
      for (const kind of FEATURE_KINDS) {
        const v = body.features[kind];
        if (!v) continue;
        const json = JSON.stringify(v);
        const version = kind === 'audio' ? (v as { version: number }).version : 1;
        const tempo = kind === 'audio' && hasTempo(v as Parameters<typeof hasTempo>[0]) ? 1 : 0;
        s.st.upsertFeature.run(key, kind, version, json, json.length, tempo, now);
      }
      s.db.exec('COMMIT');
    } catch (e) {
      s.db.exec('ROLLBACK');
      throw e;
    }
  },

  /** Count a play. */
  touch(key: string): void {
    open()?.st.touch.run(Date.now(), key);
  },

  remove(key: string): boolean {
    const s = open();
    if (!s) return false;
    s.st.delFeatures.run(key);
    return Number(s.st.del.run(key).changes) > 0;
  },

  /** Forget one kind of data about a song (for example its lyrics when the user removes them). */
  removeFeature(key: string, kind: FeatureKind): boolean {
    const s = open();
    if (!s) return false;
    return Number(s.st.delKind.run(key, kind).changes) > 0;
  },

  clear(): number {
    const s = open();
    if (!s) return 0;
    const n = (s.db.prepare('SELECT COUNT(*) AS n FROM songs').get() as { n: number }).n;
    s.db.exec('DELETE FROM features; DELETE FROM songs;');
    s.db.exec('VACUUM');
    return n;
  },

  stats(): IndexStats {
    const s = open();
    const empty: IndexStats = { available: false, songs: 0, bytes: 0, byKind: { audio: { count: 0, bytes: 0 }, palette: { count: 0, bytes: 0 }, lyrics: { count: 0, bytes: 0 } }, withTempo: 0, file: null };
    if (!s) return empty;
    const songs = (s.db.prepare('SELECT COUNT(*) AS n FROM songs').get() as { n: number }).n;
    const out: IndexStats = { ...empty, available: true, songs, file: s.file };
    for (const r of s.db.prepare('SELECT kind, COUNT(*) AS n, COALESCE(SUM(bytes), 0) AS b, COALESCE(SUM(has_tempo), 0) AS t FROM features GROUP BY kind').all() as { kind: FeatureKind; n: number; b: number; t: number }[]) {
      if (!out.byKind[r.kind]) continue;
      out.byKind[r.kind] = { count: r.n, bytes: r.b };
      out.bytes += r.b;
      if (r.kind === 'audio') out.withTempo = r.t;
    }
    return out;
  },

  /** For tests: close the connection so the data directory can be removed. */
  close: closeIndex,
};

function hasTempoOf(e: IndexEntry): boolean {
  return !!e.features.audio && hasTempo(e.features.audio);
}
