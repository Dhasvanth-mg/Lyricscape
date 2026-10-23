'use client';

import { useEffect, useRef, useState } from 'react';
import { Gauge, Minus, Plus } from 'lucide-react';

const STEP = 50;

/**
 * Lyric timing offset: − / + buttons (50 ms per step, hold to repeat) around an editable value.
 * There is deliberately no range limit, so a badly delayed Bluetooth speaker or a sloppy LRC can be fixed.
 */
export function SyncStepper({ value, onChange }: { value: number; onChange: (ms: number) => void }) {
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    valueRef.current = value;
    onChangeRef.current = onChange;
  });
  const timers = useRef<{ delay?: ReturnType<typeof setTimeout> }>({});
  const [draft, setDraft] = useState<string | null>(null);

  const stop = () => {
    clearTimeout(timers.current.delay);
  };
  useEffect(() => stop, []);

  const bump = (dir: 1 | -1) => {
    const next = valueRef.current + dir * STEP;
    valueRef.current = next; // repeated presses can fire before React re-renders
    onChangeRef.current(next);
  };
  const down = (e: React.PointerEvent, dir: 1 | -1) => {
    if (e.button !== 0) return;
    stop();
    bump(dir);
    // hold to repeat, speeding up the longer it is held (the step stays 50 ms)
    let n = 0;
    const repeat = () => {
      bump(dir);
      n++;
      timers.current.delay = setTimeout(repeat, n < 8 ? 80 : n < 20 ? 45 : 22);
    };
    timers.current.delay = setTimeout(repeat, 380);
  };
  // keyboard users: Enter / Space fire click with detail 0
  const key = (e: React.MouseEvent, dir: 1 | -1) => {
    if (e.detail === 0) bump(dir);
  };

  const commit = () => {
    if (draft === null) return;
    const n = Math.round(Number(draft));
    if (Number.isFinite(n)) onChange(n);
    setDraft(null);
  };

  const btn = 'inline-flex h-7 w-7 items-center justify-center rounded-full border border-ink-600 bg-ink-850/80 text-ink-100 transition hover:border-ink-400 active:scale-90 select-none touch-none';
  return (
    <div className="flex items-center gap-1.5" role="group" aria-label="Lyric timing offset">
      <Gauge size={14} aria-hidden />
      <span className="whitespace-nowrap">Sync</span>
      <button type="button" className={btn} aria-label={`Lyrics earlier by ${STEP} ms (hold to repeat)`} title={`${STEP} ms earlier`} onPointerDown={(e) => down(e, -1)} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop} onClick={(e) => key(e, -1)}>
        <Minus size={14} />
      </button>
      <label className="sr-only" htmlFor="sync-offset">
        Offset in milliseconds
      </label>
      <input
        id="sync-offset"
        inputMode="numeric"
        value={draft ?? String(value)}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') setDraft(null);
        }}
        className="h-7 w-16 rounded-md border border-ink-600 bg-ink-900/80 px-1.5 text-center font-mono text-xs tabular-nums"
      />
      <span className="text-ink-400">ms</span>
      <button type="button" className={btn} aria-label={`Lyrics later by ${STEP} ms (hold to repeat)`} title={`${STEP} ms later`} onPointerDown={(e) => down(e, 1)} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop} onClick={(e) => key(e, 1)}>
        <Plus size={14} />
      </button>
      <button type="button" className="underline" onClick={() => onChange(0)}>
        reset
      </button>
    </div>
  );
}
