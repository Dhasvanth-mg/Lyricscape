'use client';

import { useState } from 'react';
import { Download, LockKeyhole, MapPin, Play, Trash2 } from 'lucide-react';
import type { MapSettings, MemoryDto, Precision, TripDto } from '@/lib/map/schemas';
import { PRECISION_GRID, PRECISIONS } from '@/lib/map/schemas';
import { api } from '@/lib/party/client';
import { playerTrackFromRef, refFromTrack } from '@/lib/party/tracks';
import { loadDemoCatalog } from '@/lib/player/providers';
import { player, usePlayer } from '@/lib/player/controller';
import { Button, Chip } from '@/components/ui/bits';
import { MAP_SETTINGS_EVENT } from './ListeningLogger';

const field = 'h-10 w-full rounded-lg border border-ink-600 bg-ink-850 px-3 text-sm outline-none focus:border-aqua';

function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('This browser has no location support.'));
    navigator.geolocation.getCurrentPosition(resolve, (e) => reject(new Error(e.code === 1 ? 'Location permission was denied. You can allow it in your browser’s site settings.' : 'Could not determine your location.')), { enableHighAccuracy: false, timeout: 10000, maximumAge: 60_000 });
  });
}

/** Resize a photo to a small JPEG data URL (<~150 KB) so it can be stored with a memory. */
async function toSmallJpeg(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 900 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  let q = 0.82;
  let url = c.toDataURL('image/jpeg', q);
  while (url.length > 220_000 && q > 0.3) {
    q -= 0.12;
    url = c.toDataURL('image/jpeg', q);
  }
  if (url.length > 280_000) throw new Error('That photo is too large to store as a memory.');
  return url;
}

