// Lyric search and saved lines: the pure parts (shared by the server index, the API and the page).
// Lines come from the lyrics already kept in the song index; nothing is fetched or scraped to search them.

import { z } from 'zod';
import { parseLyrics } from './parse';

export type SearchLine = { idx: number; ms: number | null; text: string };

/** The lines of a lyrics file as plain text, with their start times when the lyrics are synced. */
export function searchableLines(lrc: string, synced = true): SearchLine[] {
  const doc = parseLyrics(lrc);
  const timed = synced && doc.source !== 'plain';
  return doc.lines
    .map((l, idx) => ({ idx, ms: timed ? Math.max(0, Math.round(l.startMs)) : null, text: l.words.map((w) => w.text).join(' ').replace(/\s+/g, ' ').trim() }))
    .filter((l) => l.text.length > 0);
}

/** The words of a query (letters, digits and the marks of joined scripts such as Tamil and Hindi), at most 8. */
export function queryTerms(q: string): string[] {
  return (q.normalize('NFC').match(/[\p{L}\p{N}\p{M}']+/gu) ?? []).map((t) => t.replace(/^'+|'+$/g, '')).filter(Boolean).slice(0, 8);
}

/** An FTS5 MATCH expression: every word must appear, each as a prefix. Quoted, so no user text is read as FTS syntax. */
export function ftsQuery(q: string): string | null {
  const terms = queryTerms(q);
  if (!terms.length) return null;
  return terms.map((t) => `"${t.replace(/"/g, '""')}"*`).join(' ');
}

/** Marks around a matched word in a snippet (private-use characters, never in lyrics). */
export const HIT_OPEN = '';
export const HIT_CLOSE = '';

/** Split a snippet into plain and matched parts for display. */
export function snippetParts(s: string): { text: string; hit: boolean }[] {
  const out: { text: string; hit: boolean }[] = [];
  const re = new RegExp(`${HIT_OPEN}([^${HIT_CLOSE}]*)${HIT_CLOSE}`, 'g');
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push({ text: s.slice(last, m.index), hit: false });
    out.push({ text: m[1]!, hit: true });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ text: s.slice(last), hit: false });
  return out;
}

/** Highlight query words in a line by hand (for the search fallback without FTS5). */
export function markTerms(text: string, terms: string[]): string {
  if (!terms.length) return text;
  const esc = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return text.replace(new RegExp(`(${esc.join('|')})`, 'giu'), `${HIT_OPEN}$1${HIT_CLOSE}`);
}

export type LyricHit = { key: string; title: string; artists: string[]; idx: number; ms: number | null; text: string; snippet: string };

export const savedLineInput = z.object({
  key: z.string().trim().min(1).max(300),
  title: z.string().trim().min(1).max(300),
  artists: z.array(z.string().max(200)).max(20),
  idx: z.number().int().min(0).max(100_000),
  ms: z.number().int().min(0).max(6 * 3600_000).nullable(),
  text: z.string().trim().min(1).max(1000),
  art: z.string().url().max(2000).optional(),
  note: z.string().max(500).optional(),
});
export type SavedLineInput = z.infer<typeof savedLineInput>;
export type SavedLine = SavedLineInput & { id: string; savedAt: number };
