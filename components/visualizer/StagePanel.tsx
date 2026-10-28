'use client';

import clsx from 'clsx';
import { FilePen, RotateCcw, Target, Wand2, X } from 'lucide-react';
import type { LyricDocument, Track } from '@/lib/types';
import { timingSummary } from '@/lib/lyrics/parse';
import { useUi } from '@/lib/ui-store';
import { usePlayer } from '@/lib/player/controller';
import { StudioTab, type SongLookApi } from './StudioTab';
import { SyncStepper } from './SyncStepper';
import type { useLyricClock } from './useLyricClock';
import type { useLyrics } from './useLyrics';

export type PanelTab = 'look' | 'sync';

type Props = {
  tab: PanelTab;
  onTab: (t: PanelTab) => void;
  onClose: () => void;
  track: Track;
  lyrics: ReturnType<typeof useLyrics>;
  clock: ReturnType<typeof useLyricClock>;
  /** this song's identity, art direction and the tools to change them */
  sl: SongLookApi;
  readable: boolean;
  onReadable: (v: boolean) => void;
  reduced: boolean;
  osReduced: boolean;
  onForceCalm: (v: boolean) => void;
  onAnchor: (which: 'this' | 'next') => void;
  toast: string | null;
  onEditLyrics?: () => void;
};

const fmt = (n: number) => `${n > 0 ? '+' : ''}${n} ms`;

export function StagePanel(p: Props) {
  const ui = useUi();
  return (
    <aside
      className="absolute top-16 right-3 bottom-16 z-20 flex w-[min(380px,calc(100%-1.5rem))] flex-col overflow-hidden rounded-2xl border border-white/10 bg-ink-950/80 text-bone shadow-2xl backdrop-blur-xl"
      aria-label="Stage settings"
      data-testid="stage-panel"
    >
      <div className="flex items-center gap-1 border-b border-white/10 p-2">
        {(['look', 'sync'] as const).map((t) => (
          <button key={t} onClick={() => p.onTab(t)} aria-pressed={p.tab === t} className={clsx('rounded-full px-4 py-1.5 text-sm font-semibold transition', p.tab === t ? 'bg-bone text-ink-950' : 'text-ink-300 hover:text-bone')}>
            {t === 'look' ? 'Studio' : 'Sync'}
          </button>
        ))}
        <button onClick={p.onClose} className="ml-auto rounded-full p-2 text-ink-300 transition hover:text-bone" aria-label="Close panel">
          <X size={16} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">{p.tab === 'look' ? <StudioTab sl={p.sl} readable={p.readable} onReadable={p.onReadable} reduced={p.reduced} osReduced={p.osReduced} onForceCalm={p.onForceCalm} /> : <SyncTab {...p} />}</div>

      {p.toast && (
        <p role="status" className="border-t border-white/10 bg-signal/15 px-4 py-2 text-xs text-bone">
          {p.toast}
        </p>
      )}
    </aside>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="mb-5 last:mb-0">
      <h3 className="mb-1 font-mono text-[10px] tracking-[0.14em] text-ink-400 uppercase">{title}</h3>
      {hint && <p className="mb-2 text-xs text-ink-300">{hint}</p>}
      {children}
    </section>
  );
}

