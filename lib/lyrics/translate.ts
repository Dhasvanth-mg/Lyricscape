'use client';

// A translation of each lyric line, shown as a second line under it. Two routes, in this order:
//  1. the browser's own on-device translator (Chrome 138+ Translator API): private, free, nothing leaves the computer;
//  2. when that is missing and the person allowed it, the AI gateway the operator configured (sends the lyric lines).
// Translations are kept on this device per song, lyric version and language, so a song is translated once.
// HONEST SCOPE: lyrics are translated line by line, so wordplay and lines that run into each other lose some sense.

import { kvGet, kvSet } from '../library/db';
import { detectLanguage } from './script';

type TranslatorApi = {
  availability(o: { sourceLanguage: string; targetLanguage: string }): Promise<'unavailable' | 'downloadable' | 'downloading' | 'available'>;
  create(o: { sourceLanguage: string; targetLanguage: string; monitor?: (m: EventTarget) => void }): Promise<{ translate(s: string): Promise<string>; destroy?: () => void }>;
};
const translatorApi = (): TranslatorApi | null => (typeof self !== 'undefined' ? ((self as unknown as { Translator?: TranslatorApi }).Translator ?? null) : null);

export const LANGUAGES: { code: string; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi' },
  { code: 'ta', label: 'Tamil' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'it', label: 'Italian' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'zh', label: 'Chinese' },
  { code: 'ar', label: 'Arabic' },
  { code: 'ru', label: 'Russian' },
];
export const languageLabel = (code: string) => LANGUAGES.find((l) => l.code === code)?.label ?? code;

/** The person's language, for the default target. */
export function defaultTarget(): string {
  const nav = typeof navigator !== 'undefined' ? navigator.language : 'en';
  const base = (nav || 'en').split('-')[0]!.toLowerCase();
  return LANGUAGES.some((l) => l.code === base) ? base : 'en';
}

/** The lyrics' language as a translator source code, or null when it cannot be named (romanised Hindi, unknown...). */
export function sourceCode(lines: string[]): string | null {
  const lang = detectLanguage(lines.slice(0, 60).join('\n'));
  if (lang.id === 'mixed') return lang.label.startsWith('Hindi') ? 'hi' : lang.label.startsWith('Tamil') ? 'ta' : null;
  if (lang.id === 'unknown' || lang.id === 'other' || lang.id === 'hi-latn' || lang.id === 'ta-latn') return null;
  return lang.id === 'ru' ? 'ru' : lang.id;
}

function hash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

export type TranslateResult = { status: 'done'; lines: string[]; via: 'browser' | 'ai' } | { status: 'same'; source: string } | { status: 'unsupported'; message: string } | { status: 'error'; message: string };

/** The browser translator can stall (no network for its model download, a broken install): never wait on it forever. */
function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${what} did not answer`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

const inflight = new Map<string, Promise<TranslateResult>>();

/** Translate lyric lines (one string per line). `allowAi` permits the gateway fallback. `onProgress` gets 0..1. */
export function translateLines(trackId: string, lines: string[], target: string, allowAi: boolean, onProgress?: (p: number) => void): Promise<TranslateResult> {
  const key = `tr:${trackId}:${hash(lines.join('\n'))}:${target}`;
  const hit = inflight.get(key);
  if (hit) return hit;
  const p = run(key, lines, target, allowAi, onProgress).finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

async function run(key: string, lines: string[], target: string, allowAi: boolean, onProgress?: (p: number) => void): Promise<TranslateResult> {
  const cached = await kvGet<{ lines: string[]; via: 'browser' | 'ai' }>(key);
  if (cached && cached.lines.length === lines.length) return { status: 'done', ...cached };
  const source = sourceCode(lines);
  if (source === target) return { status: 'same', source };
  const api = translatorApi();
  if (source && api) {
    try {
      const avail = await withTimeout(api.availability({ sourceLanguage: source, targetLanguage: target }), 8000, 'The browser translator');
      if (avail !== 'unavailable') {
        // a first use downloads the language model: allow time for that, but not forever
        const tr = await withTimeout(api.create({ sourceLanguage: source, targetLanguage: target }), avail === 'available' ? 15000 : 180000, 'The browser translator');
        const out: string[] = [];
        for (let i = 0; i < lines.length; i++) {
          const l = lines[i]!;
          out.push(l.trim() ? await withTimeout(tr.translate(l), 15000, 'The browser translator') : '');
          onProgress?.((i + 1) / lines.length);
        }
        tr.destroy?.();
        await kvSet(key, { lines: out, via: 'browser' });
        return { status: 'done', lines: out, via: 'browser' };
      }
    } catch {
      /* fall through to the gateway, if allowed */
    }
  }
  if (allowAi) {
    try {
      const res = await fetch('/api/lyrics/translate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lines, target, source }) });
      const j = (await res.json()) as { lines?: string[]; message?: string };
      if (res.ok && j.lines && j.lines.length === lines.length) {
        await kvSet(key, { lines: j.lines, via: 'ai' });
        return { status: 'done', lines: j.lines, via: 'ai' };
      }
      if (res.status !== 501) return { status: 'error', message: j.message ?? `Translation failed (${res.status}).` };
    } catch {
      return { status: 'error', message: 'Translation failed: the local server did not answer.' };
    }
  }
  if (!source) return { status: 'unsupported', message: 'Could not tell which language these lyrics are in, so they cannot be translated.' };
  return {
    status: 'unsupported',
    message: api
      ? `This browser's translator could not do ${languageLabel(source)} to ${languageLabel(target)} (no such language pair, or it did not answer).${allowAi ? '' : ' You can allow the AI gateway in Settings -> Lyrics.'}`
      : `This browser has no built-in translator (it needs Chrome 138 or newer).${allowAi ? ' The AI gateway is not configured either.' : ' You can allow the AI gateway in Settings -> Lyrics.'}`,
  };
}
