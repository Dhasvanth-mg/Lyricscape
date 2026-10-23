import type { PartyEventType, PartyMessage } from '../party/schemas';

// In-process pub/sub that replaces Supabase Realtime locally.
// Durable truth is always the database; messages are hints that tell clients to refetch.
// Each event keeps a monotonically increasing `seq` so clients can detect missed messages.

type Listener = (m: PartyMessage) => void;
const g = globalThis as unknown as { __lyricscapeBus?: { seq: Map<string, number>; subs: Map<string, Set<Listener>>; presence: Map<string, Map<string, number>> } };
const state = (g.__lyricscapeBus ??= { seq: new Map(), subs: new Map(), presence: new Map() });

export function currentSeq(eventId: string): number {
  return state.seq.get(eventId) ?? 0;
}

export function publish(eventId: string, type: PartyEventType, data?: Record<string, unknown>): PartyMessage {
  const seq = currentSeq(eventId) + 1;
  state.seq.set(eventId, seq);
  const msg: PartyMessage = { seq, type, at: new Date().toISOString(), data };
  for (const l of state.subs.get(eventId) ?? []) {
    try {
      l(msg);
    } catch {
      /* a dead stream must not break others */
    }
  }
  return msg;
}

export function subscribe(eventId: string, fn: Listener): () => void {
  let set = state.subs.get(eventId);
  if (!set) state.subs.set(eventId, (set = new Set()));
  set.add(fn);
  return () => {
    set!.delete(fn);
    if (set!.size === 0) state.subs.delete(eventId);
  };
}

export function subscriberCount(eventId: string): number {
  return state.subs.get(eventId)?.size ?? 0;
}

// ---- presence (ephemeral, never persisted) ----------------------------------------------
export function touchPresence(eventId: string, memberId: string) {
  let m = state.presence.get(eventId);
  if (!m) state.presence.set(eventId, (m = new Map()));
  m.set(memberId, Date.now());
}
export function dropPresence(eventId: string, memberId: string) {
  state.presence.get(eventId)?.delete(memberId);
}
export function onlineMembers(eventId: string, withinMs = 45_000): Set<string> {
  const m = state.presence.get(eventId);
  const now = Date.now();
  const out = new Set<string>();
  if (m) for (const [id, t] of m) if (now - t < withinMs) out.add(id);
  return out;
}
