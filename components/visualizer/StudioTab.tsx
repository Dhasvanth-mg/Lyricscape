'use client';

// The Visual Studio: what the app understood about this song, the art direction it chose and why, and the tools to reshape it.
// Progressive disclosure: the identity and the direction cards are always visible; everything finer sits under "Customize".

import { useState } from 'react';
import clsx from 'clsx';
import { Bookmark, ChevronDown, RotateCcw, Sparkles, Trash2 } from 'lucide-react';
import { CORRECTION_DEFS } from '@/lib/identity/corrections';
import { GENRE_LABEL } from '@/lib/identity/types';
import { ART_TREATMENTS, EXIT_KINDS, LINE_TRANSITIONS, TRANSITIONS, type ArtTreatment, type ExitKind, type LineTransition, type Transition } from '@/lib/kinetic/look';
import { STYLES } from '@/lib/kinetic/styles';
import type { SceneKind } from '@/lib/kinetic/styleBase';
import { DIRECTIONS, DIRECTION_GROUPS, PALETTES } from '@/lib/theme/directions';
import { TYPE_PAIRS } from '@/lib/theme/typography';
import { useStudio } from '@/lib/theme/store';
import type { Tweaks, TypePairId } from '@/lib/theme/types';
import type { StyleId } from '@/lib/kinetic/types';
import { useUi } from '@/lib/ui-store';
import { LookControls } from './LookControls';
import { ModePicker } from './ModePicker';
import { GpuStatus } from '@/components/ui/GpuStatus';
import type { useSongLook } from './useSongLook';

export type SongLookApi = ReturnType<typeof useSongLook>;

const TREATMENT_LABEL: Record<ArtTreatment, string> = { wash: 'Soft wash', defocus: 'Defocused light', tonal: 'Re-toned to the palette', cinema: 'Full-bleed, cinematic', card: 'Framed cover', split: 'Split panel', collage: 'Paper collage', bleed: 'Full-bleed, undimmed', off: 'No artwork' };
const SCENE_LABEL: Record<SceneKind | 'none', string> = { none: 'Plain', diffuse: 'Diffused light', leaks: 'Light leaks', bokeh: 'City bokeh', paper: 'Paper', structure: 'Structure & rules', poster: 'Poster keyline', halo: 'A single halo', graphic: 'Flat shapes', aurora: 'Aurora', sunset: 'Sunset grid', notebook: 'Ruled notebook' };
const TRANSITION_LABEL: Record<Transition, string> = { preset: "Direction's own", cut: 'Cut', fade: 'Fade', drift: 'Drift', rise: 'Rise', pop: 'Pop', drop: 'Drop with bounce', zoom: 'Zoom through', blur: 'Focus pull', unfold: 'Unfold', spin: 'Spin in', snap: 'Snap (instant)', slide: 'Slide in', scatter: 'Scatter in', bounce: 'Bounce', glitch: 'Glitch', elastic: 'Elastic' };
const EXIT_LABEL: Record<ExitKind, string> = { auto: 'Matches the entrance', fade: 'Fade out', rise: 'Float away', drop: 'Fall away', zoom: 'Zoom past', shrink: 'Shrink', slide: 'Slide out', scatter: 'Scatter', spin: 'Spin out', blur: 'Blur out', cut: 'Hard cut' };
const LINE_LABEL: Record<LineTransition, string> = { none: 'None', zoomPunch: 'Zoom punch', pan: 'Camera pan', tilt: 'Camera tilt', wipe: 'Colour wipe', iris: 'Iris ring', bars: 'Venetian bars', flash: 'Soft flash' };

function Group({ title, hint, children, className }: { title: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={clsx('mb-5 last:mb-0', className)}>
      <h3 className="mb-1 font-mono text-[10px] tracking-[0.14em] text-ink-400 uppercase">{title}</h3>
      {hint && <p className="mb-2 text-xs text-ink-300">{hint}</p>}
      {children}
    </section>
  );
}

