'use client';

import clsx from 'clsx';
import { PenTool, Smile } from 'lucide-react';
import { EMOTIONS, EMOTION_DEFS, type ColorMode, type EmotionId } from '@/lib/kinetic/emotion';
import { useUi } from '@/lib/ui-store';

const MODES: [ColorMode, string, string][] = [
  ['blend', 'Blend', 'Album colors, tinted by the mood of each line'],
  ['album', 'Album', 'Only the colors of the cover art'],
  ['emotion', 'Mood', 'Only colors that match the detected feeling'],
];

/** Color source, mood override, and the emoji / vector-doodle toggles. */
export function LookControls({ compact = false, className }: { compact?: boolean; className?: string }) {
  const { colorMode, emojis, doodles, mood, artwork, quality, set } = useUi();
  const pill = (on: boolean) => clsx('inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition', on ? 'border-signal bg-signal text-white' : 'border-ink-600 text-ink-200 hover:border-ink-400');
  return (
    <div className={clsx('flex flex-wrap items-center gap-2', className)} role="group" aria-label="Look">
      <div className="flex gap-1 rounded-full bg-ink-800/80 p-1" role="radiogroup" aria-label="Color source">
        {MODES.map(([id, label, hint]) => (
          <button key={id} role="radio" aria-checked={colorMode === id} title={hint} onClick={() => set({ colorMode: id })} className={clsx('rounded-full px-3 py-1 text-sm font-semibold transition', colorMode === id ? 'bg-bone text-ink-950' : 'text-ink-300 hover:text-bone')}>
            {label}
          </button>
        ))}
      </div>
      <button aria-pressed={emojis} onClick={() => set({ emojis: !emojis })} className={pill(emojis)} title="Emoji pop up next to matching words">
        <Smile size={15} /> {!compact && 'Emoji'}
      </button>
      <button aria-pressed={doodles} onClick={() => set({ doodles: !doodles })} className={pill(doodles)} title="Animated vector doodles">
        <PenTool size={15} /> {!compact && 'Doodles'}
      </button>
      <label className="sr-only" htmlFor="art-pick">
        Album art
      </label>
      <select id="art-pick" value={artwork} onChange={(e) => set({ artwork: e.target.value as 'off' | 'background' })} className="h-9 rounded-full border border-ink-600 bg-ink-900/80 px-3 text-sm" title="How much the album cover is shown">
        <option value="background">Art: soft background</option>
        <option value="off">Art: off</option>
      </select>
      <label className="sr-only" htmlFor="quality-pick">
        Performance
      </label>
      <select id="quality-pick" value={quality} onChange={(e) => set({ quality: e.target.value as 'auto' | 'high' | 'medium' | 'low' })} className="h-9 rounded-full border border-ink-600 bg-ink-900/80 px-3 text-sm" title="Auto lowers effects when your machine can't keep up">
        <option value="auto">Performance: auto</option>
        <option value="high">Performance: high</option>
        <option value="medium">Performance: balanced</option>
        <option value="low">Performance: light</option>
      </select>
      <label className="sr-only" htmlFor="mood-pick">
        Mood
      </label>
      <select id="mood-pick" value={mood} onChange={(e) => set({ mood: e.target.value as EmotionId | 'auto' })} className="h-9 rounded-full border border-ink-600 bg-ink-900/80 px-3 text-sm" title="Mood is detected from lyrics and tempo. Pick one to override.">
        <option value="auto">Mood: auto-detect</option>
        {EMOTIONS.map((e) => (
          <option key={e} value={e}>
            {EMOTION_DEFS[e].emoji} {EMOTION_DEFS[e].label}
          </option>
        ))}
      </select>
    </div>
  );
}
