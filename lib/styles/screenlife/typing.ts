// Screenlife typing (SCR-MOT-TYP-001..010, SCR-MOT-TPO-001..006; design-spec section 3, motion.md). A line is typed by a person:
// a list of keystrokes, each the whole field text after the key, computed once per line from the line's times and a seeded
// profile. The field at time t is the last keystroke at or before t, so playback, seeking and export see the same text and
// nothing is accumulated per frame (AGENTS.md rule 3). Cue times are only read (rule 2).
//
//   authored word times: each word is typed so its last grapheme lands on the word's end time; the caret waits between words;
//                        a typo is allowed only inside a Latin word longer than four letters and is fixed before its end time
//   line timing:         typing is spread across the line with the profile's bursts and pauses, finishing at 85% of the line;
//                        the rest is the send act
//   estimated:           treated as line timing (no typo, selection or emphasis is timed to an estimated word)
//   dense lines:         dictation chunks (words in groups) above 14 graphemes a second (10 for Tamil); paste above 24
//   complex scripts:     typed by grapheme cluster (never by code point), never with typos

import type { WordCue } from '../../kinetic/types';
import { h01 } from '../scene/planner';
import { lineTiming, type LineTiming } from '../timing';
import type { Script } from '../sketch-cards/letter';

export const PROFILE_IDS = [
  'SCR-MOT-TYP-001', // confident: long bursts, few pauses
  'SCR-MOT-TYP-002', // hesitant: short bursts, long pauses before key words, one retype per section
  'SCR-MOT-TYP-003', // tired late-night: slow, an occasional doubled letter fixed
  'SCR-MOT-TYP-004', // angry: fast bursts
  'SCR-MOT-TYP-005', // autocorrecting: one autocorrect per line
  'SCR-MOT-TYP-006', // deliberate one-finger: even slow pace
  'SCR-MOT-TYP-007', // dictation chunks (dense lines)
  'SCR-MOT-TYP-008', // paste (rap density)
  'SCR-MOT-TYP-009', // retype after delete (second appearance of a hook)
  'SCR-MOT-TYP-010', // transcript reveal (voice memo): no typing, words appear
] as const;
export type ProfileId = (typeof PROFILE_IDS)[number];
export const TYPO_IDS = ['SCR-MOT-TPO-001', 'SCR-MOT-TPO-002', 'SCR-MOT-TPO-003', 'SCR-MOT-TPO-004', 'SCR-MOT-TPO-005', 'SCR-MOT-TPO-006'] as const;
export type TypoId = (typeof TYPO_IDS)[number];

type Rhythm = { burst: [number, number]; pause: [number, number]; keyPause: number; even: boolean; typo: number };
const RHYTHM: Partial<Record<ProfileId, Rhythm>> = {
  'SCR-MOT-TYP-001': { burst: [6, 9], pause: [120, 220], keyPause: 0, even: false, typo: 0.25 },
  'SCR-MOT-TYP-002': { burst: [2, 4], pause: [260, 600], keyPause: 1, even: false, typo: 0.35 },
  'SCR-MOT-TYP-003': { burst: [3, 6], pause: [220, 480], keyPause: 0.4, even: false, typo: 0.5 },
  'SCR-MOT-TYP-004': { burst: [5, 8], pause: [120, 200], keyPause: 0, even: false, typo: 0.3 },
  'SCR-MOT-TYP-005': { burst: [4, 7], pause: [150, 300], keyPause: 0.2, even: false, typo: 1 },
  'SCR-MOT-TYP-006': { burst: [99, 99], pause: [0, 0], keyPause: 0, even: true, typo: 0 },
  'SCR-MOT-TYP-009': { burst: [5, 8], pause: [140, 260], keyPause: 0, even: false, typo: 0 },
};

