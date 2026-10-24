'use client';

import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { Cpu } from 'lucide-react';
import { detectGpu, type GpuInfo } from '@/lib/gpu';

const LABEL = { dedicated: 'dedicated GPU', integrated: 'integrated graphics', unified: 'unified GPU', software: 'software rendering (no GPU)', unknown: 'unknown' } as const;

/** Which GPU the browser is drawing the lyrics on, with the fix when it is not the dedicated one. `compact` = a single line. */
export function GpuStatus({ compact = false }: { compact?: boolean }) {
  const [gpu, setGpu] = useState<GpuInfo | null>(null);
  useEffect(() => setGpu(detectGpu()), []);
  if (!gpu) return null;
  const slow = gpu.kind === 'integrated' || gpu.kind === 'software';
  if (compact) {
    return (
      <p className={clsx('flex items-start gap-1.5 text-[11px]', slow ? 'text-amber-300' : 'text-ink-400')} data-testid="gpu-line" data-kind={gpu.kind}>
        <Cpu size={12} className="mt-0.5 shrink-0" aria-hidden />
        <span>
          Drawing on {gpu.renderer || 'an unknown GPU'} ({LABEL[gpu.kind]}).{slow ? ' See Settings → Graphics to use the dedicated GPU.' : ''}
        </span>
      </p>
    );
  }
  return (
    <div className={clsx('rounded-xl border p-4', slow ? 'border-amber-400/40 bg-amber-400/5' : 'border-ink-700')} data-testid="gpu-card" data-kind={gpu.kind}>
      <p className="font-semibold">
        <Cpu size={15} className="mr-1.5 inline align-[-2px]" aria-hidden />
        {gpu.renderer || 'Unknown graphics'} <span className="font-normal text-ink-300">· {LABEL[gpu.kind]}</span>
      </p>
      {slow ? (
        <>
          <p className="mt-1 text-sm text-ink-200">This browser is drawing on {gpu.kind === 'software' ? 'the CPU' : 'the integrated GPU'}. A web page cannot switch it; the browser has to be started on the dedicated GPU. Two ways:</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-ink-200">
            <li>
              <strong>Once, permanently (Windows):</strong> Settings → System → Display → Graphics → add your browser (<code>msedge.exe</code> or <code>chrome.exe</code>) → Options → <em>High performance</em>, then restart the browser.
            </li>
            <li>
              <strong>Per launch:</strong> close every browser window, then run <code>pnpm open:gpu</code> in the project folder. It starts your browser with <code>--force_high_performance_gpu</code> on this app.
            </li>
          </ol>
          <p className="mt-2 text-xs text-ink-400">The app never changes your system settings itself. The lyric renderer is light (a few milliseconds a frame on integrated graphics), so this matters most for high-resolution or high-refresh displays.</p>
        </>
      ) : (
        <p className="mt-1 text-sm text-ink-300">Nothing to change.</p>
      )}
    </div>
  );
}
