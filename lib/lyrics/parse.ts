import type { EndSource, LyricDocument, TimedLine, TimedWord, WordTiming } from '../types';
import { cleanLyricRows, expectedSungMs, sungShareOfGap, tokenize, wordWeight } from './words';

// ---------------------------------------------------------------------------
// Time helpers
// ---------------------------------------------------------------------------

/** "mm:ss.xx" | "mm:ss" | "hh:mm:ss.xxx" -> ms. Returns NaN if invalid. */
export function parseTimestamp(raw: string): number {
  const s = raw.trim().replace(',', '.');
  const m = /^(?:(\d+):)?(\d{1,3}):(\d{1,2})(?:\.(\d{1,3}))?$/.exec(s);
  if (!m) return NaN;
  const [, h, min, sec, frac] = m;
  const hours = h ? Number(h) : 0;
  const ms = frac ? Number(frac.padEnd(3, '0')) : 0;
  return ((hours * 60 + Number(min)) * 60 + Number(sec)) * 1000 + ms;
}

export function formatTimestamp(ms: number, digits: 2 | 3 = 2): string {
  const unit = digits === 2 ? 10 : 1;
  const total = Math.max(0, Math.round(ms / unit));
  const perSecond = 1000 / unit;
  const perMinute = 60 * perSecond;
  const m = Math.floor(total / perMinute);
  const rem = total % perMinute;
  const sec = Math.floor(rem / perSecond);
  const frac = rem % perSecond;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(frac).padStart(digits, '0')}`;
}

// ---------------------------------------------------------------------------
// Line ends
//
// A line's end is only KNOWN when the file says so (a blank cue, a trailing word tag, a VTT cue end). Otherwise the
// next cue is the best upper bound, and if that is far away (an instrumental break, or the song ends) the end is a
// guess. Every line records which of the three it is, so nothing downstream mistakes a guess for a measurement.
// ---------------------------------------------------------------------------

/**
 * When nothing says where a line really ends, it stays up until the next cue if that is within this long (slow
 * ballads hold lines for many seconds, and a line that vanishes while someone is still singing is the worse mistake).
 * Beyond it the cue is treated as an instrumental break: the line ends here, labelled a guess.
 */
export const MIN_GUESSED_SPAN_MS = 10_000;

function resolveEnd(tokens: string[], start: number, explicitEnd: number | undefined, nextStart: number | undefined): { endMs: number; endSource: EndSource } {
  if (explicitEnd !== undefined && explicitEnd >= start) return { endMs: explicitEnd, endSource: 'explicit' };
  const cap = Math.max(MIN_GUESSED_SPAN_MS, Math.round(expectedSungMs(tokens) * 2.5));
  if (nextStart !== undefined && nextStart - start <= cap) return { endMs: Math.max(start, nextStart), endSource: 'next-line' };
  return { endMs: start + cap, endSource: 'estimated' };
}

// ---------------------------------------------------------------------------
// LRC / enhanced LRC
// ---------------------------------------------------------------------------

const TS = String.raw`\d{1,3}:\d{1,2}(?:[.,]\d{1,3})?`;
const LINE_TAG = new RegExp(String.raw`^\s*\[(${TS})\]`);
const META_TAG = /^\s*\[([a-zA-Z]+):([^\]]*)\]\s*$/;
const WORD_TAG_SRC = String.raw`<(${TS})>`;
const HAS_WORD_TAG = new RegExp(WORD_TAG_SRC);

export function parseLrc(input: string, licenseSource = 'user-supplied'): LyricDocument {
  const meta: Record<string, string> = {};
  const raw: { startMs: number; text: string }[] = [];
  let enhanced = false;

  for (const rawLine of input.replace(/\r/g, '').split('\n')) {
    if (!rawLine.trim()) continue;
    const metaMatch = META_TAG.exec(rawLine);
    if (metaMatch) {
      meta[metaMatch[1]!.toLowerCase()] = metaMatch[2]!.trim();
      continue;
    }
    // Support multiple leading timestamps: [00:10.00][00:50.00] text
    let rest = rawLine;
    const stamps: number[] = [];
    for (;;) {
      const m = LINE_TAG.exec(rest);
      if (!m) break;
      const t = parseTimestamp(m[1]!);
      if (!Number.isNaN(t)) stamps.push(t);
      rest = rest.slice(m[0].length);
    }
    if (stamps.length === 0) continue;
    if (HAS_WORD_TAG.test(rest)) enhanced = true;
    for (const t of stamps) raw.push({ startMs: t, text: rest });
  }

  // [offset:+500] = the lyrics should appear 500 ms sooner (LRC convention). Applied once, here, and recorded so it is
  // never applied again (it is dropped from meta, and serialization writes the shifted timestamps).
  const offsetMs = Number.parseInt(meta.offset ?? '', 10);
  const shift = Number.isFinite(offsetMs) && offsetMs !== 0 ? -offsetMs : 0;
  if (shift) for (const r of raw) r.startMs = Math.max(0, r.startMs + shift);
  delete meta.offset;
  const shiftText = (text: string) =>
    shift ? text.replace(new RegExp(WORD_TAG_SRC, 'g'), (_m, t: string) => `<${formatTimestamp(Math.max(0, parseTimestamp(t) + shift), 3)}>`) : text;

  raw.sort((a, b) => a.startMs - b.startMs);

  const lines: TimedLine[] = [];
  for (let i = 0; i < raw.length; i++) {
    const cur = raw[i]!;
    const next = raw[i + 1];
    const blankNext = next !== undefined && next.text.trim() === '' ? next.startMs : undefined;
    if (cur.text.trim() === '') continue; // a blank cue only ends the line before it (handled via blankNext)
    // the next cue that carries text, for the "best upper bound"
    let nextText: number | undefined;
    for (let j = i + 1; j < raw.length; j++) if (raw[j]!.text.trim() !== '') {
      nextText = raw[j]!.startMs;
      break;
    }
    const line = buildLine(shiftText(cur.text), cur.startMs, blankNext, nextText);
    if (line.words.length > 0) lines.push(line);
  }

  return {
    source: enhanced ? 'enhanced-lrc' : 'lrc',
    licenseSource,
    lines: fixOverlaps(lines),
    meta,
    timing: { source: enhanced ? 'enhanced-lrc' : 'lrc', ...(shift ? { offsetAppliedMs: -shift } : {}) },
  };
}

function buildLine(text: string, lineStart: number, blankEnd: number | undefined, nextLineStart: number | undefined): TimedLine {
  if (HAS_WORD_TAG.test(text)) {
    const parts: { startMs: number; text: string }[] = [];
    let lastIdx = 0;
    let lastTime = lineStart;
    const re = new RegExp(WORD_TAG_SRC, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const seg = text.slice(lastIdx, m.index);
      if (seg.trim()) parts.push({ startMs: lastTime, text: seg });
      lastTime = parseTimestamp(m[1]!);
      lastIdx = m.index + m[0].length;
    }
    const tail = text.slice(lastIdx);
    if (tail.trim()) parts.push({ startMs: lastTime, text: tail });

    // A trailing bare tag marks the explicit end of the line; so does a blank cue after it.
    const trailing = new RegExp(WORD_TAG_SRC + String.raw`\s*$`).exec(text);
    const explicitEnd = trailing ? parseTimestamp(trailing[1]!) : blankEnd;

    const words: TimedWord[] = [];
    let allSingle = true;
    const allTokens = parts.flatMap((p) => tokenize(p.text));
    const lineEnd = resolveEnd(allTokens, lineStart, explicitEnd, nextLineStart);
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i]!;
      const tokens = tokenize(p.text);
      if (tokens.length > 1) allSingle = false; // several words under one stamp: the inner ones are interpolated
      const segStart = p.startMs;
      const segEnd = parts[i + 1]?.startMs ?? lineEnd.endMs;
      tokens.forEach((tok, k) => {
        const span = (segEnd - segStart) / tokens.length;
        words.push({
          text: tok,
          startMs: Math.round(segStart + span * k),
          endMs: Math.round(segStart + span * (k + 1)),
        });
      });
    }
    const end = words.length ? words[words.length - 1]!.endMs : lineStart;
    return {
      startMs: lineStart,
      endMs: Math.max(end, lineStart),
      words,
      wordTiming: allSingle ? 'authored' : 'estimated',
      endSource: lineEnd.endSource,
    };
  }

  const tokens = tokenize(text);
  const { endMs, endSource } = resolveEnd(tokens, lineStart, blankEnd, nextLineStart);
  const line = distributeWords(tokens, lineStart, estimatedSpreadEnd(tokens.length, lineStart, endMs, endSource, nextLineStart));
  return { ...line, endMs, wordTiming: 'estimated', endSource };
}

/**
 * Spread tokens across [start,end] proportionally to their syllables. This is a GUESS used only to give a line-level
 * line something to animate when the user opts in; it is always labelled `estimated` by the callers.
 */
/**
 * How far into a line its words are spread when only the line start is known.
 *  - the file says where the line ends (blank cue): spread to there;
 *  - a next line exists: the part of the gap that is actually sung at this line's pace (sungShareOfGap), bounded by 1.5 s per word;
 *  - last line: about 450 ms per word (the measured median), 1.2 s at least.
 * Never beyond the line's display end. The previous fixed 650 ms-per-word cap ran late on normal-pace lines (last word a median
 * 528 ms late) and early on slow ones; see docs/lyric-sync-motion.md.
 */
export function estimatedSpreadEnd(tokenCount: number, startMs: number, endMs: number, endSource?: EndSource, nextStartMs?: number): number {
  if (endSource === 'explicit') return endMs;
  const gap = nextStartMs !== undefined ? nextStartMs - startMs : undefined;
  const span =
    gap !== undefined && gap > 0 ? Math.min(gap * sungShareOfGap(gap / Math.max(1, tokenCount)), Math.max(2500, tokenCount * 1500)) : Math.max(1200, tokenCount * 450);
  return Math.min(endMs, startMs + span);
}

export function distributeWords(tokens: string[], startMs: number, endMs: number): TimedLine {
  const weights = tokens.map(wordWeight);
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  let cursor = startMs;
  const words = tokens.map((text, i) => {
    const dur = ((endMs - startMs) * weights[i]!) / sum;
    const w: TimedWord = { text, startMs: Math.round(cursor), endMs: Math.round(cursor + dur) };
    cursor += dur;
    return w;
  });
  return { startMs, endMs, words };
}

/** Guarantee monotonic, non-overlapping lines and sane words without destroying authored timing. */
export function fixOverlaps(lines: TimedLine[]): TimedLine[] {
  const out: TimedLine[] = [];
  for (const l of lines) {
    const prev = out[out.length - 1];
    const startMs = prev ? Math.max(l.startMs, prev.startMs) : l.startMs;
    const words = l.words.map((w) => ({ ...w, endMs: Math.max(w.endMs, w.startMs) }));
    const endMs = Math.max(l.endMs, words.length ? words[words.length - 1]!.endMs : startMs);
    if (prev && prev.endMs > startMs) {
      prev.endMs = startMs;
      if (prev.endSource === 'explicit') prev.endSource = 'next-line'; // an overlap means the explicit end lost to the next line
      const last = prev.words[prev.words.length - 1];
      if (last && last.endMs > startMs) last.endMs = Math.max(last.startMs, startMs);
    }
    out.push({ ...l, startMs, endMs, words });
  }
  return out;
}

// ---------------------------------------------------------------------------
// WebVTT (cue per line; optional inline <hh:mm:ss.mmm> word stamps)
// ---------------------------------------------------------------------------

export function parseVtt(input: string, licenseSource = 'user-supplied'): LyricDocument {
  const blocks = input.replace(/\r/g, '').split(/\n{2,}/);
  const lines: TimedLine[] = [];
  for (const block of blocks) {
    const rows = block.split('\n');
    const timingIdx = rows.findIndex((r) => r.includes('-->'));
    if (timingIdx < 0) continue;
    const [a, b] = rows[timingIdx]!.split('-->').map((s) => s.trim().split(/\s+/)[0]!);
    const startMs = parseTimestamp(a ?? '');
    const endMs = parseTimestamp(b ?? '');
    if (Number.isNaN(startMs) || Number.isNaN(endMs)) continue;
    const body = rows.slice(timingIdx + 1).join(' ');
    // keep timestamp tags, strip other markup (<c>, <v Name>, <i> ...)
    const stripped = body.replace(/<(?!\d)[^>]*>/g, '');
    if (/<\d{1,2}:\d{2}[:.]\d/.test(stripped)) {
      const normalized = stripped.replace(/<([\d:.,]+)>/g, (_m, t: string) => `<${formatTimestamp(parseTimestamp(t), 3)}>`);
      const line = buildLine(normalized, startMs, endMs, undefined);
      line.endMs = endMs;
      line.endSource = 'explicit';
      if (line.words.length) lines.push(line);
    } else {
      const tokens = tokenize(stripped);
      if (tokens.length) lines.push({ ...distributeWords(tokens, startMs, endMs), wordTiming: 'estimated', endSource: 'explicit' });
    }
  }
  return { source: 'vtt', licenseSource, lines: fixOverlaps(lines), timing: { source: 'vtt' } };
}

// ---------------------------------------------------------------------------
// JSON (structured word timestamps)
// ---------------------------------------------------------------------------

export function parseLyricJson(input: string, licenseSource = 'user-supplied'): LyricDocument {
  const data = JSON.parse(input) as unknown;
  const arr = Array.isArray(data) ? data : (data as { lines?: unknown }).lines;
  if (!Array.isArray(arr)) throw new Error('Lyric JSON must be an array of lines or { lines: [...] }');
  const lines: TimedLine[] = arr.map((l: Record<string, unknown>) => {
    const words = (l.words as Record<string, unknown>[] | undefined)?.map((w) => ({
      text: String(w.text),
      startMs: Number(w.startMs),
      endMs: Number(w.endMs),
    }));
    if (!words?.length) throw new Error('Every line needs words[] with text/startMs/endMs');
    return {
      startMs: Number(l.startMs ?? words[0]!.startMs),
      endMs: Number(l.endMs ?? words[words.length - 1]!.endMs),
      words,
      wordTiming: 'authored' as const,
    };
  });
  return { source: 'json', licenseSource, lines: fixOverlaps(lines), timing: { source: 'json' } };
}

// ---------------------------------------------------------------------------
// Plain text -> NO timing. The lines are spread over the song only so something can be shown; that is not sync.
// ---------------------------------------------------------------------------

export function fromPlainText(text: string, durationMs: number, licenseSource = 'user-supplied'): LyricDocument {
  const { rows, stanzaBefore } = cleanLyricRows(text);
  // Longer lines get more time and a stanza break gets a breath, instead of an even split per row.
  const toks = rows.map((r) => tokenize(r));
  const weights = toks.map((t, i) => t.reduce((a, w) => a + wordWeight(w), 0) + (stanzaBefore[i] ? 2 : 0));
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  const lead = Math.min(4000, durationMs * 0.05);
  const avail = Math.max(1000, durationMs - lead - 2000);
  let cursor = lead;
  const lines = rows.map((_, i) => {
    const span = (avail * weights[i]!) / total;
    const start = cursor + (stanzaBefore[i] ? (avail * 2) / total : 0);
    cursor += span;
    const end = Math.max(start + 400, cursor - span * 0.1);
    return { ...distributeWords(toks[i]!, Math.round(start), Math.round(end)), wordTiming: 'estimated' as const, endSource: 'estimated' as const };
  });
  return { source: 'plain', licenseSource, lines, timing: { source: 'plain' } };
}

// ---------------------------------------------------------------------------
// Detection + serialization
// ---------------------------------------------------------------------------

export function parseLyrics(input: string, opts: { durationMs?: number; licenseSource?: string } = {}): LyricDocument {
  const licenseSource = opts.licenseSource ?? 'user-supplied';
  const trimmed = input.replace(/^﻿/, '').trim();
  if (trimmed.startsWith('WEBVTT')) return parseVtt(trimmed, licenseSource);
  if (trimmed.startsWith('{') || trimmed.startsWith('[{')) return parseLyricJson(trimmed, licenseSource);
  if (LINE_TAG.test(trimmed) || /^\s*\[(ti|ar|al|by|offset|length):/im.test(trimmed) || new RegExp(String.raw`^\s*\[${TS}\]`, 'm').test(trimmed)) {
    const doc = parseLrc(trimmed, licenseSource);
    if (doc.lines.length) return doc;
  }
  return fromPlainText(trimmed, opts.durationMs ?? 180000, licenseSource);
}

/**
 * LRC text for storage. Word stamps are written ONLY for lines whose word times are authored: a line-synced line is
 * saved as a plain `[mm:ss.xx] text` line, so a guess can never be mistaken for a measurement on the next load.
 * An explicit line end that is not simply the next line's start is kept as a blank cue.
 */
export function toEnhancedLrc(doc: LyricDocument, meta: Record<string, string> = {}): string {
  // A plain (unsynced) document has only an even spread of made-up line times. With nothing hand-timed, save the text
  // itself, not those times.
  if ((doc.source === 'plain' || doc.timing?.source === 'plain') && !doc.lines.some((l) => (l.wordTiming ?? 'authored') === 'authored')) {
    return doc.lines.map((l) => l.words.map((w) => w.text).join(' ')).join('\n') + '\n';
  }
  const header = Object.entries({ ...doc.meta, ...meta })
    .filter(([k]) => k !== 'offset') // already applied to every timestamp
    .map(([k, v]) => `[${k}:${v}]`);
  const body: string[] = [];
  doc.lines.forEach((l, i) => {
    const wt: WordTiming = l.wordTiming ?? 'authored';
    if (wt === 'authored') {
      body.push(`[${formatTimestamp(l.startMs)}] ${l.words.map((w) => `<${formatTimestamp(w.startMs)}>${w.text}`).join(' ')} <${formatTimestamp(l.endMs)}>`);
    } else {
      body.push(`[${formatTimestamp(l.startMs)}] ${l.words.map((w) => w.text).join(' ')}`);
      const next = doc.lines[i + 1];
      if (l.endSource === 'explicit' && (!next || next.startMs - l.endMs > 20)) body.push(`[${formatTimestamp(l.endMs)}]`);
    }
  });
  return [...header, ...body].join('\n') + '\n';
}

export type TimingSummary = {
  /** are line starts real timestamps, or an even spread over the song? */
  lines: 'synced' | 'unsynced';
  words: 'authored' | 'mixed' | 'estimated';
  label: string;
};

/** One honest description of a document's timing, for the UI. */
export function timingSummary(doc: LyricDocument): TimingSummary {
  const unsynced = doc.timing?.source === 'plain' || doc.source === 'plain';
  const kinds = new Set(doc.lines.map((l) => l.wordTiming ?? 'authored'));
  const words: TimingSummary['words'] = kinds.size === 1 && kinds.has('authored') ? 'authored' : kinds.has('authored') ? 'mixed' : 'estimated';
  const label = unsynced ? 'Not synced (spread evenly)' : words === 'authored' ? 'Word-synced' : words === 'mixed' ? 'Line-synced, some words timed' : 'Line-synced';
  return { lines: unsynced ? 'unsynced' : 'synced', words, label };
}

export function validateDocument(doc: LyricDocument): string[] {
  const problems: string[] = [];
  doc.lines.forEach((l, i) => {
    if (l.endMs < l.startMs) problems.push(`Line ${i + 1}: ends before it starts`);
    l.words.forEach((w, j) => {
      if (w.endMs < w.startMs) problems.push(`Line ${i + 1} word ${j + 1}: ends before it starts`);
      const prev = l.words[j - 1];
      if (prev && w.startMs < prev.startMs) problems.push(`Line ${i + 1} word ${j + 1}: out of order`);
    });
    const prevLine = doc.lines[i - 1];
    if (prevLine && l.startMs < prevLine.startMs) problems.push(`Line ${i + 1}: out of order`);
  });
  return problems;
}
