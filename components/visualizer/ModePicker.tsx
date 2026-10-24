'use client';

import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { Cpu, Gem, Zap } from 'lucide-react';
import { MODES, STAGE_MODES, type StageMode } from '@/lib/kinetic/modes';
import { turboSupported } from '@/lib/kinetic/stageRenderer';
import { TURBO_STYLES, TURBO_STYLE_IDS } from '@/lib/kinetic/turbo';
import { useUi } from '@/lib/ui-store';
import { GpuStatus } from '@/components/ui/GpuStatus';

const ICON: Record<StageMode, typeof Gem> = { clean: Gem, turbo: Zap };

/** Clean (the art-direction philosophy) or Turbo (the same language at full intensity, drawn on the GPU). */
export function ModePicker() {
  const mode = useUi((s) => s.mode);
  const set = useUi((s) => s.set);
  const turboStyle = useUi((s) => s.turboStyle);
  const [gl, setGl] = useState<boolean | null>(null);
  useEffect(() => setGl(turboSupported()), []);
  return (
    <section className="mb-5" aria-label="Stage mode" data-testid="mode-picker">
      <h3 className="mb-1 font-mono text-[10px] tracking-[0.14em] text-ink-400 uppercase">Mode</h3>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Stage mode">
        {STAGE_MODES.map((id) => {
          const def = MODES[id];
          const Icon = ICON[id];
          const disabled = id === 'turbo' && gl === false;
          const on = mode === id;
          return (
            <button
              key={id}
              role="radio"
              aria-checked={on}
              disabled={disabled}
              onClick={() => set({ mode: id })}
              data-testid={`mode-${id}`}
              className={clsx('flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition disabled:opacity-40', on ? 'border-signal bg-signal/10' : 'border-white/10 hover:border-white/30')}
            >
              <span className="flex items-center gap-1.5 text-sm font-semibold">
                <Icon size={14} aria-hidden /> {def.label}
                <span className="ml-auto font-mono text-[9px] tracking-wide text-ink-400 uppercase">{def.renderer === 'webgl2' ? 'GPU' : 'Canvas'}</span>
              </span>
              <span className="text-[11px] leading-snug text-ink-300">{def.tagline}</span>
            </button>
          );
        })}
      </div>
      <details className="mt-2 text-[11px] text-ink-300">
        <summary className="cursor-pointer text-ink-200 select-none">What {MODES[mode].label} holds itself to</summary>
        <ul className="mt-1.5 list-disc space-y-1 pl-4">
          {MODES[mode].principles.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </details>
      {mode === 'turbo' && (
        <>
          <h3 className="mt-3 mb-1 font-mono text-[10px] tracking-[0.14em] text-ink-400 uppercase">Turbo style</h3>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Turbo style">
            {TURBO_STYLE_IDS.map((id) => (
              <button key={id} role="radio" aria-checked={turboStyle === id} onClick={() => set({ turboStyle: id })} data-testid={`turbo-style-${id}`} className={clsx('rounded-full border px-3 py-1.5 text-xs font-semibold transition', turboStyle === id ? 'border-signal bg-signal text-white' : 'border-white/15 hover:border-white/40')}>
                {TURBO_STYLES[id].label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] leading-snug text-ink-300">{TURBO_STYLES[turboStyle].tagline}</p>
          <div className="mt-2">
            <GpuStatus compact />
          </div>
        </>
      )}
      {gl === false && (
        <p className="mt-2 flex items-start gap-1.5 text-[11px] text-amber-300">
          <Cpu size={12} className="mt-0.5 shrink-0" aria-hidden /> This browser has no WebGL2, so Turbo is unavailable. Clean works everywhere.
        </p>
      )}
    </section>
  );
}