export type Key = { at: number; text: string };
export type TypingMode = 'type' | 'dictation' | 'paste' | 'whole' | 'transcript';
export type TypingPlan = {
  keys: Key[];
  /** the full line text as it ends up */
  text: string;
  /** when the last keystroke lands, and when the line is sent (abs ms) */
  doneAt: number;
  sendAt: number;
  mode: TypingMode;
  profile: ProfileId;
  typo: TypoId | null;
  /** the caret appears 250 ms before the first key (focus) */
  focusAt: number;
  timing: LineTiming;
};

const seg = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
export function graphemes(s: string): string[] {
  if (!seg) return Array.from(s);
  return Array.from(seg.segment(s), (x) => x.segment);
}

// neighbouring keys on a common Latin layout (for the adjacent-key typo); only letters a-z
const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
function neighbour(ch: string, pick: number): string {
  const lower = ch.toLowerCase();
  for (let r = 0; r < ROWS.length; r++) {
    const i = ROWS[r]!.indexOf(lower);
    if (i < 0) continue;
    const opts = [ROWS[r]![i - 1], ROWS[r]![i + 1]].filter((x): x is string => !!x);
    const n = opts[pick % opts.length] ?? lower;
    return ch === lower ? n : n.toUpperCase();
  }
  return ch;
}

const letterish = (w: string) => /^[A-Za-z]+$/.test(w);

export type LineInput = {
  words: Pick<WordCue, 'text' | 'startMs' | 'endMs' | 'timing'>[];
  startMs: number;
  /** when the line leaves the field (the next line's start, or a little after its end) */
  untilMs: number;
  script: Script;
  profile: ProfileId;
  reduced: boolean;
  seed: number;
  /** allow a typo on this line (the planner caps them) */
  allowTypo: boolean;
};

/**
 * The keystrokes for one line. Pure; the result's keys are ordered by time and the last one is always the full line text.
 */