export function PrivacyPanel({ settings, onChange, onWipe }: { settings: MapSettings; onChange: (s: MapSettings) => void; onWipe: () => void }) {
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [zone, setZone] = useState({ label: 'Home', radiusM: 500 });

  const patch = async (body: Record<string, unknown>) => {
    setErr(null);
    try {
      const r = await api<{ settings: MapSettings }>('PATCH', '/api/map/settings', body);
      onChange(r.settings);
      window.dispatchEvent(new Event(MAP_SETTINGS_EVENT));
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const turnOn = async () => {
    setBusy(true);
    setErr(null);
    try {
      await getPosition(); // the permission prompt happens here, in context, on the user's click
      await patch({ enabled: true, paused: false });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const addZoneHere = async () => {
    setBusy(true);
    setErr(null);
    try {
      const pos = await getPosition();
      await patch({ zones: [...settings.zones, { label: zone.label || 'Private place', lat: pos.coords.latitude, lng: pos.coords.longitude, radiusM: zone.radiusM }] });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const exportData = async () => {
    const res = await fetch('/api/me/export', { method: 'POST' });
    if (!res.ok) return setErr('Export failed.');
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lyricscape-export.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <section className="rounded-2xl border border-ink-700 bg-ink-900 p-5" aria-label="Privacy and capture">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="font-display text-2xl tracking-wide uppercase">Listening log</h3>
        {settings.enabled ? <Chip tone={settings.paused ? 'warn' : 'good'}>{settings.paused ? 'paused' : 'on'}</Chip> : <Chip>off</Chip>}
      </div>

      {!settings.enabled ? (
        <div className="space-y-3 text-sm text-ink-200">
          <p>
            Remember <strong>where</strong> you listened to songs. Private by default and only while this app is open and playing: your browser can&apos;t track you in the background, and nothing is ever filled in after the fact.
          </p>
          <ul className="list-disc space-y-1 pl-5 text-ink-300">
            <li>
              Only an <em>approximate area</em> is saved (you pick how fuzzy). The exact point is thrown away.
            </li>
            <li>Places you mark as private (home, work) are never recorded.</li>
            <li>Nothing is shared. You can pause, delete any spot, export, or wipe everything anytime.</li>
          </ul>
          <Button variant="primary" onClick={() => void turnOn()} disabled={busy}>
            <MapPin size={16} /> Turn on location history
          </Button>
        </div>
      ) : (
        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void patch({ paused: !settings.paused })}>
              {settings.paused ? 'Resume' : 'Pause'}
            </Button>
            <Button size="sm" variant="danger" onClick={() => void patch({ enabled: false })}>
              Turn off
            </Button>
          </div>
          <label className="block">
            <span className="mb-1 block text-ink-300">Precision</span>
            <select value={settings.precision} onChange={(e) => void patch({ precision: e.target.value as Precision })} className={field}>
              {PRECISIONS.map((p) => (
                <option key={p} value={p}>
                  {PRECISION_GRID[p].label}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-ink-400">Applies to new spots. Existing spots keep the precision they were saved with.</span>
          </label>
          <label className="block">
            <span className="mb-1 block text-ink-300">Keep history for</span>
            <select value={settings.retentionDays} onChange={(e) => void patch({ retentionDays: Number(e.target.value) })} className={field}>
              {[30, 90, 365, 1095].map((d) => (
                <option key={d} value={d}>
                  {d >= 365 ? `${d / 365} year${d > 365 ? 's' : ''}` : `${d} days`}
                </option>
              ))}
              {![30, 90, 365, 1095].includes(settings.retentionDays) && <option value={settings.retentionDays}>{settings.retentionDays} days</option>}
            </select>
          </label>
          <div>
            <p className="mb-1 text-ink-300">Private places (never recorded)</p>
            <ul className="mb-2 space-y-1">
              {settings.zones.map((z) => (
                <li key={z.id} className="flex items-center gap-2">
                  <LockKeyhole size={13} className="text-ink-400" />
                  <span className="flex-1">
                    {z.label} <span className="text-ink-400">· {z.radiusM} m</span>
                  </span>
                  <button aria-label={`Remove ${z.label}`} className="text-ink-400 hover:text-red-300" onClick={() => void patch({ zones: settings.zones.filter((x) => x.id !== z.id) })}>
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
              {settings.zones.length === 0 && <li className="text-ink-400">None yet.</li>}
            </ul>
            <div className="flex flex-wrap gap-2">
              <input value={zone.label} onChange={(e) => setZone({ ...zone, label: e.target.value })} className={field + ' max-w-[10rem]'} aria-label="Private place name" maxLength={60} />
              <select value={zone.radiusM} onChange={(e) => setZone({ ...zone, radiusM: Number(e.target.value) })} className={field + ' max-w-[7rem]'} aria-label="Radius">
                {[200, 500, 1000, 2000].map((r) => (
                  <option key={r} value={r}>
                    {r} m
                  </option>
                ))}
              </select>
              <Button size="sm" onClick={() => void addZoneHere()} disabled={busy}>
                Hide where I am now
              </Button>
            </div>
          </div>
        </div>
      )}

      {err && (
        <p role="alert" className="mt-3 text-sm text-red-300">
          {err}
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-2 border-t border-ink-700 pt-4">
        <Button size="sm" onClick={() => void exportData()}>
          <Download size={14} /> Export my data
        </Button>
        <Button
          size="sm"
          variant="danger"
          onClick={() => {
            if (confirm('Delete ALL map history, memories and trips? This cannot be undone.')) onWipe();
          }}
        >
          <Trash2 size={14} /> Delete all history
        </Button>
      </div>
    </section>
  );
}

export function MemoriesPanel({ memories, onChange, sessionForPlace }: { memories: MemoryDto[]; onChange: () => void; sessionForPlace: { sessionId: string; placeLabel: string } | null }) {
  const track = usePlayer((s) => s.track);
  const [caption, setCaption] = useState('');
  const [unlock, setUnlock] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [attach, setAttach] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<import('@/lib/types').Track[]>([]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!track) return;
    setErr(null);
    try {
      await api('POST', '/api/memories', {
        track: refFromTrack(track),
        caption,
        photo: photo ?? undefined,
        unlockAt: unlock ? new Date(unlock).toISOString() : undefined,
        sessionId: attach && sessionForPlace ? sessionForPlace.sessionId : undefined,
      });
      setCaption('');
      setUnlock('');
      setPhoto(null);
      onChange();
    } catch (x) {
      setErr((x as Error).message);
    }
  };

  const playMemory = async (m: MemoryDto) => {
    const cat = catalog.length ? catalog : await loadDemoCatalog().catch(() => []);
    setCatalog(cat);
    const t = playerTrackFromRef(m.track, cat);
    if (t) await player.playTrack(t);
  };

  return (
    <section className="rounded-2xl border border-ink-700 bg-ink-900 p-5" aria-label="Song memories">
      <h3 className="mb-3 font-display text-2xl tracking-wide uppercase">Song memories</h3>
      <form onSubmit={save} className="mb-4 space-y-2">
        <p className="text-sm text-ink-300">{track ? <>Attach a note to <strong>{track.title}</strong>, the song playing now.</> : 'Play a song to attach a memory to it.'}</p>
        <textarea value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={1000} rows={2} placeholder="Where were you? What did it feel like?" disabled={!track} className="w-full rounded-lg border border-ink-600 bg-ink-850 p-3 text-sm outline-none focus:border-aqua" />
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label className="inline-flex cursor-pointer items-center rounded-full border border-ink-600 px-3 py-1.5 hover:border-ink-400">
            Add photo
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (!f) return;
                try {
                  setPhoto(await toSmallJpeg(f));
                } catch (x) {
                  setErr((x as Error).message);
                }
              }}
            />
          </label>
          {photo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="Memory preview" className="h-9 w-9 rounded object-cover" />
          )}
          <label className="inline-flex items-center gap-1.5 text-ink-300">
            Seal until
            <input type="datetime-local" value={unlock} onChange={(e) => setUnlock(e.target.value)} className="h-9 rounded-lg border border-ink-600 bg-ink-850 px-2 text-xs" />
          </label>
        </div>
        {sessionForPlace && (
          <label className="flex items-center gap-2 text-sm text-ink-300">
            <input type="checkbox" checked={attach} onChange={(e) => setAttach(e.target.checked)} className="h-4 w-4 accent-[var(--color-signal)]" />
            Pin to the selected place ({sessionForPlace.placeLabel})
          </label>
        )}
        {err && (
          <p role="alert" className="text-sm text-red-300">
            {err}
          </p>
        )}
        <Button variant="primary" size="sm" type="submit" disabled={!track || !caption.trim()}>
          Save memory
        </Button>
      </form>

      <ul className="space-y-3">
        {memories.length === 0 && <li className="text-sm text-ink-400">No memories yet.</li>}
        {memories.map((m) => (
          <li key={m.id} className="flex gap-3 rounded-xl bg-ink-850 p-3">
            {m.photo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.photo} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
            )}
            <div className="min-w-0 flex-1 text-sm">
              <p className="flex items-center gap-1.5 font-semibold">
                {m.locked && <LockKeyhole size={13} className="text-sun" />}
                {m.track.title} <span className="font-normal text-ink-400">· {m.track.artists[0]}</span>
              </p>
              {m.locked ? <p className="text-ink-300">Sealed until {new Date(m.unlockAt!).toLocaleString()}</p> : <p className="text-ink-200">{m.caption}</p>}
              <p className="mt-1 text-xs text-ink-400">
                {new Date(m.capturedAt).toLocaleDateString()}
                {m.place ? ` · near ${m.place.lat.toFixed(2)}, ${m.place.lng.toFixed(2)}` : ''}
              </p>
            </div>
            <div className="flex flex-col items-center gap-1">
              {!m.locked && (
                <button aria-label="Play this song" className="text-ink-300 hover:text-bone" onClick={() => void playMemory(m)}>
                  <Play size={15} />
                </button>
              )}
              <button aria-label="Delete memory" className="text-ink-400 hover:text-red-300" onClick={() => confirm('Delete this memory?') && void api('DELETE', `/api/memories/${m.id}`).then(onChange)}>
                <Trash2 size={15} />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function TripsPanel({ trips, onChange }: { trips: TripDto[]; onChange: () => void }) {
  const [name, setName] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    try {
      await api('POST', '/api/map/trips', { name, startedAt: new Date(from).toISOString(), endedAt: new Date(to).toISOString() });
      setName('');
      onChange();
    } catch (x) {
      setErr((x as Error).message);
    }
  };

  const playTrip = async (t: TripDto) => {
    const cat = await loadDemoCatalog().catch(() => []);
    const tracks = t.tracks.map((r) => playerTrackFromRef(r, cat)).filter((x): x is import('@/lib/types').Track => !!x);
    if (tracks.length) await player.playQueue(tracks, 0);
    else setErr('None of this trip’s songs have a playable source on this device.');
  };

  return (
    <section className="rounded-2xl border border-ink-700 bg-ink-900 p-5" aria-label="Trips">
      <h3 className="mb-3 font-display text-2xl tracking-wide uppercase">Trips & soundtracks</h3>
      <form onSubmit={create} className="mb-4 grid gap-2 sm:grid-cols-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Trip name" required maxLength={80} className={field + ' sm:col-span-2'} aria-label="Trip name" />
        <input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} required className={field} aria-label="Trip start" />
        <input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} required className={field} aria-label="Trip end" />
        <Button size="sm" type="submit" className="sm:col-span-2" disabled={!name || !from || !to}>
          Create trip
        </Button>
      </form>
      {err && (
        <p role="alert" className="mb-2 text-sm text-red-300">
          {err}
        </p>
      )}
      <ul className="space-y-2">
        {trips.length === 0 && <li className="text-sm text-ink-400">Group listening spots by date range to get a soundtrack of the trip.</li>}
        {trips.map((t) => (
          <li key={t.id} className="flex items-center gap-3 rounded-xl bg-ink-850 p-3 text-sm">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{t.name}</p>
              <p className="text-xs text-ink-400">
                {new Date(t.startedAt).toLocaleDateString()} – {new Date(t.endedAt).toLocaleDateString()} · {t.tracks.length} songs · {t.sessionCount} spots
              </p>
            </div>
            <Button size="sm" onClick={() => void playTrip(t)} disabled={t.tracks.length === 0}>
              <Play size={14} /> Play
            </Button>
            <button aria-label={`Delete ${t.name}`} className="text-ink-400 hover:text-red-300" onClick={() => void api('DELETE', `/api/map/trips/${t.id}`).then(onChange)}>
              <Trash2 size={15} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
