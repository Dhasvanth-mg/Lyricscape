'use client';

import { useState } from 'react';
import { Hand, RotateCcw } from 'lucide-react';
import type { TempoFeature } from '@/lib/index/types';
import { tapEstimate, type BeatGrid } from '@/lib/analysis/tempoSources';
import { player } from '@/lib/player/controller';

export type BeatApi = {
  grid: BeatGrid | null;
  tempo: TempoFeature | null;
  tap: TempoFeature | null;
  saveTapped: (bpm: number, phaseMs: number, taps: number) => void;
  forgetTapped: () => void;
};

/** Beat for this song: where it came from, and a way to tap it in (or fix it) yourself. */
export function BeatPanel({ beat }: { beat: BeatApi }) {
  const [taps, setTaps] = useState<number[]>([]);
  const est = tapEstimate(taps);
  const tapped = beat.tap;

  const tap = () => setTaps((t) => [...t.slice(-39), player.getPositionMs()]);
  const save = () => {
    if (!est) return;
    beat.saveTapped(est.bpm, est.phaseMs, est.used);
    setTaps([]);
  };
  const change = (bpm: number, phase: number) => {
    if (!tapped) return;
    const P = 60000 / bpm;
    beat.saveTapped(Math.round(bpm * 100) / 100, Math.round(((phase % P) + P) % P), tapped.taps ?? 0);
  };

  return (
    <div data-testid="beat-panel">
      <p className="text-sm" data-testid="beat-status">
        {beat.grid ? (
          <>
            <span className="font-semibold tabular-nums">{Math.round(beat.grid.bpm * 10) / 10} BPM</span> <span className="text-ink-300">· {beat.grid.label}</span>
          </>
        ) : beat.tempo?.source === 'lookup' ? (
          <span className="text-ink-300">Looked up: about {Math.round(beat.tempo.bpm)} BPM, but where the beats fall could not be found in the lyrics. Tap along to set it.</span>
        ) : (
          <span className="text-ink-300">No beat known for this song yet. Tap along to the music to set one.</span>
        )}
      </p>

      <button
        onPointerDown={(e) => {
          e.preventDefault();
          tap();
        }}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            tap();
          }
        }}
        className="mt-3 flex h-24 w-full flex-col items-center justify-center gap-1 rounded-2xl border border-white/15 bg-white/5 text-sm font-semibold transition select-none hover:border-white/40 active:scale-[0.99] active:bg-white/10"
        data-testid="beat-tap"
        aria-label="Tap on every beat"
      >
        <Hand size={20} aria-hidden />
        Tap on every beat
        <span className="text-xs font-normal text-ink-300 tabular-nums">{taps.length < 4 ? `${taps.length} tap${taps.length === 1 ? '' : 's'}: keep going` : est ? `${est.bpm.toFixed(1)} BPM · ${est.used} taps · steadiness ${Math.round(est.confidence * 100)}%` : 'lost the beat? keep tapping'}</span>
      </button>
      <div className="mt-2 flex flex-wrap gap-2">
        <button onClick={save} disabled={!est} className="rounded-full bg-signal px-4 py-1.5 text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-40" data-testid="beat-save">
          Use this beat
        </button>
        <button onClick={() => setTaps([])} disabled={!taps.length} className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold transition hover:border-white/40 disabled:opacity-40">
          <RotateCcw size={12} aria-hidden /> Start over
        </button>
      </div>

      {tapped && tapped.phaseMs !== null && (
        <div className="mt-4 rounded-xl border border-white/10 p-3">
          <p className="mb-2 text-xs text-ink-300">Your tapped beat. Adjust it if the pulses feel off.</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => change(tapped.bpm * 2, tapped.phaseMs!)} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-semibold transition hover:border-white/40" title="Twice as fast">
              ×2
            </button>
            <button onClick={() => change(tapped.bpm / 2, tapped.phaseMs!)} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-semibold transition hover:border-white/40" title="Half as fast">
              ÷2
            </button>
            <button onClick={() => change(tapped.bpm, tapped.phaseMs! - 20)} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-semibold tabular-nums transition hover:border-white/40" title="Pulses 20 ms sooner">
              −20 ms
            </button>
            <button onClick={() => change(tapped.bpm, tapped.phaseMs! + 20)} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-semibold tabular-nums transition hover:border-white/40" title="Pulses 20 ms later">
              +20 ms
            </button>
            <button onClick={beat.forgetTapped} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-semibold transition hover:border-white/40" title="Go back to what was known before you tapped">
              Forget my taps
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
