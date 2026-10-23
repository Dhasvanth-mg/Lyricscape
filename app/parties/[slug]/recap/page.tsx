'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Clapperboard, Download, Redo2, RefreshCcw, Save, Star, Trash2, Undo2, Upload, X } from 'lucide-react';
import clsx from 'clsx';
import { useParty } from '@/components/party/PartyContext';
import { api, uploadWithProgress } from '@/lib/party/client';
import { ASPECTS, PRESETS, PRESET_LENGTH_MS, type Aspect, type Clip, type RecapPreset, type RecapTimeline } from '@/lib/recap/timeline';
import { Button, Chip, Empty, Spinner } from '@/components/ui/bits';

type Soundtracks = { demo: { id: string; title: string; license: string }[]; uploads: { id: string; title: string; size: number }[]; spotify: { eligible: boolean; reason: string }; workerOnline: boolean };
type Asset = { id: string; mediaType: 'image' | 'video'; url: string; mustInclude: boolean; quality: number | null; usable: boolean; reason: string | null; duplicateOf: string | null; durationMs: number | null };
type Job = { id: string; type: 'plan' | 'preview' | 'final'; status: string; progress: number; attempts: number; maxAttempts: number; error?: string; logs: string[]; timelineVersion: number; videoUrl: string | null };
type Detail = {
  project: { id: string; title: string; preset: RecapPreset; aspect: Aspect; status: 'planning' | 'ready' | 'failed'; version: number; error?: string; soundtrack: { kind: string } };
  timeline: RecapTimeline | null;
  versions: number[];
  analysis: { bpm: number; tempoConfidence: number; highlights: { startMs: number; endMs: number; reason: string }[] } | null;
  workerOnline: boolean;
  jobs: Job[];
  assets: Asset[];
  excluded: { id: string; reason: string }[];
};

const ACTIVE = ['queued', 'analyzing', 'planning', 'preview', 'rendering'];
const fmt = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;