export function typeLine(inp: LineInput): TypingPlan {
  const { words, startMs, untilMs, script, reduced, seed } = inp;
  const timing = lineTiming({ words: words as WordCue[] });
  const text = words.map((w) => w.text).join(' ');
  const gs = graphemes(text);
  const dur = Math.max(400, untilMs - startMs);
  const complex = script !== 'latin';
  const keys: Key[] = [];
  let profile = inp.profile;
  let typo: TypoId | null = null;
  const focusAt = startMs - 250;
  const finish = (mode: TypingMode, doneAt: number): TypingPlan => {
    if (!keys.length || keys[keys.length - 1]!.text !== text) keys.push({ at: doneAt, text });
    const last = keys[keys.length - 1]!.at;
    const sendAt = Math.min(untilMs - 120, Math.max(last + 180, timing === 'authored' ? last + 250 : startMs + dur * 0.85));
    return { keys, text, doneAt: last, sendAt: Math.max(last, sendAt), mode, profile, typo, focusAt, timing };
  };

  // transcript reveal (voice memo): whole words appear on their cues, or evenly through the first 60% of the line
  if (profile === 'SCR-MOT-TYP-010') {
    let acc = '';
    words.forEach((w, i) => {
      acc = i ? `${acc} ${w.text}` : w.text;
      const at = timing === 'authored' ? w.startMs : startMs + (dur * 0.6 * i) / Math.max(1, words.length);
      keys.push({ at, text: acc });
    });
    return finish('transcript', keys[keys.length - 1]?.at ?? startMs);
  }

  // reduced motion: whole words on word cues, or the whole line on line cues
  if (reduced) {
    if (timing === 'authored') {
      let acc = '';
      words.forEach((w, i) => {
        acc = i ? `${acc} ${w.text}` : w.text;
        keys.push({ at: w.startMs, text: acc });
      });
      return finish('whole', keys[keys.length - 1]!.at);
    }
    keys.push({ at: startMs, text });
    return finish('whole', startMs);
  }

  // density decides the mode; the profile only shapes rhythm inside the time the line has
  const window = timing === 'authored' ? Math.max(200, (words[words.length - 1]?.endMs ?? startMs) - startMs) : dur * 0.85;
  const rate = gs.length / (window / 1000);
  const chunkAt = script === 'tamil' ? 10 : 14;
  if (rate > 24 || profile === 'SCR-MOT-TYP-008') {
    profile = 'SCR-MOT-TYP-008';
    keys.push({ at: startMs, text });
    return finish('paste', startMs);
  }
  if (rate > chunkAt || profile === 'SCR-MOT-TYP-007') {
    profile = 'SCR-MOT-TYP-007';
    // words in groups of 2-3, each group on its first word's time (authored) or evenly
    let acc = '';
    let i = 0;
    let g = 0;
    while (i < words.length) {
      const n = 2 + (h01(seed, 'chunk', g) < 0.5 ? 0 : 1);
      const at = timing === 'authored' ? words[i]!.startMs : startMs + (window * i) / words.length;
      for (let k = 0; k < n && i < words.length; k++, i++) acc = acc ? `${acc} ${words[i]!.text}` : words[i]!.text;
      keys.push({ at, text: acc });
      g++;
    }
    return finish('dictation', keys[keys.length - 1]!.at);
  }

  const rh = RHYTHM[profile] ?? RHYTHM['SCR-MOT-TYP-001']!;

  // a typo: one per line at most, Latin only, inside a word longer than four letters, and only for profiles that make them
  let typoWord = -1;
  if (inp.allowTypo && !complex && rh.typo > 0 && h01(seed, 'typo?') < rh.typo) {
    const cands = words.map((w, i) => ({ i, w: w.text })).filter((x) => letterish(x.w) && x.w.length > 4);
    if (cands.length) {
      typoWord = cands[Math.floor(h01(seed, 'typoWord') * cands.length)]!.i;
      const kinds: TypoId[] = profile === 'SCR-MOT-TYP-003' ? ['SCR-MOT-TPO-002'] : profile === 'SCR-MOT-TYP-005' ? ['SCR-MOT-TPO-005', 'SCR-MOT-TPO-001'] : ['SCR-MOT-TPO-001', 'SCR-MOT-TPO-002', 'SCR-MOT-TPO-003', 'SCR-MOT-TPO-006'];
      typo = kinds[Math.floor(h01(seed, 'typoKind') * kinds.length)]!;
    }
  }

  // build the keystroke actions word by word: each action is the text after it and a weight in "key units"
  type Act = { text: string; w: number; word: number };
  const actsFor = (wi: number, prefix: string): Act[] => {
    const wg = graphemes(words[wi]!.text);
    const acts: Act[] = [];
    let cur = prefix;
    const typoAt = wi === typoWord ? Math.max(1, Math.min(wg.length - 3, 1 + Math.floor(h01(seed, 'typoPos') * (wg.length - 3)))) : -1;
    for (let k = 0; k < wg.length; k++) {
      if (k === typoAt && typo) {
        const right = wg.slice(k, k + 2).join('');
        let wrong = '';
        if (typo === 'SCR-MOT-TPO-001') wrong = neighbour(wg[k]!, Math.floor(h01(seed, 'nb') * 2));
        else if (typo === 'SCR-MOT-TPO-002') wrong = wg[k]! + wg[k]!;
        else if (typo === 'SCR-MOT-TPO-003') wrong = (wg[k + 1] ?? '') + wg[k]!;
        else if (typo === 'SCR-MOT-TPO-006') wrong = wg[k]!.toUpperCase() === wg[k]! ? wg[k]!.toLowerCase() : wg[k]!.toUpperCase();
        else wrong = neighbour(wg[k]!, 1);
        // type the mistake, notice, backspace to the mistake, retype it right
        const wrongG = graphemes(wrong);
        let w = cur;
        for (const g of wrongG) acts.push({ text: (w += g), w: 1, word: wi });
        acts.push({ text: w, w: 2.5, word: wi }); // the notice
        for (let b = 0; b < wrongG.length; b++) acts.push({ text: (w = graphemes(w).slice(0, -1).join('')), w: 0.6, word: wi });
        for (const g of graphemes(right)) acts.push({ text: (w += g), w: 1, word: wi });
        cur = w;
        k += graphemes(right).length - 1;
        continue;
      }
      cur += wg[k]!;
      acts.push({ text: cur, w: 1, word: wi });
    }
    return acts;
  };

  if (timing === 'authored') {
    // each word ends on its end time; the caret waits between words; the space comes with the next word
    let prev = startMs;
    let text0 = '';
    words.forEach((w, wi) => {
      const prefix = wi ? `${text0} ` : '';
      const acts = actsFor(wi, prefix);
      const units = acts.reduce((a, x) => a + x.w, 0);
      const end = Math.max(w.endMs, prev + 40);
      const from = Math.max(prev, w.startMs - 80);
      const per = Math.max(20, Math.min(160, (end - from) / units));
      let at = Math.max(prev, end - units * per);
      for (const a of acts) {
        at += a.w * per;
        keys.push({ at: Math.min(at, end), text: a.text });
      }
      prev = end;
      text0 = keys[keys.length - 1]!.text;
    });
    return finish('type', prev);
  }

  // line timing (and estimated): bursts and pauses spread over 85% of the line
  const acts: Act[] = [];
  let pre = '';
  words.forEach((_, wi) => {
    const a = actsFor(wi, wi ? `${pre} ` : '');
    acts.push(...a);
    pre = a[a.length - 1]?.text ?? pre;
  });
  // pauses between bursts (and before the longest word, for hesitant profiles)
  const longest = words.reduce((b, w, i) => (w.text.length > words[b]!.text.length ? i : b), 0);
  const gaps: number[] = acts.map(() => 0);
  let run = 0;
  let burst = rh.burst[0] + Math.floor(h01(seed, 'b', 0) * (rh.burst[1] - rh.burst[0] + 1));
  let nb = 0;
  for (let i = 0; i < acts.length; i++) {
    run++;
    if (!rh.even && run >= burst && i < acts.length - 1) {
      gaps[i] = rh.pause[0] + h01(seed, 'p', i) * (rh.pause[1] - rh.pause[0]);
      run = 0;
      nb++;
      burst = rh.burst[0] + Math.floor(h01(seed, 'b', nb) * (rh.burst[1] - rh.burst[0] + 1));
    }
    if (rh.keyPause && i + 1 < acts.length && acts[i + 1]!.word === longest && acts[i]!.word !== longest) gaps[i] = gaps[i]! + 380 * rh.keyPause;
  }
  const units = acts.reduce((a, x) => a + x.w, 0);
  let pauseMs = gaps.reduce((a, b) => a + b, 0);
  // per key between 1/14 s and 1/4 s; pauses shrink when the line is short
  const budget = window - 60;
  let per = Math.max(1000 / 14, Math.min(250, (budget - pauseMs) / units));
  if (units * per + pauseMs > budget) {
    const k = Math.max(0, (budget - units * per) / Math.max(1, pauseMs));
    for (let i = 0; i < gaps.length; i++) gaps[i] = gaps[i]! * k;
    pauseMs *= k;
    per = Math.max(15, Math.min(per, budget / units));
  }
  // a deliberate profile types at an even slow pace and so may finish before 85%; the others start at the line
  let at = startMs + 60;
  for (let i = 0; i < acts.length; i++) {
    at += acts[i]!.w * per;
    keys.push({ at, text: acts[i]!.text });
    at += gaps[i]!;
  }
  return finish('type', keys[keys.length - 1]?.at ?? startMs);
}

/** the field text at `t` (empty before the first key) */
export function fieldAt(plan: TypingPlan, t: number): string {
  const k = plan.keys;
  let lo = 0;
  let hi = k.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (k[mid]!.at <= t) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found < 0 ? '' : k[found]!.text;
}

/** true while a key was pressed in the last 400 ms (the caret stays solid while typing, and blinks when idle) */
export function typingNow(plan: TypingPlan, t: number): boolean {
  for (const k of plan.keys) if (k.at <= t && t - k.at < 400) return true;
  return false;
}
