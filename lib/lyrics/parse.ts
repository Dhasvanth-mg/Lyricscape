import type { LyricDocument, TimedLine, TimedWord } from '../types';

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

  raw.sort((a, b) => a.startMs - b.startMs);

  const lines: TimedLine[] = [];
  for (let i = 0; i < raw.length; i++) {
    const cur = raw[i]!;
    const line = buildLine(cur.text, cur.startMs, raw[i + 1]?.startMs);
    if (line.words.length > 0) lines.push(line);
  }

  return { source: enhanced ? 'enhanced-lrc' : 'lrc', licenseSource, lines: fixOverlaps(lines), meta };
}

function buildLine(text: string, lineStart: number, nextLineStart: number | undefined): TimedLine {
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

    // A trailing bare tag marks the explicit end of the line.
    const trailing = new RegExp(WORD_TAG_SRC + String.raw`\s*$`).exec(text);
    const explicitEnd = trailing ? parseTimestamp(trailing[1]!) : undefined;

    const words: TimedWord[] = [];
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i]!;
      const tokens = p.text.trim().split(/\s+/).filter(Boolean);
      const segStart = p.startMs;
      const segEnd = parts[i + 1]?.startMs ?? explicitEnd ?? nextLineStart ?? segStart + 400 * tokens.length;
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
    return { startMs: lineStart, endMs: Math.max(end, lineStart), words };
  }

  const tokens = text.trim().split(/\s+/).filter(Boolean);
  const maxSpan = Math.max(1200, tokens.length * 650);
  const end = Math.min(nextLineStart ?? lineStart + maxSpan, lineStart + maxSpan);
  return distributeWords(tokens, lineStart, end);
}

/** Spread tokens across [start,end] proportionally to length (heuristic alignment for line-level LRC). */
export function distributeWords(tokens: string[], startMs: number, endMs: number): TimedLine {
  const weights = tokens.map((t) => 0.6 + t.replace(/[^\p{L}\p{N}]/gu, '').length);
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
    if (prev && prev.endMs > startMs) prev.endMs = startMs;
    out.push({ startMs, endMs, words });
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
      const line = buildLine(normalized, startMs, endMs);
      line.endMs = endMs;
      if (line.words.length) lines.push(line);
    } else {
      const tokens = stripped.trim().split(/\s+/).filter(Boolean);
      if (tokens.length) lines.push(distributeWords(tokens, startMs, endMs));
    }
  }
  return { source: 'vtt', licenseSource, lines: fixOverlaps(lines) };
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
    };
  });
  return { source: 'json', licenseSource, lines: fixOverlaps(lines) };
}

// ---------------------------------------------------------------------------
// Plain text -> naive, evenly distributed timing (needs manual adjust in editor)
// ---------------------------------------------------------------------------

export function fromPlainText(text: string, durationMs: number, licenseSource = 'user-supplied'): LyricDocument {
  const rows = text
    .split(/\r?\n/)
    .map((r) => r.trim())
    .filter(Boolean);
  const lead = Math.min(4000, durationMs * 0.05);
  const span = Math.max(1000, durationMs - lead - 2000) / Math.max(1, rows.length);
  const lines = rows.map((r, i) => {
    const start = lead + i * span;
    return distributeWords(r.split(/\s+/), Math.round(start), Math.round(start + span * 0.9));
  });
  return { source: 'plain', licenseSource, lines };
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

export function toEnhancedLrc(doc: LyricDocument, meta: Record<string, string> = {}): string {
  const header = Object.entries({ ...doc.meta, ...meta }).map(([k, v]) => `[${k}:${v}]`);
  const body = doc.lines.map(
    (l) =>
      `[${formatTimestamp(l.startMs)}] ${l.words.map((w) => `<${formatTimestamp(w.startMs)}>${w.text}`).join(' ')} <${formatTimestamp(l.endMs)}>`,
  );
  return [...header, ...body].join('\n') + '\n';
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
