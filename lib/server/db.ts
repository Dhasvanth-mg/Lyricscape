import { existsSync, readFileSync, renameSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { dataDir } from './config';

// A tiny, durable JSON document store used in place of Supabase Postgres for local runs.
// Repositories in lib/server/*.ts are the only code that touches it, so swapping in
// Postgres + RLS later means re-implementing those repositories, not the app.

type Row = { id: string };

export class Table<T extends Row> {
  private rows = new Map<string, T>();
  constructor(
    public readonly name: string,
    private onChange: () => void,
  ) {}

  load(items: T[]) {
    this.rows.clear();
    for (const r of items) this.rows.set(r.id, r);
  }
  all(): T[] {
    return [...this.rows.values()];
  }
  get(id: string): T | undefined {
    return this.rows.get(id);
  }
  where(pred: (r: T) => boolean): T[] {
    const out: T[] = [];
    for (const r of this.rows.values()) if (pred(r)) out.push(r);
    return out;
  }
  find(pred: (r: T) => boolean): T | undefined {
    for (const r of this.rows.values()) if (pred(r)) return r;
    return undefined;
  }
  insert(row: T): T {
    if (this.rows.has(row.id)) throw new Error(`duplicate id in ${this.name}`);
    this.rows.set(row.id, row);
    this.onChange();
    return row;
  }
  update(id: string, patch: Partial<T>): T {
    const cur = this.rows.get(id);
    if (!cur) throw new Error(`${this.name}/${id} not found`);
    const next = { ...cur, ...patch, id } as T;
    this.rows.set(id, next);
    this.onChange();
    return next;
  }
  delete(id: string): boolean {
    const ok = this.rows.delete(id);
    if (ok) this.onChange();
    return ok;
  }
  deleteWhere(pred: (r: T) => boolean): number {
    let n = 0;
    for (const [id, r] of this.rows) {
      if (pred(r)) {
        this.rows.delete(id);
        n++;
      }
    }
    if (n) this.onChange();
    return n;
  }
  toJSON() {
    return this.all();
  }
}

export class Database {
  private tables = new Map<string, Table<Row>>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  readonly file: string;

  constructor(dir: string = dataDir()) {
    mkdirSync(dir, { recursive: true });
    this.file = path.join(dir, 'db.json');
  }

  open() {
    if (existsSync(this.file)) {
      try {
        const data = JSON.parse(readFileSync(this.file, 'utf8')) as Record<string, Row[]>;
        for (const [name, rows] of Object.entries(data)) this.table(name).load(rows);
      } catch (e) {
        // never silently drop data: keep the unreadable file for manual recovery
        try {
          renameSync(this.file, `${this.file}.corrupt-${Date.now()}`);
        } catch {
          /* ignore */
        }
        console.error('[db] db.json was unreadable and has been set aside:', e);
      }
    }
    return this;
  }

  table<T extends Row>(name: string): Table<T> {
    let t = this.tables.get(name);
    if (!t) {
      t = new Table<Row>(name, () => this.schedule());
      this.tables.set(name, t);
    }
    return t as unknown as Table<T>;
  }

  private schedule() {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      try {
        this.flush();
      } catch (e) {
        console.error('[db] could not persist data (will retry on next change):', (e as Error).message);
      }
    }, 80);
    this.timer.unref?.();
  }

  /** Stop pending writes (used when swapping databases in tests / on shutdown). */
  dispose() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  /** Atomic write: temp file + rename. */
  flush() {
    const out: Record<string, Row[]> = {};
    for (const [name, t] of this.tables) out[name] = t.all();
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, JSON.stringify(out));
    renameSync(tmp, this.file);
  }
}

const g = globalThis as unknown as { __lyricscapeDb?: Database };

/** Singleton that survives Next.js dev hot reloads. */
export function db(): Database {
  if (!g.__lyricscapeDb) {
    g.__lyricscapeDb = new Database().open();
    const flush = () => g.__lyricscapeDb?.flush();
    process.once('beforeExit', flush);
    process.once('SIGINT', () => {
      flush();
      process.exit(0);
    });
  }
  return g.__lyricscapeDb;
}

/** Test helper: point the singleton at a fresh directory. */
export function swapDatabase(instance: Database) {
  g.__lyricscapeDb?.dispose();
  g.__lyricscapeDb = instance;
}