function Disclosure({ title, children, defaultOpen = false, testId }: { title: string; children: React.ReactNode; defaultOpen?: boolean; testId?: string }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-4 rounded-xl border border-white/10" data-testid={testId}>
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm font-semibold">
        {title}
        <ChevronDown size={16} className={clsx('text-ink-300 transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      {open && <div className="border-t border-white/10 p-3">{children}</div>}
    </div>
  );
}

function Range({ id, label, value, min, max, step, fmt, onChange, onReset, overridden }: { id: string; label: string; value: number; min: number; max: number; step: number; fmt?: (n: number) => string; onChange: (n: number) => void; onReset: () => void; overridden: boolean }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="mb-2.5">
      <div className="mb-0.5 flex items-center justify-between">
        <label htmlFor={id} className="text-[13px] font-semibold">
          {label}
        </label>
        <span className="flex items-center gap-1.5">
          <span className="font-mono text-[11px] text-ink-200 tabular-nums">{fmt ? fmt(value) : value.toFixed(2)}</span>
          <button onClick={onReset} disabled={!overridden} aria-label={`Reset ${label}`} title="Back to the art direction's value" className="rounded p-0.5 text-ink-300 transition hover:text-bone disabled:opacity-0">
            <RotateCcw size={11} aria-hidden />
          </button>
        </span>
      </div>
      <input id={id} type="range" className="seek w-full" min={min} max={max} step={step} value={value} style={{ ['--pct' as string]: `${pct}%` }} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

function Select<T extends string>({ id, label, value, options, onChange, onReset, overridden }: { id: string; label: string; value: T; options: [T, string][]; onChange: (v: T) => void; onReset: () => void; overridden: boolean }) {
  return (
    <div className="mb-2.5 flex items-center justify-between gap-2">
      <label htmlFor={id} className="text-[13px] font-semibold">
        {label}
      </label>
      <span className="flex items-center gap-1">
        <select id={id} value={value} onChange={(e) => onChange(e.target.value as T)} className="h-8 max-w-[11rem] rounded-lg border border-ink-600 bg-ink-900/80 px-2 text-xs">
          {options.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <button onClick={onReset} disabled={!overridden} aria-label={`Reset ${label}`} className="rounded p-0.5 text-ink-300 transition hover:text-bone disabled:opacity-0">
          <RotateCcw size={11} aria-hidden />
        </button>
      </span>
    </div>
  );
}

function Swatch({ id, label, value, onChange, onReset, overridden }: { id: string; label: string; value: string; onChange: (v: string) => void; onReset: () => void; overridden: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-white/10 px-2 py-1.5">
      <label htmlFor={id} className="text-xs font-semibold">
        {label}
      </label>
      <span className="flex items-center gap-1">
        <input id={id} type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent p-0" />
        <button onClick={onReset} disabled={!overridden} aria-label={`Reset ${label}`} className="rounded p-0.5 text-ink-300 transition hover:text-bone disabled:opacity-0">
          <RotateCcw size={11} aria-hidden />
        </button>
      </span>
    </div>
  );
}

function DirectionCard({ id, selected, auto, onPick }: { id: StyleId; selected: boolean; auto: boolean; onPick: () => void }) {
  const d = DIRECTIONS[id]!;
  const st = STYLES[id];
  const spec = d.palettes[0];
  const g0 = spec && spec.ground !== 'cover' ? spec.ground[0] : spec ? '#e85d75' : '#1b1b22';
  const g1 = spec && spec.ground !== 'cover' ? spec.ground[1] : spec ? '#f08a5d' : '#2a2a35';
  const font = st.fonts[st.displayFont];
  return (
    <button role="radio" aria-checked={selected} data-testid={`dir-${id}`} onClick={onPick} title={st.description} className={clsx('rounded-xl border p-1.5 text-left transition', selected ? 'border-signal bg-signal/10' : 'border-white/10 hover:border-white/30')}>
      <span className="flex h-12 items-center justify-between rounded-lg px-2.5" style={{ background: `linear-gradient(135deg, ${g0}, ${g1})` }}>
        <span style={{ color: spec?.ink ?? '#f4f2ea', fontFamily: `"${font.family}", serif`, fontWeight: font.weight, fontStyle: font.italic ? 'italic' : 'normal', fontSize: 22, textTransform: font.uppercase ? 'uppercase' : 'none', letterSpacing: `${font.letterSpacingEm}em` }}>Aa</span>
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: spec?.active ?? '#ffd23f' }} />
      </span>
      <span className="mt-1.5 flex items-center gap-1 px-0.5 text-[13px] font-semibold">
        {d.label}
        {auto && <Sparkles size={11} className="text-signal" aria-label="chosen by Auto" />}
      </span>
      <span className="block px-0.5 text-[11px] leading-snug text-ink-300">{d.tagline}</span>
    </button>
  );
}

export function StudioTab({ sl, readable, onReadable, reduced, osReduced, onForceCalm }: { sl: SongLookApi; readable: boolean; onReadable: (v: boolean) => void; reduced: boolean; osReduced: boolean; onForceCalm: (v: boolean) => void }) {
  const ui = useUi();
  const saved = useStudio((s) => s.saved);
  const familyDefaults = useStudio((s) => s.familyDefaults);
  const setFamilyDefault = useStudio((s) => s.setFamilyDefault);
  const deleteTheme = useStudio((s) => s.deleteTheme);
  const [name, setName] = useState('');
  const { resolved: r, identity, described } = sl;
  const L = r.look;
  const T: Tweaks = r.tweaks;
  const dir = DIRECTIONS[r.direction]!;
  const autoName = DIRECTIONS[r.choice.direction]?.label ?? '';
  const auto = r.basis === 'auto';
  const classic = dir.palettes.length === 0 && !T.paletteId;
  const family = identity?.musical.primaryGenre ?? null;

  const setIn = (group: 'motion' | 'appearance' | 'colors', key: string, v: unknown) => sl.setTweaks((t) => ({ ...t, [group]: { ...(t[group] ?? {}), [key]: v } }) as Tweaks);
  const unsetIn = (group: 'motion' | 'appearance' | 'colors', key: string) =>
    sl.setTweaks((t) => {
      const g = { ...(t[group] ?? {}) } as Record<string, unknown>;
      delete g[key];
      const n = { ...t, [group]: g } as Tweaks;
      if (!Object.keys(g).length) delete n[group];
      return n;
    });
  const setTop = (key: 'typography' | 'scene' | 'artwork' | 'paletteId', v: unknown) => sl.setTweaks((t) => ({ ...t, [key]: v }) as Tweaks);
  const unsetTop = (key: 'typography' | 'scene' | 'artwork' | 'paletteId') =>
    sl.setTweaks((t) => {
      const n = { ...t };
      delete n[key];
      return n;
    });
  const tweaked = Object.keys(T).length > 0;
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const m = L.motion;
  const ap = T.appearance ?? {};
  const tm = T.motion ?? {};

  return (
    <>
      <ModePicker />
      {/* ---- what the app understood about this song ---------------------------------------------------------------- */}
      <section className="mb-5 rounded-xl border border-white/10 bg-white/[0.03] p-3" data-testid="identity-card">
        <p className="font-mono text-[10px] tracking-[0.14em] text-ink-400 uppercase">This song, as understood</p>
        <p className="mt-1 text-lg leading-snug font-semibold" data-testid="identity-headline">
          {described?.headline ?? '—'}
        </p>
        <p className="mt-1 text-xs text-ink-300">
          {auto ? `Auto chose ${autoName}` : `Auto would choose ${autoName}`}
          {r.choice.reasons.length ? ` · ${r.choice.reasons.join(', ')}` : ''}
          {r.choice.basis === 'evidence' && r.choice.confidence > 0 ? ` (${r.choice.confidence >= 0.4 ? 'fairly sure' : 'a judgement call'})` : ''}
        </p>
        {r.notes.length > 0 && <p className="mt-1 text-[11px] text-ink-400">{r.notes.join(' · ')}</p>}

        <p className="mt-3 text-xs font-semibold">Not quite right?</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5" role="group" aria-label="Correct the interpretation">
          {CORRECTION_DEFS.filter((c) => c.id !== 'lessIntimate').map((c) => (
            <button key={c.id} onClick={() => sl.correct(c.id)} className="rounded-full border border-white/15 px-2.5 py-1 text-[11px] font-semibold transition hover:border-white/40">
              {c.label}
            </button>
          ))}
          {sl.corrections && sl.corrections.history.length > 0 && (
            <button onClick={sl.resetCorrections} className="inline-flex items-center gap-1 px-1.5 py-1 text-[11px] text-ink-300 underline-offset-2 hover:underline">
              <RotateCcw size={10} aria-hidden /> undo {sl.corrections.history.length}
            </button>
          )}
        </div>

        <details className="mt-3 text-xs text-ink-300">
          <summary className="cursor-pointer font-semibold text-ink-200">What this is based on</summary>
          <ul className="mt-1.5 space-y-0.5">
            {identity?.provenance.rows.map((row) => (
              <li key={row.source} className={row.used ? '' : 'opacity-60'}>
                <span className="font-mono text-[10px] uppercase">{row.source}</span> · {row.detail}
              </li>
            ))}
          </ul>
          {identity && identity.musical.tags.length > 0 && <p className="mt-1.5">Tags: {identity.musical.tags.slice(0, 6).map((t) => t.tag).join(', ')}</p>}
          {sl.aiState !== 'off' && <p className="mt-1.5">AI reading: {sl.aiState === 'used' ? 'used (lyric themes only, confidence capped)' : sl.aiState === 'loading' ? 'working…' : 'not available, local analysis only'}</p>}
          <p className="mt-1.5 text-ink-400">Not known to this app: {identity?.provenance.unknown.join('; ')}.</p>
        </details>
      </section>

      {/* ---- the art direction ---------------------------------------------------------------------------------------- */}
      <Group title="Art direction" hint="Each one is a composed world: palette, type, artwork, motion. Auto picks from what is known about the song.">
        <button onClick={() => sl.setPick({ kind: 'auto' })} aria-pressed={auto} data-testid="dir-auto" className={clsx('mb-2 flex w-full items-start gap-3 rounded-xl border p-3 text-left transition', auto ? 'border-signal bg-signal/10' : 'border-white/10 hover:border-white/30')}>
          <Sparkles size={18} className="mt-0.5 shrink-0 text-signal" aria-hidden />
          <span>
            <span className="block text-sm font-semibold">Auto · {autoName}</span>
            <span className="block text-xs text-ink-300">{auto ? 'Following the song.' : 'Return to what the song suggests.'}</span>
          </span>
        </button>
        <div role="radiogroup" aria-label="Art direction">
          {DIRECTION_GROUPS.map((g, gi) => {
            const cards = (
              <div className="grid grid-cols-2 gap-1.5">
                {g.ids.map((id) => (
                  <DirectionCard key={id} id={id} selected={!auto && r.direction === id && r.basis !== 'saved'} auto={auto && r.choice.direction === id} onPick={() => sl.setPick({ kind: 'direction', id })} />
                ))}
              </div>
            );
            return gi === DIRECTION_GROUPS.length - 1 ? (
              <details key={g.label} className="mt-2 text-xs">
                <summary className="cursor-pointer py-1 font-semibold text-ink-200">{g.label}</summary>
                <div className="mt-1.5">{cards}</div>
              </details>
            ) : (
              <div key={g.label} className="mb-2">
                <p className="mb-1 text-[11px] font-semibold text-ink-300">{g.label}</p>
                {cards}
              </div>
            );
          })}
        </div>
        {r.basis === 'saved' && <p className="mt-2 text-xs text-ink-300">Using your theme “{r.savedName}”.</p>}
        {family && (
          <div className="mt-2 flex items-center justify-between gap-2 text-xs text-ink-300">
            <span>
              When Auto sees {GENRE_LABEL[family]}, use:
            </span>
            <select aria-label={`Default direction for ${GENRE_LABEL[family]}`} value={familyDefaults[family] ?? ''} onChange={(e) => setFamilyDefault(family, (e.target.value || null) as StyleId | null)} className="h-8 rounded-lg border border-ink-600 bg-ink-900/80 px-2 text-xs">
              <option value="">Whatever fits the song</option>
              {DIRECTION_GROUPS.slice(0, -1).flatMap((g) => g.ids).map((id) => (
                <option key={id} value={id}>
                  {DIRECTIONS[id]!.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </Group>

      {/* ---- customise ---------------------------------------------------------------------------------------------------- */}
      <Disclosure title={`Customize this look${tweaked ? ' · adjusted' : ''}`} testId="customize">
        <p className="mb-3 text-[11px] text-ink-400">Changes apply to this song and preview live. The reset arrow beside a control returns it to the art direction&apos;s own value. Text always keeps readable contrast.</p>

        <Group title="Colour">
          <div className="mb-2 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Palette">
            <button role="radio" aria-checked={!T.paletteId} onClick={() => unsetTop('paletteId')} className={clsx('rounded-full border px-2.5 py-1 text-[11px] font-semibold', !T.paletteId ? 'border-signal bg-signal/15' : 'border-white/15 hover:border-white/40')}>
              Direction&apos;s own
            </button>
            {PALETTES.map((p) => (
              <button key={p.id} role="radio" aria-checked={T.paletteId === p.id} onClick={() => setTop('paletteId', p.id)} title={p.label} className={clsx('inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-semibold', T.paletteId === p.id ? 'border-signal bg-signal/15' : 'border-white/15 hover:border-white/40')}>
                <span className="flex">
                  {[p.ground === 'cover' ? '#e85d75' : p.ground[0], p.active, p.accent].map((c, i) => (
                    <span key={i} className="-ml-1 h-3.5 w-3.5 rounded-full border border-black/30 first:ml-0" style={{ background: c }} />
                  ))}
                </span>
                {p.label}
              </button>
            ))}
          </div>
          {L.colors && L.ground && (
            <div className="grid grid-cols-2 gap-1.5">
              <Swatch id="c-ground" label="Ground" value={T.colors?.ground ?? L.ground[0]} onChange={(v) => setIn('colors', 'ground', v)} onReset={() => unsetIn('colors', 'ground')} overridden={!!T.colors?.ground} />
              <Swatch id="c-ink" label="Lyrics" value={T.colors?.ink ?? L.colors.ink} onChange={(v) => setIn('colors', 'ink', v)} onReset={() => unsetIn('colors', 'ink')} overridden={!!T.colors?.ink} />
              <Swatch id="c-active" label="Sung word" value={T.colors?.active ?? L.colors.active} onChange={(v) => setIn('colors', 'active', v)} onReset={() => unsetIn('colors', 'active')} overridden={!!T.colors?.active} />
              <Swatch id="c-accent" label="Accent" value={T.colors?.accent ?? L.colors.accent} onChange={(v) => setIn('colors', 'accent', v)} onReset={() => unsetIn('colors', 'accent')} overridden={!!T.colors?.accent} />
            </div>
          )}
          {classic && <p className="mt-1 text-[11px] text-ink-400">This classic look colours itself from the cover. Pick a palette above to take control.</p>}
        </Group>

        <Group title="Typography">
          <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Typography">
            {TYPE_PAIRS.map((p) => {
              const f = p.display;
              return (
                <button key={p.id} role="radio" aria-checked={(T.typography ?? 'direction') === p.id} onClick={() => (p.id === 'direction' ? unsetTop('typography') : setTop('typography', p.id as TypePairId))} title={p.hint} className={clsx('flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left', (T.typography ?? 'direction') === p.id ? 'border-signal bg-signal/10' : 'border-white/10 hover:border-white/30')}>
                  <span className="w-7 text-center text-lg leading-none" style={f ? { fontFamily: `"${f.family}", serif`, fontWeight: f.weight, fontStyle: f.italic ? 'italic' : 'normal' } : undefined}>
                    {p.sample}
                  </span>
                  <span className="text-[11px] leading-tight font-semibold">{p.label}</span>
                </button>
              );
            })}
          </div>
        </Group>

        <Group title="Background & artwork">
          <Select id="s-scene" label="Background" value={(T.scene ?? L.appearance.scene ?? 'none') as SceneKind | 'none'} options={(Object.keys(SCENE_LABEL) as (SceneKind | 'none')[]).map((k) => [k, SCENE_LABEL[k]])} onChange={(v) => setTop('scene', v)} onReset={() => unsetTop('scene')} overridden={T.scene !== undefined} />
          <Select id="s-art" label="Artwork" value={L.artwork.treatment} options={ART_TREATMENTS.map((k) => [k, TREATMENT_LABEL[k]])} onChange={(v) => setTop('artwork', v)} onReset={() => unsetTop('artwork')} overridden={T.artwork !== undefined} />
          <Range id="a-blur" label="Artwork softness" value={L.artwork.blur} min={0} max={1} step={0.05} fmt={pct} onChange={(v) => setIn('appearance', 'blur', v)} onReset={() => unsetIn('appearance', 'blur')} overridden={ap.blur !== undefined} />
          <Range id="a-bright" label="Background brightness" value={ap.brightness ?? 1} min={0.6} max={1.4} step={0.02} fmt={pct} onChange={(v) => setIn('appearance', 'brightness', v)} onReset={() => unsetIn('appearance', 'brightness')} overridden={ap.brightness !== undefined} />
        </Group>

        <Group title="Motion">
          <Range id="m-int" label="Animation intensity" value={m.intensity} min={0} max={2} step={0.05} fmt={pct} onChange={(v) => setIn('motion', 'intensity', v)} onReset={() => unsetIn('motion', 'intensity')} overridden={tm.intensity !== undefined} />
          <Range id="m-smooth" label="Smoothness" value={m.smooth} min={0} max={1} step={0.05} fmt={pct} onChange={(v) => setIn('motion', 'smooth', v)} onReset={() => unsetIn('motion', 'smooth')} overridden={tm.smooth !== undefined} />
          <Range id="m-emph" label="Word emphasis" value={m.emphasis} min={0} max={2} step={0.05} fmt={pct} onChange={(v) => setIn('motion', 'emphasis', v)} onReset={() => unsetIn('motion', 'emphasis')} overridden={tm.emphasis !== undefined} />
          <Range id="m-beat" label="Beat response" value={m.beat} min={0} max={2} step={0.05} fmt={pct} onChange={(v) => setIn('motion', 'beat', v)} onReset={() => unsetIn('motion', 'beat')} overridden={tm.beat !== undefined} />
          <Range id="m-cx" label="Visual complexity" value={m.complexity} min={0} max={1} step={0.05} fmt={pct} onChange={(v) => setIn('motion', 'complexity', v)} onReset={() => unsetIn('motion', 'complexity')} overridden={tm.complexity !== undefined} />
          <Select id="m-tr" label="Words enter with" value={m.transition} options={TRANSITIONS.map((k) => [k, TRANSITION_LABEL[k]])} onChange={(v) => setIn('motion', 'transition', v)} onReset={() => unsetIn('motion', 'transition')} overridden={tm.transition !== undefined} />
          <Select id="m-ex" label="Words leave with" value={m.exit ?? 'auto'} options={EXIT_KINDS.map((k) => [k, EXIT_LABEL[k]])} onChange={(v) => setIn('motion', 'exit', v)} onReset={() => unsetIn('motion', 'exit')} overridden={tm.exit !== undefined} />
          <Range id="m-speed" label="Transition speed" value={m.speed ?? 1} min={0.5} max={2} step={0.05} fmt={(n) => `${n.toFixed(2)}×`} onChange={(v) => setIn('motion', 'speed', v)} onReset={() => unsetIn('motion', 'speed')} overridden={tm.speed !== undefined} />
          <Select id="m-lt" label="When a line begins" value={m.lineTransition ?? 'none'} options={LINE_TRANSITIONS.map((k) => [k, LINE_LABEL[k]])} onChange={(v) => setIn('motion', 'lineTransition', v)} onReset={() => unsetIn('motion', 'lineTransition')} overridden={tm.lineTransition !== undefined} />
          {(m.lineTransition ?? 'none') !== 'none' && <Select id="m-lo" label="Use it on" value={m.lineOn ?? 'all'} options={[['all', 'Every line'], ['hooks', 'Hooks only']]} onChange={(v) => setIn('motion', 'lineOn', v)} onReset={() => unsetIn('motion', 'lineOn')} overridden={tm.lineOn !== undefined} />}
          <p className="text-[11px] text-ink-400">Motion follows the playback timeline only. It never changes when a word is shown. Beat response needs a real beat grid (demo and imported audio); Spotify gives none, so nothing is faked.</p>
        </Group>

        <Group title="Appearance">
          <Range id="p-size" label="Text size" value={L.layout.textScale} min={0.4} max={1.5} step={0.02} fmt={pct} onChange={(v) => setIn('appearance', 'textScale', v)} onReset={() => unsetIn('appearance', 'textScale')} overridden={ap.textScale !== undefined} />
          <Range id="p-y" label="Text position" value={L.layout.textY} min={-0.3} max={0.3} step={0.01} fmt={(n) => (n === 0 ? 'centre' : n < 0 ? 'higher' : 'lower')} onChange={(v) => setIn('appearance', 'textY', v)} onReset={() => unsetIn('appearance', 'textY')} overridden={ap.textY !== undefined} />
          <Select id="p-align" label="Alignment" value={L.layout.align} options={[['center', 'Centred'], ['left', 'Left']]} onChange={(v) => setIn('appearance', 'align', v)} onReset={() => unsetIn('appearance', 'align')} overridden={ap.align !== undefined} />
          <Range id="p-contrast" label="Contrast" value={ap.contrast ?? 1} min={0.8} max={1.4} step={0.02} fmt={pct} onChange={(v) => setIn('appearance', 'contrast', v)} onReset={() => unsetIn('appearance', 'contrast')} overridden={ap.contrast !== undefined} />
          <Range id="p-grain" label="Grain" value={L.appearance.grain} min={0} max={0.4} step={0.01} fmt={pct} onChange={(v) => setIn('appearance', 'grain', v)} onReset={() => unsetIn('appearance', 'grain')} overridden={ap.grain !== undefined} />
          <Range id="p-glow" label="Glow" value={L.appearance.glow} min={0} max={1.2} step={0.05} fmt={pct} onChange={(v) => setIn('appearance', 'glow', v)} onReset={() => unsetIn('appearance', 'glow')} overridden={ap.glow !== undefined} />
          <Range id="p-density" label="Visual density" value={L.appearance.density} min={0} max={1.5} step={0.05} fmt={pct} onChange={(v) => setIn('appearance', 'density', v)} onReset={() => unsetIn('appearance', 'density')} overridden={ap.density !== undefined} />
        </Group>

        {tweaked && (
          <button onClick={sl.resetTweaks} className="inline-flex items-center gap-1.5 text-xs text-ink-300 underline-offset-2 hover:underline">
            <RotateCcw size={12} aria-hidden /> Reset every adjustment
          </button>
        )}
        {!classic ? null : (
          <details className="mt-3 text-xs">
            <summary className="cursor-pointer font-semibold text-ink-200">Classic options</summary>
            <div className="mt-2">
              <LookControls />
            </div>
          </details>
        )}
      </Disclosure>

      {/* ---- saving ------------------------------------------------------------------------------------------------------- */}
      <Group title="Your themes" hint="Save this look (direction and adjustments) and use it on any song.">
        <form
          className="mb-2 flex gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            sl.saveAsTheme(name);
            setName('');
          }}
        >
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Name this theme" aria-label="Theme name" className="h-9 min-w-0 flex-1 rounded-lg border border-ink-600 bg-ink-900/80 px-3 text-sm" />
          <button type="submit" disabled={!name.trim()} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-bone px-3 text-xs font-semibold text-ink-950 disabled:opacity-40">
            <Bookmark size={13} aria-hidden /> Save
          </button>
        </form>
        {saved.length === 0 ? (
          <p className="text-xs text-ink-400">Nothing saved yet.</p>
        ) : (
          <ul className="space-y-1.5" data-testid="saved-themes">
            {saved.map((t) => {
              const on = r.basis === 'saved' && r.savedName === t.name;
              return (
                <li key={t.id} className={clsx('flex items-center gap-2 rounded-lg border px-2.5 py-1.5', on ? 'border-signal bg-signal/10' : 'border-white/10')}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{t.name}</span>
                    <span className="block text-[11px] text-ink-400">{DIRECTIONS[t.base]?.label ?? t.base}</span>
                  </span>
                  <button onClick={() => sl.setPick({ kind: 'saved', id: t.id })} disabled={on} className="rounded-full border border-white/15 px-2.5 py-1 text-[11px] font-semibold transition hover:border-white/40 disabled:opacity-50">
                    {on ? 'In use' : 'Use here'}
                  </button>
                  <button onClick={() => deleteTheme(t.id)} aria-label={`Delete ${t.name}`} className="rounded p-1 text-ink-300 transition hover:text-bone">
                    <Trash2 size={13} aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Group>

      <GpuStatus compact />

      <Group title="Readability">
        <ToggleRow on={readable} onChange={onReadable} label="Readable lyrics" hint="Calmer motion so long lines are easy to read." />
        <ToggleRow on={reduced} onChange={onForceCalm} disabled={osReduced} label="Reduced motion" hint={osReduced ? 'Your system asks for reduced motion.' : 'Fades instead of movement.'} />
        <ToggleRow on={ui.autoTheme} onChange={(v) => ui.set({ autoTheme: v })} label="Pick looks from the song" hint="Off: songs without their own pick use the default style from Settings." />
      </Group>
    </>
  );
}

function ToggleRow({ on, onChange, label, hint, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; hint?: string; disabled?: boolean }) {
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