function Toggle({ on, onChange, label, hint, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; hint?: string; disabled?: boolean }) {
  return (
    <button onClick={() => onChange(!on)} disabled={disabled} role="switch" aria-checked={on} className="flex w-full items-start gap-3 rounded-xl p-2 text-left transition hover:bg-white/5 disabled:opacity-40">
      <span className={clsx('mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition', on ? 'bg-signal' : 'bg-ink-600')}>
        <span className={clsx('h-4 w-4 rounded-full bg-white transition-transform', on && 'translate-x-4')} />
      </span>
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        {hint && <span className="block text-xs text-ink-300">{hint}</span>}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Sync
// ---------------------------------------------------------------------------------------------------------------------
function SyncTab(p: Props) {
  const ui = useUi();
  const positionSource = usePlayer((s) => s.spotify.positionSource);
  const doc: LyricDocument | null = p.lyrics.doc;
  const sum = doc ? timingSummary(doc) : null;
  const m = doc?.timing?.match;
  const nudge = (d: number) => p.clock.setTrackOffset(p.clock.trackOffset + d);
  return (
    <>
      {p.track.provider === 'spotify' && (
        <Section title="Playback clock">
          <p className="text-sm" data-testid="sync-clock-source">{positionSource === 'sdk' ? 'Spotify browser player' : positionSource === 'api' ? 'Spotify device reports' : 'Waiting for Spotify playback'}</p>
          <p className="mt-1 text-xs text-ink-300">The playback clock places the song. Word-by-word accuracy also depends on the lyric file.</p>
        </Section>
      )}
      <Section title="These lyrics">
        {doc && sum ? (
          <div className="rounded-xl border border-white/10 p-3 text-sm">
            <p className="font-semibold">{sum.label}</p>
            <p className="mt-0.5 text-xs text-ink-300">
              {sum.words === 'estimated' ? 'Only the start of each line is timed. Word timing inside a line is an estimate, so it can run early or late and reset at the next line. Turn off estimated word motion below to follow line timestamps.' : sum.words === 'authored' ? 'Every word has its own time.' : sum.lines === 'unsynced' ? 'No timing: lines are spread across the song. Not really in sync.' : 'Some lines have word timing, the rest are estimated.'}
            </p>
            <p className="mt-2 text-xs text-ink-400">
              Source: {p.lyrics.source ?? 'unknown'}
              {m ? ` · ${m.verdict === 'exact' ? 'same length as your track' : m.verdict === 'close' ? `length differs by ${m.durationDeltaSec}s` : 'length not checked'}` : ''}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(p.lyrics.versionId != null || p.lyrics.origin === 'musixmatch') && (
                <button onClick={() => void p.lyrics.anotherVersion()} disabled={p.lyrics.searching} className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold transition hover:border-white/40 disabled:opacity-50" title="Different recordings of a song can be timed differently">
                  {p.lyrics.searching ? 'Looking…' : 'Try another version'}
                </button>
              )}
              {p.onEditLyrics && (
                <button onClick={p.onEditLyrics} className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold transition hover:border-white/40">
                  <FilePen size={12} aria-hidden /> Open editor
                </button>
              )}
            </div>
            {p.lyrics.message && <p className="mt-2 text-xs text-ink-300">{p.lyrics.message}</p>}
          </div>
        ) : (
          <p className="text-sm text-ink-300">No lyrics loaded for this song yet.</p>
        )}
      </Section>

      <Section title="Fix this song" hint="Almost right but off by about a second? Tap when you hear the line start, or nudge it.">
        <div className="mb-3 grid grid-cols-2 gap-2">
          <button onClick={() => p.onAnchor('this')} disabled={!doc} className="rounded-xl border border-white/15 p-2.5 text-left transition hover:border-white/40 disabled:opacity-40" title="Lyrics too early: wait until you hear the highlighted line begin, then tap">
            <Target size={14} className="mb-1 text-signal" aria-hidden />
            <span className="block text-xs font-semibold">This line starts now</span>
            <span className="block text-[11px] text-ink-400">lyrics showed it too early</span>
          </button>
          <button onClick={() => p.onAnchor('next')} disabled={!doc} className="rounded-xl border border-white/15 p-2.5 text-left transition hover:border-white/40 disabled:opacity-40" title="Lyrics too late: tap when you hear the NEXT line begin, before it shows">
            <Target size={14} className="mb-1 text-signal" aria-hidden />
            <span className="block text-xs font-semibold">Next line starts now</span>
            <span className="block text-[11px] text-ink-400">lyrics showed it too late</span>
          </button>
        </div>
        <div className="mb-3 grid grid-cols-4 gap-1.5" role="group" aria-label="Nudge this song">
          {[-1000, -250, 250, 1000].map((d) => (
            <button key={d} onClick={() => nudge(d)} className="rounded-lg border border-white/10 py-1.5 text-xs font-semibold tabular-nums transition hover:border-white/40" title={d < 0 ? 'Lyrics later' : 'Lyrics sooner'}>
              {d > 0 ? '+' : '−'}
              {Math.abs(d) >= 1000 ? `${Math.abs(d) / 1000} s` : `${Math.abs(d)}`}
            </button>
          ))}
        </div>
        <div className="mb-3">
          <p className="mb-1 text-sm font-semibold">This song</p>
          <SyncStepper id="sync-song" label="" title="This song's lyric timing offset" value={p.clock.trackOffset} onChange={p.clock.setTrackOffset} />
          <p className="mt-1 text-[11px] text-ink-400">Saved for this song only, never written into the lyrics. Starts at 0 unless a saved correction is loaded; this is not an automatic latency measurement. Positive = lyrics sooner. Hold − / + to repeat, or type any value: there is no limit. Keys: [ ] nudge, \ reset.</p>
        </div>
        <div className="mb-3">
          <p className="mb-1 text-sm font-semibold">{p.clock.family === 'spotify' ? 'Spotify device' : 'Speakers / Bluetooth'}</p>
          <SyncStepper id="sync-device" label="" title="Device delay" value={p.clock.device} onChange={p.clock.setDevice} />
          <p className="mt-1 text-[11px] text-ink-400">How far this setup is off, the same for every song. Set it once.</p>
        </div>
        <button onClick={() => { p.clock.setTrackOffset(0); p.clock.setDevice(0); }} className="inline-flex items-center gap-1.5 text-xs text-ink-300 underline-offset-2 hover:underline">
          <RotateCcw size={12} aria-hidden /> Reset both
        </button>
      </Section>

      <Section title="Word motion">
        <Toggle on={ui.estimatedWords} onChange={(v) => ui.set({ estimatedWords: v })} label="Word by word on line-synced lyrics" hint="Animates words from an estimate of when each is sung (labelled estimated). Off shows each line at once." />
      </Section>

      {p.track.provider !== 'spotify' && (
        <Section title="Local audio">
          <p className="flex items-start gap-2 text-xs text-ink-300">
            <Wand2 size={14} className="mt-0.5 shrink-0" aria-hidden />
            For imported files, the editor can align the words to the audio with the optional local aligner.
          </p>
        </Section>
      )}
    </>
  );
}
