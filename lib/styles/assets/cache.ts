// A least-recently-used cache with a byte budget (Phase 2 INF-06, performance-and-caching.md): textures and painted sheets are
// kept until the budget is reached, then the oldest are disposed first. Entries can be pinned for the current scene family so
// a long line never evicts the ground it is drawn on. Pure bookkeeping: the caller passes a dispose function that frees the GPU
// object, so this file can be tested without a GPU.

export type CacheStats = { entries: number; bytes: number; hits: number; misses: number; evictions: number };

export class BudgetCache<V> {
  private map = new Map<string, { v: V; bytes: number; group: string }>();
  private pinned = new Set<string>();
  private bytes = 0;
  private hits = 0;
  private misses = 0;
  private evictions = 0;

  constructor(
    public budgetBytes: number,
    private dispose: (v: V, key: string) => void,
  ) {}

  get(key: string): V | undefined {
    const e = this.map.get(key);
    if (!e) {
      this.misses++;
      return undefined;
    }
    this.hits++;
    this.map.delete(key);
    this.map.set(key, e);
    return e.v;
  }

  has(key: string): boolean {
    return this.map.has(key);
  }

  /** Add or replace an entry. `group` (a scene family id, say) lets a whole group be pinned or released together. */
  set(key: string, v: V, bytes: number, group = ''): V {
    const old = this.map.get(key);
    if (old) {
      this.bytes -= old.bytes;
      this.map.delete(key);
      if (old.v !== v) this.dispose(old.v, key);
    }
    this.map.set(key, { v, bytes, group });
    this.bytes += bytes;
    this.evict();
    return v;
  }

  getOrCreate(key: string, make: () => { v: V; bytes: number }, group = ''): V {
    const hit = this.get(key);
    if (hit !== undefined) return hit;
    const { v, bytes } = make();
    return this.set(key, v, bytes, group);
  }

  /** Keep every entry of these groups through evictions (the scene being drawn and the one being prefetched). */
  pin(groups: string[]) {
    this.pinned = new Set(groups);
  }

  /** Dispose every entry of a group (a scene family the plan has left). */
  release(group: string) {
    for (const [k, e] of [...this.map]) if (e.group === group) this.drop(k, e);
  }

  clear(filter?: (key: string) => boolean) {
    for (const [k, e] of [...this.map]) if (!filter || filter(k)) this.drop(k, e);
  }

  stats(): CacheStats {
    return { entries: this.map.size, bytes: this.bytes, hits: this.hits, misses: this.misses, evictions: this.evictions };
  }

  private drop(k: string, e: { v: V; bytes: number }) {
    this.map.delete(k);
    this.bytes -= e.bytes;
    this.dispose(e.v, k);
  }

  private evict() {
    if (this.bytes <= this.budgetBytes) return;
    const entries = [...this.map];
    // never evict the entry just added (the newest): it is about to be drawn
    const newest = entries[entries.length - 1]?.[0];
    for (const [k, e] of entries) {
      if (this.bytes <= this.budgetBytes) break;
      if (k === newest) break;
      if (this.pinned.has(e.group)) continue;
      this.drop(k, e);
      this.evictions++;
    }
  }
}

/** Bytes of an RGBA8 texture with a full mip chain. */
export const textureBytes = (w: number, h: number, mips = true) => Math.ceil(w * h * 4 * (mips ? 4 / 3 : 1));