export default function RecapPage() {
  const { snap } = useParty();
  const eventId = snap.event.id;
  const mod = snap.me.role === 'host' || snap.me.role === 'cohost';
  const [projects, setProjects] = useState<{ id: string; status: string; preset: string; aspect: string; createdAt: string }[] | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    const r = await api<{ projects: { id: string; status: string; preset: string; aspect: string; createdAt: string }[] }>('GET', `/api/events/${eventId}/recaps`);
    setProjects(r.projects);
    setProjectId((cur) => cur ?? r.projects[0]?.id ?? null);
  }, [eventId]);
  useEffect(() => {
    if (mod) void loadList();
  }, [mod, loadList]);

  if (!mod) return <Empty title="Host only">The host and co-hosts build the party recap. You&apos;ll be able to watch it once it&apos;s shared.</Empty>;
  if (!projects) return <Spinner />;

  return (
    <div className="space-y-6">
      {projectId ? (
        <RecapEditor key={projectId} projectId={projectId} onNew={() => setProjectId(null)} />
      ) : (
        <RecapSetup
          eventId={eventId}
          hasPrevious={projects.length > 0}
          onBack={() => setProjectId(projects[0]?.id ?? null)}
          onCreated={async (id) => {
            await loadList();
            setProjectId(id);
          }}
        />
      )}
      {projects.length > 1 && projectId && (
        <details className="text-sm text-ink-300">
          <summary className="cursor-pointer">Other recaps ({projects.length - 1})</summary>
          <ul className="mt-2 space-y-1">
            {projects
              .filter((p) => p.id !== projectId)
              .map((p) => (
                <li key={p.id}>
                  <button className="underline" onClick={() => setProjectId(p.id)}>
                    {p.preset} · {p.aspect} · {new Date(p.createdAt).toLocaleString()} ({p.status})
                  </button>
                </li>
              ))}
          </ul>
        </details>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
function RecapSetup({ eventId, onCreated, hasPrevious, onBack }: { eventId: string; onCreated: (id: string) => void; hasPrevious: boolean; onBack: () => void }) {
  const [tracks, setTracks] = useState<Soundtracks | null>(null);
  const [preset, setPreset] = useState<RecapPreset>('quick');
  const [aspect, setAspect] = useState<Aspect>('9:16');
  const [length, setLength] = useState(45);
  const [pick, setPick] = useState<string>('demo:neon-static');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rights, setRights] = useState(false);
  const [upPct, setUpPct] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => api<Soundtracks>('GET', `/api/events/${eventId}/recaps?soundtracks=1`).then(setTracks), [eventId]);
  useEffect(() => void load(), [load]);
  useEffect(() => {
    const r = PRESET_LENGTH_MS[preset];
    setLength(Math.round(r.default / 1000));
  }, [preset]);

  const range = PRESET_LENGTH_MS[preset];

  const uploadAudio = async (f: File) => {
    setErr(null);
    const mime = f.type || ({ mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', flac: 'audio/flac', m4a: 'audio/mp4' } as Record<string, string>)[f.name.split('.').pop()?.toLowerCase() ?? ''] || '';
    try {
      if (!rights) throw new Error('Tick the box to confirm you have the rights to use this audio.');
      const i = await api<{ mediaId: string; uploadUrl: string }>('POST', `/api/events/${eventId}/media/upload-intent`, { fileName: f.name, mime, size: f.size, rightsAttested: true });
      setUpPct(0);
      await uploadWithProgress(i.uploadUrl, f, mime, setUpPct);
      await api('POST', `/api/events/${eventId}/media/complete`, { mediaId: i.mediaId });
      await load();
      setPick(`upload:${i.mediaId}`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setUpPct(null);
    }
  };

  const create = async () => {
    setBusy(true);
    setErr(null);
    try {
      const soundtrack = pick.startsWith('demo:') ? { kind: 'demo', id: pick.slice(5) } : { kind: 'upload', mediaId: pick.slice(7), rightsAttested: true };
      const r = await api<{ projectId: string }>('POST', `/api/events/${eventId}/recaps`, { preset, aspect, targetMs: length * 1000, soundtrack });
      onCreated(r.projectId);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };

  if (!tracks) return <Spinner />;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-4 rounded-2xl border border-ink-700 bg-ink-900 p-5">
        <h2 className="font-display text-3xl tracking-wide uppercase">New recap</h2>
        <div>
          <p className="mb-1.5 text-sm text-ink-300">Length</p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button key={p} onClick={() => setPreset(p)} aria-pressed={preset === p} className={clsx('rounded-full border px-4 py-2 text-sm font-semibold capitalize', preset === p ? 'border-signal bg-signal text-white' : 'border-ink-600 text-ink-200')}>
                {p === 'quick' ? 'Quick (30–60s)' : p === 'highlight' ? 'Highlight (1–3 min)' : 'Extended'}
              </button>
            ))}
          </div>
          <label className="mt-3 block text-sm">
            <span className="text-ink-300">Target: {length}s</span>
            <input type="range" className="seek mt-1" min={Math.ceil(range.min / 1000)} max={Math.floor(range.max / 1000)} value={length} onChange={(e) => setLength(Number(e.target.value))} style={{ ['--pct' as string]: `${((length - range.min / 1000) / ((range.max - range.min) / 1000)) * 100}%` }} />
          </label>
        </div>
        <div>
          <p className="mb-1.5 text-sm text-ink-300">Shape</p>
          <div className="flex gap-2">
            {ASPECTS.map((a) => (
              <button key={a} onClick={() => setAspect(a)} aria-pressed={aspect === a} className={clsx('rounded-full border px-4 py-2 text-sm font-semibold', aspect === a ? 'border-bone bg-bone text-ink-950' : 'border-ink-600 text-ink-200')}>
                {a} {a === '9:16' ? 'Stories' : a === '1:1' ? 'Square' : 'Wide'}
              </button>
            ))}
          </div>
        </div>
        {err && (
          <p role="alert" className="text-sm text-red-300">
            {err}
          </p>
        )}
        <div className="flex gap-2">
          <Button variant="primary" onClick={() => void create()} disabled={busy}>
            {busy ? <Spinner /> : <Clapperboard size={16} />} Plan my recap
          </Button>
          {hasPrevious && <Button onClick={onBack}>Back</Button>}
        </div>
        {!tracks.workerOnline && (
          <p className="rounded-lg border border-sun/40 bg-sun/10 p-3 text-sm text-sun">
            The media worker isn&apos;t running. Start it in another terminal with <code>pnpm worker</code> (or run <code>pnpm dev:all</code>). Jobs wait in the queue until it connects.
          </p>
        )}
      </section>

      <section className="space-y-4 rounded-2xl border border-ink-700 bg-ink-900 p-5">
        <h2 className="font-display text-3xl tracking-wide uppercase">Soundtrack</h2>
        <fieldset className="space-y-1.5">
          <legend className="sr-only">Choose a soundtrack</legend>
          {tracks.demo.map((d) => (
            <label key={d.id} className="flex cursor-pointer items-start gap-2 rounded-lg p-2 hover:bg-ink-850">
              <input type="radio" name="st" checked={pick === `demo:${d.id}`} onChange={() => setPick(`demo:${d.id}`)} className="mt-1 accent-[var(--color-signal)]" />
              <span>
                <span className="block font-semibold">{d.title}</span>
                <span className="text-xs text-ink-400">{d.license}</span>
              </span>
            </label>
          ))}
          {tracks.uploads.map((u) => (
            <label key={u.id} className="flex cursor-pointer items-start gap-2 rounded-lg p-2 hover:bg-ink-850">
              <input type="radio" name="st" checked={pick === `upload:${u.id}`} onChange={() => setPick(`upload:${u.id}`)} className="mt-1 accent-[var(--color-signal)]" />
              <span>
                <span className="block font-semibold">{u.title}</span>
                <span className="text-xs text-ink-400">Uploaded by you · rights attested</span>
              </span>
            </label>
          ))}
        </fieldset>
        <div className="rounded-xl border border-ink-700 p-3">
          <p className="mb-2 text-sm font-semibold">Use your own audio</p>
          <label className="mb-2 flex items-start gap-2 text-sm text-ink-300">
            <input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--color-signal)]" />I own this audio or have the rights to use it in a video (including sync rights).
          </label>
          <input ref={fileRef} type="file" accept="audio/*,.mp3,.wav,.flac,.m4a,.ogg" className="sr-only" onChange={(e) => e.target.files?.[0] && void uploadAudio(e.target.files[0])} />
          <Button size="sm" onClick={() => fileRef.current?.click()} disabled={!rights || upPct !== null}>
            <Upload size={14} /> {upPct !== null ? `Uploading ${upPct}%` : 'Choose an audio file'}
          </Button>
        </div>
        <p className="rounded-lg bg-ink-850 p-3 text-xs text-ink-300">
          <strong>Why not Spotify?</strong> {tracks.spotify.reason}
        </p>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------
function RecapEditor({ projectId, onNew }: { projectId: string; onNew: () => void }) {
  const { snap } = useParty();
  const [d, setD] = useState<Detail | null>(null);
  const [draft, setDraft] = useState<RecapTimeline | null>(null);
  const [dirty, setDirty] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const dirtyRef = useRef(false);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  const load = useCallback(async () => {
    try {
      const r = await api<Detail>('GET', `/api/recaps/${projectId}`);
      setD(r);
      if (!dirtyRef.current) setDraft(r.timeline);
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [projectId]);

  useEffect(() => void load(), [load, snap.seq]);
  const active = d?.jobs.some((j) => ACTIVE.includes(j.status));
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => void load(), 1500);
    return () => clearInterval(t);
  }, [active, load]);

  const assets = useMemo(() => new Map((d?.assets ?? []).map((a) => [a.id, a])), [d]);
  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      setDirty(false);
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!d) return err ? <p className="text-red-300">{err}</p> : <Spinner />;
  const planJob = d.jobs.find((j) => j.type === 'plan');
  const runningPlan = d.project.status === 'planning';
  const tl = draft;
  const selected = tl?.clips.find((c) => c.id === sel) ?? null;

  const edit = (fn: (t: RecapTimeline) => RecapTimeline) => {
    if (!tl) return;
    setDraft(fn(structuredClone(tl)));
    setDirty(true);
  };
  const setClip = (id: string, patch: Partial<Clip>) => edit((t) => ({ ...t, clips: t.clips.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  const removeClip = (id: string) =>
    edit((t) => {
      if (t.clips.length <= 1) return t;
      const i = t.clips.findIndex((c) => c.id === id);
      const gone = t.clips[i]!;
      // the neighbour absorbs the time, so every other cut stays on its beat
      const into = i > 0 ? i - 1 : 1;
      const clips = t.clips.filter((c) => c.id !== id).map((c) => (c === t.clips[into] ? { ...c, durationMs: c.durationMs + gone.durationMs, timelineStartMs: i === 0 ? gone.timelineStartMs : c.timelineStartMs } : c));
      return { ...t, clips };
    });
  const swap = (id: string, a: Asset) =>
    setClip(id, { assetId: a.id, mediaType: a.mediaType, sourceInMs: 0, sourceOutMs: a.mediaType === 'video' ? Math.min(a.durationMs ?? 3000, tl!.clips.find((c) => c.id === id)!.durationMs) : tl!.clips.find((c) => c.id === id)!.durationMs, pinned: a.mustInclude });
  const shiftAudio = (barDir: number) => {
    if (!tl || !d.analysis) return;
    const beat = 60000 / d.analysis.bpm;
    edit((t) => ({ ...t, audio: { ...t.audio, sourceInMs: Math.max(0, Math.round(t.audio.sourceInMs + barDir * beat * 4)), sourceOutMs: Math.max(0, Math.round(t.audio.sourceOutMs + barDir * beat * 4)) } }));
  };

  const save = () => act(() => api('PATCH', `/api/recaps/${projectId}/timeline`, { timeline: tl, baseVersion: d.project.version }));
  const restore = (v: number) => act(() => api('POST', `/api/recaps/${projectId}/timeline`, { version: v }));
  const regen = () => {
    if (!tl) return;
    const idx = sel ? tl.clips.findIndex((c) => c.id === sel) : 0;
    const from = tl.clips[Math.max(0, idx)]!.timelineStartMs;
    const to = tl.clips[Math.min(tl.clips.length - 1, Math.max(0, idx) + 3)]!.timelineStartMs + tl.clips[Math.min(tl.clips.length - 1, Math.max(0, idx) + 3)]!.durationMs;
    return act(() => api('POST', `/api/recaps/${projectId}/regenerate`, { fromMs: from, toMs: to }));
  };
  const render = (type: 'preview' | 'final') => act(() => api('POST', `/api/recaps/${projectId}/render`, { type }));
  const cancel = (id: string) => act(() => api('POST', `/api/jobs/${id}`));

  const latestPreview = d.jobs.find((j) => j.type === 'preview' && j.status === 'complete' && j.videoUrl);
  const latestFinal = d.jobs.find((j) => j.type === 'final' && j.status === 'complete' && j.videoUrl);
  const rendering = d.jobs.filter((j) => j.type !== 'plan' && ACTIVE.includes(j.status));
  const idx = d.versions.indexOf(d.project.version);
  const prevV = idx > 0 ? d.versions[idx - 1] : undefined;
  const nextV = idx >= 0 && idx < d.versions.length - 1 ? d.versions[idx + 1] : undefined;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone={d.project.status === 'ready' ? 'good' : d.project.status === 'failed' ? 'bad' : 'warn'}>{d.project.status}</Chip>
        <Chip>{d.project.preset}</Chip>
        <Chip>{d.project.aspect}</Chip>
        {d.analysis && <Chip>{d.analysis.bpm} BPM</Chip>}
        <span className="text-xs text-ink-400">version {d.project.version}</span>
        <span className={clsx('inline-flex items-center gap-1.5 text-xs', d.workerOnline ? 'text-aqua' : 'text-ink-400')}>
          <span className={clsx('h-2 w-2 rounded-full', d.workerOnline ? 'bg-aqua' : 'bg-ink-500')} />
          worker {d.workerOnline ? 'online' : 'offline'}
        </span>
        <Button size="sm" className="ml-auto" onClick={onNew}>
          New recap
        </Button>
      </div>

      {err && (
        <p role="alert" className="rounded-lg border border-red-500/30 bg-red-950/40 p-3 text-sm text-red-200">
          {err}
        </p>
      )}

      {runningPlan && planJob && (
        <section className="rounded-2xl border border-ink-700 bg-ink-900 p-5" aria-live="polite">
          <p className="mb-2 font-semibold">
            {planJob.status === 'queued' ? (d.workerOnline ? 'Waiting for the worker…' : 'Waiting for the media worker. Run `pnpm worker`.') : planJob.status === 'analyzing' ? 'Analysing the music and checking your media…' : 'Planning the edit…'}
          </p>
          <Progress pct={planJob.progress} />
          <p className="mt-2 text-xs text-ink-400">{planJob.logs.at(-1)}</p>
        </section>
      )}
      {d.project.status === 'failed' && (
        <section className="rounded-2xl border border-red-500/40 bg-red-950/30 p-5">
          <p className="font-semibold text-red-200">Planning failed</p>
          <p className="text-sm text-red-200">{d.project.error ?? planJob?.error}</p>
          <Button className="mt-3" size="sm" onClick={onNew}>
            Try different settings
          </Button>
        </section>
      )}

      {tl && (
        <>
          {tl.notes.length > 0 && (
            <ul className="space-y-1 rounded-xl border border-ink-700 bg-ink-900 p-4 text-sm text-ink-300">
              {tl.notes.map((n, i) => (
                <li key={i}>• {n}</li>
              ))}
            </ul>
          )}

          <section className="rounded-2xl border border-ink-700 bg-ink-900 p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h3 className="font-display text-2xl tracking-wide uppercase">Timeline · {fmt(tl.durationMs)}</h3>
              <span className="text-xs text-ink-400">
                {tl.audio.title ?? 'soundtrack'} · {tl.audio.license}
              </span>
              <div className="ml-auto flex items-center gap-1">
                <Button size="sm" variant="ghost" onClick={() => prevV && void restore(prevV)} disabled={!prevV || busy} aria-label="Undo">
                  <Undo2 size={14} />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => nextV && void restore(nextV)} disabled={!nextV || busy} aria-label="Redo">
                  <Redo2 size={14} />
                </Button>
                <Button size="sm" onClick={() => void regen()} disabled={busy} title="Re-pick media for the selected clip and the next three">
                  <RefreshCcw size={14} /> Regenerate section
                </Button>
                <Button size="sm" variant="primary" onClick={() => void save()} disabled={!dirty || busy}>
                  <Save size={14} /> Save
                </Button>
              </div>
            </div>

            <div className="flex gap-1 overflow-x-auto pb-2" role="listbox" aria-label="Clips">
              {tl.clips.map((c) => {
                const a = assets.get(c.assetId);
                return (
                  <button
                    key={c.id}
                    role="option"
                    aria-selected={sel === c.id}
                    onClick={() => setSel(c.id)}
                    style={{ width: Math.max(64, (c.durationMs / tl.durationMs) * 900) }}
                    className={clsx('relative h-24 shrink-0 overflow-hidden rounded-lg border-2 bg-ink-800', sel === c.id ? 'border-signal' : 'border-transparent')}
                    title={`${fmt(c.timelineStartMs)} · ${(c.durationMs / 1000).toFixed(1)}s · ${c.contributor ?? ''}`}
                  >
                    {a &&
                      (a.mediaType === 'image' ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={a.url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <video src={a.url} muted preload="metadata" className="h-full w-full object-cover" />
                      ))}
                    {!a && <span className="absolute inset-0 flex items-center justify-center text-xs text-red-300">missing</span>}
                    {c.pinned && <Star size={12} className="absolute top-1 left-1 text-sun" fill="currentColor" />}
                    {c.transition.type !== 'cut' && <span className="absolute top-1 right-1 rounded bg-black/70 px-1 text-[9px] uppercase">{c.transition.type}</span>}
                    <span className="absolute inset-x-0 bottom-0 bg-black/60 px-1 text-[10px]">{(c.durationMs / 1000).toFixed(1)}s</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-1 flex h-4 overflow-hidden rounded bg-ink-800" aria-hidden>
              {tl.audio.beatTimesMs.slice(0, 400).map((b) => (
                <span key={b} className="absolute h-4 w-px bg-ink-600" style={{ marginLeft: `${(b / tl.durationMs) * 100}%` }} />
              ))}
            </div>
            <p className="mt-1 text-xs text-ink-400">Every cut lands on a beat. Replacing or removing a clip keeps that sync.</p>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-ink-300">Song section</span>
              <Button size="sm" onClick={() => shiftAudio(-1)} disabled={tl.audio.sourceInMs <= 0}>
                ← 1 bar earlier
              </Button>
              <Button size="sm" onClick={() => shiftAudio(1)}>1 bar later →</Button>
              <span className="text-xs text-ink-400">
                {fmt(tl.audio.sourceInMs)}–{fmt(tl.audio.sourceOutMs)} of the song. Shifting moves the music, not the cuts: preview to confirm.
              </span>
            </div>
          </section>

          {selected && (
            <section className="rounded-2xl border border-signal/40 bg-ink-900 p-4" aria-label="Selected clip">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <h3 className="font-display text-xl tracking-wide uppercase">
                  Clip {tl.clips.findIndex((c) => c.id === selected.id) + 1} · {fmt(selected.timelineStartMs)} · {(selected.durationMs / 1000).toFixed(1)}s
                </h3>
                <span className="text-xs text-ink-400">by {selected.contributor}</span>
                <button className="ml-auto text-ink-400 hover:text-bone" aria-label="Close" onClick={() => setSel(null)}>
                  <X size={16} />
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <label className="inline-flex items-center gap-1.5">
                  <input type="checkbox" checked={selected.pinned} onChange={(e) => setClip(selected.id, { pinned: e.target.checked })} className="accent-[var(--color-signal)]" /> Pin (keep when regenerating)
                </label>
                <label className="inline-flex items-center gap-1.5">
                  Transition
                  <select value={selected.transition.type} onChange={(e) => setClip(selected.id, { transition: { type: e.target.value as Clip['transition']['type'], durationMs: e.target.value === 'cut' ? 0 : e.target.value === 'flash' ? 180 : 240 } })} className="h-8 rounded-lg border border-ink-600 bg-ink-850 px-2">
                    <option value="cut">Cut</option>
                    <option value="dip">Dip to black</option>
                    <option value="flash">Flash</option>
                  </select>
                </label>
                <label className="inline-flex items-center gap-1.5">
                  Motion
                  <select value={selected.crop.zoom} onChange={(e) => setClip(selected.id, { crop: { ...selected.crop, zoom: e.target.value as Clip['crop']['zoom'] } })} className="h-8 rounded-lg border border-ink-600 bg-ink-850 px-2">
                    <option value="in">Slow zoom in</option>
                    <option value="out">Slow zoom out</option>
                    <option value="none">Still</option>
                  </select>
                </label>
                {selected.mediaType === 'video' && (
                  <label className="inline-flex items-center gap-1.5">
                    Start at {(selected.sourceInMs / 1000).toFixed(1)}s
                    <input
                      type="range"
                      className="seek w-32"
                      min={0}
                      max={Math.max(0, (assets.get(selected.assetId)?.durationMs ?? 5000) - 500)}
                      step={100}
                      value={selected.sourceInMs}
                      onChange={(e) => {
                        const start = Number(e.target.value);
                        const total = assets.get(selected.assetId)?.durationMs ?? start + selected.durationMs;
                        setClip(selected.id, { sourceInMs: start, sourceOutMs: Math.min(total, start + selected.durationMs) });
                      }}
                    />
                  </label>
                )}
                <Button size="sm" variant="danger" onClick={() => removeClip(selected.id)} disabled={tl.clips.length <= 1}>
                  <Trash2 size={14} /> Remove clip
                </Button>
              </div>
              <p className="mt-3 mb-1.5 text-sm text-ink-300">Swap in a different photo or video</p>
              <ul className="flex gap-1.5 overflow-x-auto pb-1">
                {d.assets
                  .filter((a) => a.usable || a.mustInclude)
                  .map((a) => (
                    <li key={a.id} className="shrink-0">
                      <button onClick={() => swap(selected.id, a)} className={clsx('h-16 w-16 overflow-hidden rounded-lg border-2', a.id === selected.assetId ? 'border-signal' : 'border-transparent')} aria-label={`Use this ${a.mediaType}`}>
                        {a.mediaType === 'image' ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={a.url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <video src={a.url} muted preload="metadata" className="h-full w-full object-cover" />
                        )}
                      </button>
                    </li>
                  ))}
              </ul>
            </section>
          )}

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-ink-700 bg-ink-900 p-4">
              <h3 className="mb-2 font-display text-2xl tracking-wide uppercase">Render</h3>
              {dirty && <p className="mb-2 text-sm text-sun">Save your edits first. Renders use the saved version.</p>}
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void render('preview')} disabled={busy || dirty}>
                  Preview (540p)
                </Button>
                <Button variant="primary" onClick={() => void render('final')} disabled={busy || dirty}>
                  <Clapperboard size={16} /> Final render
                </Button>
              </div>
              {rendering.map((j) => (
                <div key={j.id} className="mt-3" aria-live="polite">
                  <div className="mb-1 flex items-center gap-2 text-sm">
                    <span className="capitalize">
                      {j.type} · {j.status}
                      {j.attempts > 1 ? ` (attempt ${j.attempts}/${j.maxAttempts})` : ''}
                    </span>
                    <button className="ml-auto text-xs text-red-300 underline" onClick={() => void cancel(j.id)}>
                      cancel
                    </button>
                  </div>
                  <Progress pct={j.progress} />
                  {j.error && <p className="mt-1 text-xs text-sun">Last error: {j.error}. Retrying…</p>}
                </div>
              ))}
              {d.jobs
                .filter((j) => j.type !== 'plan' && j.status === 'failed')
                .slice(0, 2)
                .map((j) => (
                  <p key={j.id} className="mt-2 text-sm text-red-300">
                    {j.type} failed after {j.attempts} attempts: {j.error}
                  </p>
                ))}
            </div>
            <div className="rounded-2xl border border-ink-700 bg-ink-900 p-4">
              <h3 className="mb-2 font-display text-2xl tracking-wide uppercase">Result</h3>
              {!latestPreview && !latestFinal && <p className="text-sm text-ink-400">Render a preview to watch it here.</p>}
              {(latestFinal ?? latestPreview) && (
                <>
                  <video key={(latestFinal ?? latestPreview)!.videoUrl!} src={(latestFinal ?? latestPreview)!.videoUrl!} controls playsInline className="mx-auto max-h-[60vh] w-full rounded-xl bg-black" />
                  <div className="mt-2 flex flex-wrap gap-2 text-sm">
                    {latestPreview && (
                      <a className="inline-flex items-center gap-1 underline" href={latestPreview.videoUrl!} download="recap-preview.mp4">
                        <Download size={14} /> Preview (540p)
                      </a>
                    )}
                    {latestFinal && (
                      <a className="inline-flex items-center gap-1 underline" href={latestFinal.videoUrl!} download="recap-final.mp4">
                        <Download size={14} /> Final (full quality)
                      </a>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-ink-400">Stored privately. Links expire after 10 minutes and are re-issued when you reload. Photo metadata (including location) is stripped from the video.</p>
                </>
              )}
            </div>
          </section>
        </>
      )}

      {d.excluded.length > 0 && (
        <details className="text-sm text-ink-300">
          <summary className="cursor-pointer">{d.excluded.length} item(s) not eligible for the recap</summary>
          <ul className="mt-2 space-y-0.5">
            {Object.entries(d.excluded.reduce<Record<string, number>>((acc, x) => ((acc[x.reason] = (acc[x.reason] ?? 0) + 1), acc), {})).map(([r, n]) => (
              <li key={r}>
                {n} · {r}
              </li>
            ))}
          </ul>
        </details>
      )}
      {d.assets.some((a) => !a.usable) && (
        <details className="text-sm text-ink-300">
          <summary className="cursor-pointer">{d.assets.filter((a) => !a.usable).length} item(s) skipped automatically</summary>
          <ul className="mt-2 space-y-0.5">
            {d.assets
              .filter((a) => !a.usable)
              .map((a) => (
                <li key={a.id}>
                  {a.mediaType} · {a.reason}
                </li>
              ))}
          </ul>
          <p className="mt-1 text-xs text-ink-400">Similarity is a suggestion, not a verdict: star a photo in the Gallery to force it in.</p>
        </details>
      )}
    </div>
  );
}

function Progress({ pct }: { pct: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-ink-700" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full bg-signal transition-[width] duration-500" style={{ width: `${pct}%` }} />
    </div>
  );
}
