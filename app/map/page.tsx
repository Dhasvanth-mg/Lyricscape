'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Play, Trash2 } from 'lucide-react';
import { api, useMe } from '@/lib/party/client';
import type { MapSettings, MemoryDto, SessionDto, TripDto } from '@/lib/map/schemas';
import { loadDemoCatalog } from '@/lib/player/providers';
import { player } from '@/lib/player/controller';
import { playerTrackFromRef } from '@/lib/party/tracks';
import type { Track } from '@/lib/types';
import { MapView, type MapPlace } from '@/components/map/MapView';
import { MemoriesPanel, PrivacyPanel, TripsPanel } from '@/components/map/panels';
import { Button, Chip, Empty, PageHeader, Spinner } from '@/components/ui/bits';

const DEFAULT_SETTINGS: MapSettings = { enabled: false, paused: false, precision: 'approx', retentionDays: 365, zones: [] };
const DAY = 86_400_000;

export default function MapPage() {
  const { me } = useMe();
  const [settings, setSettings] = useState<MapSettings>(DEFAULT_SETTINGS);
  const [available, setAvailable] = useState(true);
  const [sessions, setSessions] = useState<SessionDto[]>([]);
  const [memories, setMemories] = useState<MemoryDto[]>([]);
  const [trips, setTrips] = useState<TripDto[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [windowDays, setWindowDays] = useState<number>(0); // 0 = all time
  const [upTo, setUpTo] = useState<number>(100); // slider 0..100 along the timeline
  const [loading, setLoading] = useState(true);
  const [catalog, setCatalog] = useState<Track[]>([]);
  const [nowTs] = useState(() => Date.now());

  const load = useCallback(async () => {
    try {
      const [s, ses, mem, tr] = await Promise.all([
        api<{ available: boolean; settings: MapSettings }>('GET', '/api/map/settings'),
        api<{ sessions: SessionDto[] }>('GET', '/api/map/sessions'),
        api<{ memories: MemoryDto[] }>('GET', '/api/memories'),
        api<{ trips: TripDto[] }>('GET', '/api/map/trips'),
      ]);
      setAvailable(s.available);
      setSettings(s.settings);
      setSessions(ses.sessions);
      setMemories(mem.memories);
      setTrips(tr.trips);
    } catch {
      /* signed out */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (me === undefined) return;
    if (me === null) return setLoading(false);
    void load();
    void loadDemoCatalog().then(setCatalog).catch(() => undefined);
  }, [me, load]);

  // ---- time filtering -------------------------------------------------------------------
  const { min, max } = useMemo(() => {
    const ts = sessions.map((s) => Date.parse(s.startedAt));
    return { min: ts.length ? Math.min(...ts) : nowTs - DAY, max: ts.length ? Math.max(...ts) : nowTs };
  }, [sessions, nowTs]);
  const cutoffHigh = min + ((max - min) * upTo) / 100 + (upTo >= 100 ? 1000 : 0);
  const cutoffLow = windowDays ? cutoffHigh - windowDays * DAY : -Infinity;
  const visible = useMemo(() => sessions.filter((s) => s.place && Date.parse(s.startedAt) <= cutoffHigh && Date.parse(s.startedAt) >= cutoffLow), [sessions, cutoffHigh, cutoffLow]);

  const places = useMemo(() => {
    const byId = new Map<string, MapPlace & { tracks: Map<string, SessionDto>; last: string }>();
    for (const s of visible) {
      const p = s.place!;
      const cur = byId.get(p.id) ?? { id: p.id, lat: p.lat, lng: p.lng, precisionM: p.precisionM, count: 0, tracks: new Map(), last: s.startedAt };
      cur.count++;
      if (!cur.tracks.has(s.trackKey)) cur.tracks.set(s.trackKey, s);
      if (s.startedAt > cur.last) cur.last = s.startedAt;
      byId.set(p.id, cur);
    }
    return [...byId.values()].sort((a, b) => b.last.localeCompare(a.last));
  }, [visible]);

  const sel = places.find((p) => p.id === selected) ?? null;
  const selSessions = sel ? visible.filter((s) => s.place?.id === sel.id) : [];

  const playSession = async (s: SessionDto) => {
    const t = playerTrackFromRef(s.track, catalog);
    if (t) await player.playTrack(t);
  };

  const wipe = async () => {
    await api('DELETE', '/api/map/sessions?confirm=all');
    setSelected(null);
    await load();
  };

  return (
    <div>
      <PageHeader eyebrow="Remember" title="Music map">
        <Chip tone="good">Private · approximate · opt-in</Chip>
      </PageHeader>

      {loading && <Spinner />}
      {!loading && me === null && (
        <Empty
          title="Sign in to use the map"
          action={
            <Link href="/login?next=/map" className="inline-flex h-10 items-center rounded-full bg-bone px-5 text-sm font-semibold text-ink-950">
              Pick a profile
            </Link>
          }
        >
          Your listening spots belong to your local profile. They are never public and never leave this machine.
        </Empty>
      )}
      {!loading && me && !available && <Empty title="Location history is disabled">Set ENABLE_LOCATION_HISTORY=true to use it.</Empty>}

      {me && available && !loading && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)]">
          <div className="min-w-0 space-y-4">
            <div className="relative h-[52vh] min-h-[340px] overflow-hidden rounded-2xl border border-ink-700 bg-ink-900">
              <MapView places={places} selectedId={selected} onSelect={setSelected} className="absolute inset-0" />
              {settings.enabled && places.length === 0 && (
                <p className="pointer-events-none absolute inset-x-6 top-4 rounded-lg bg-black/60 p-3 text-center text-sm backdrop-blur">
                  {sessions.length ? 'No spots in this time range.' : 'Nothing recorded yet. Play a song with this tab open and location allowed.'}
                </p>
              )}
            </div>

            {sessions.length > 0 && (
              <div className="rounded-2xl border border-ink-700 bg-ink-900 p-4">
                <div className="mb-2 flex flex-wrap items-center gap-3 text-sm">
                  <span className="font-semibold">Time</span>
                  <select value={windowDays} onChange={(e) => setWindowDays(Number(e.target.value))} className="h-8 rounded-lg border border-ink-600 bg-ink-850 px-2 text-xs" aria-label="Window">
                    <option value={0}>All time</option>
                    <option value={7}>7-day window</option>
                    <option value={30}>30-day window</option>
                    <option value={365}>1-year window</option>
                  </select>
                  <span className="ml-auto font-mono text-xs text-ink-300">up to {new Date(cutoffHigh).toLocaleDateString()}</span>
                </div>
                <input type="range" className="seek" aria-label="Scrub through time" min={0} max={100} value={upTo} style={{ ['--pct' as string]: `${upTo}%` }} onChange={(e) => setUpTo(Number(e.target.value))} />
                <p className="mt-1 text-xs text-ink-400">
                  {visible.length} spots · {places.length} places
                </p>
              </div>
            )}

            {sel && (
              <section className="rounded-2xl border border-ink-700 bg-ink-900 p-4" aria-label="Selected place">
                <div className="mb-2 flex items-center gap-2">
                  <h3 className="font-display text-2xl tracking-wide uppercase">Around {sel.lat.toFixed(2)}, {sel.lng.toFixed(2)}</h3>
                  <Chip>±{Math.round(sel.precisionM / 100) / 10} km</Chip>
                  <button
                    className="ml-auto inline-flex items-center gap-1 text-xs text-red-300 underline"
                    onClick={async () => {
                      if (!confirm('Hide this place? Every spot recorded here is deleted.')) return;
                      await api('DELETE', `/api/map/places/${sel.id}`);
                      setSelected(null);
                      await load();
                    }}
                  >
                    <Trash2 size={12} /> hide this place
                  </button>
                </div>
                <ul className="space-y-1">
                  {selSessions.slice(0, 40).map((s) => (
                    <li key={s.id} className="flex items-center gap-2 text-sm">
                      <button aria-label={`Play ${s.track.title}`} className="text-ink-300 hover:text-bone disabled:opacity-30" disabled={!playerTrackFromRef(s.track, catalog)} onClick={() => void playSession(s)}>
                        <Play size={14} />
                      </button>
                      <span className="min-w-0 flex-1 truncate">
                        {s.track.title} <span className="text-ink-400">· {s.track.artists[0]}</span>
                      </span>
                      <span className="font-mono text-[11px] text-ink-400">{new Date(s.startedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                      <button aria-label="Delete this spot" className="text-ink-400 hover:text-red-300" onClick={() => void api('DELETE', `/api/map/sessions/${s.id}`).then(load)}>
                        <Trash2 size={13} />
                      </button>
                    </li>
                  ))}
                </ul>
                {selSessions[0] && (
                  <Button size="sm" className="mt-3" onClick={() => void player.playQueue(selSessions.map((s) => playerTrackFromRef(s.track, catalog)).filter((t): t is Track => !!t), 0)}>
                    <Play size={14} /> Play this place&apos;s soundtrack
                  </Button>
                )}
              </section>
            )}

            {!sel && places.length > 0 && (
              <section className="rounded-2xl border border-ink-700 bg-ink-900 p-4" aria-label="Places">
                <h3 className="mb-2 font-display text-2xl tracking-wide uppercase">Places</h3>
                <ul className="grid gap-1 sm:grid-cols-2">
                  {places.slice(0, 20).map((p) => (
                    <li key={p.id}>
                      <button onClick={() => setSelected(p.id)} className="flex w-full items-center gap-2 rounded-lg p-2 text-left text-sm hover:bg-ink-850">
                        <span className="h-2.5 w-2.5 rounded-full bg-signal" />
                        <span className="flex-1">
                          {p.lat.toFixed(2)}, {p.lng.toFixed(2)}
                        </span>
                        <span className="font-mono text-xs text-ink-400">{p.count}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          <div className="space-y-6">
            <PrivacyPanel settings={settings} onChange={setSettings} onWipe={() => void wipe()} />
            <MemoriesPanel
              memories={memories}
              onChange={() => void load()}
              sessionForPlace={sel && selSessions[0] ? { sessionId: selSessions[0].id, placeLabel: `${sel.lat.toFixed(2)}, ${sel.lng.toFixed(2)}` } : null}
            />
            <TripsPanel trips={trips} onChange={() => void load()} />
          </div>
        </div>
      )}
    </div>
  );
}
