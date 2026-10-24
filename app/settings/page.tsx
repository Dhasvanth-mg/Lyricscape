'use client';

import { useCallback, useEffect, useState } from 'react';
import { Copy, Check, X } from 'lucide-react';
import { GpuStatus } from '@/components/ui/GpuStatus';
import { usePlayer, player } from '@/lib/player/controller';
import { disconnect, getClientId, isLocalhostOrigin, redirectUri, setClientId, startLogin, SpotifyAuthError } from '@/lib/spotify/auth';
import { getDevices, getMe, SpotifyApiError, type SpotifyDevice, type SpotifyMe } from '@/lib/spotify/api';
import { explainSpotifyCapability, spotifyCapabilities } from '@/lib/player/providers';
import { getAutoFind, setAutoFind } from '@/lib/lyrics/service';
import { clearAllLocalData } from '@/lib/library/db';
import { STYLES } from '@/lib/kinetic/styles';
import { STYLE_IDS } from '@/lib/kinetic/types';
import { useUi } from '@/lib/ui-store';
import { Button, Chip, PageHeader, Spinner } from '@/components/ui/bits';
import type { CapabilityKey } from '@/lib/types';

function Section({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="mb-6 rounded-2xl border border-ink-700 bg-ink-900 p-5 sm:p-6">
      <h2 className="mb-4 font-display text-2xl tracking-wide uppercase">{title}</h2>
      {children}
    </section>
  );
}

export default function SettingsPage() {
  const spotify = usePlayer((s) => s.spotify);
  const [clientId, setCid] = useState('');
  const [me, setMe] = useState<SpotifyMe | null>(null);
  const [devices, setDevices] = useState<SpotifyDevice[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [auto, setAuto] = useState(true);
  const [redirect, setRedirect] = useState('');
  const [localhost, setLocalhost] = useState(false);
  const style = useUi((s) => s.style);
  const setStyle = useUi((s) => s.setStyle);
  const estimatedWords = useUi((s) => s.estimatedWords);
  const autoTheme = useUi((s) => s.autoTheme);
  const onlineGenres = useUi((s) => s.onlineGenres);
  const aiInterpret = useUi((s) => s.aiInterpret);
  const setUi = useUi((s) => s.set);

  useEffect(() => {
    setCid(getClientId() ?? '');
    setRedirect(redirectUri());
    setLocalhost(isLocalhostOrigin());
    void getAutoFind().then(setAuto);
  }, []);

  const refreshSpotify = useCallback(async () => {
    if (!spotify.connected) {
      setMe(null);
      setDevices([]);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      setMe(await getMe());
      setDevices(await getDevices());
    } catch (e) {
      setErr(e instanceof SpotifyApiError ? e.message : (e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [spotify.connected]);

  useEffect(() => {
    void refreshSpotify();
  }, [refreshSpotify]);

  const connect = async () => {
    setErr(null);
    try {
      setClientId(clientId);
      await startLogin();
    } catch (e) {
      setErr(e instanceof SpotifyAuthError ? e.message : (e as Error).message);
    }
  };

  const caps = spotifyCapabilities(spotify.connected, me ? me.product === 'premium' : null);
  const capKeys = Object.keys(caps) as CapabilityKey[];
  const premium = me?.product === 'premium';

  return (
    <div className="max-w-3xl">
      <PageHeader eyebrow="Account" title="Settings" />

      <Section title="Spotify" id="spotify">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {spotify.connected ? <Chip tone="spotify">Connected</Chip> : <Chip>Not connected</Chip>}
          {me && <Chip tone={premium ? 'good' : 'warn'}>{premium ? 'Premium' : `${me.product ?? 'free'} plan`}</Chip>}
          {spotify.connected && spotify.sdk === 'ready' && <Chip tone="good">Browser device ready</Chip>}
        </div>

        {!spotify.connected && (
          <ol className="mb-5 list-decimal space-y-2 pl-5 text-sm text-ink-200">
            <li>
              Create an app at{' '}
              <a className="underline" href="https://developer.spotify.com/dashboard" target="_blank" rel="noreferrer">
                developer.spotify.com/dashboard
              </a>{' '}
              (choose “Web API” and “Web Playback SDK”).
            </li>
            <li>
              Add this exact Redirect URI:
              <div className="mt-1.5 flex items-center gap-2">
                <code className="flex-1 overflow-x-auto rounded-lg bg-ink-800 px-3 py-2 font-mono text-xs whitespace-nowrap">{redirect}</code>
                <Button
                  size="sm"
                  onClick={() => {
                    void navigator.clipboard?.writeText(redirect);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </li>
            <li>In Development Mode, add your own Spotify account under “User Management”.</li>
            <li>Paste the Client ID below (no secret is needed or stored: this uses PKCE).</li>
          </ol>
        )}

        {localhost && (
          <p role="alert" className="mb-4 rounded-lg border border-sun/40 bg-sun/10 p-3 text-sm text-sun">
            You opened the app at <code>localhost</code>. Spotify only accepts <code>127.0.0.1</code> redirects, so open{' '}
            <a className="underline" href={`http://127.0.0.1:${window.location.port || 3000}/settings`}>
              127.0.0.1:{window.location.port || 3000}
            </a>{' '}
            instead.
          </p>
        )}

        {!spotify.connected ? (
          <div className="flex flex-wrap items-end gap-3">
            <label className="min-w-[260px] flex-1 text-sm">
              <span className="mb-1 block text-ink-300">Client ID</span>
              <input
                value={clientId}
                onChange={(e) => setCid(e.target.value)}
                placeholder="e.g. 3f2a…"
                autoComplete="off"
                spellCheck={false}
                className="h-10 w-full rounded-lg border border-ink-600 bg-ink-850 px-3 font-mono text-sm outline-none focus:border-aqua"
              />
            </label>
            <Button variant="spotify" onClick={() => void connect()} disabled={!clientId.trim() || localhost}>
              Connect Spotify
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {me && (
              <p className="text-sm text-ink-200">
                Signed in as <strong>{me.display_name ?? me.id}</strong>.
              </p>
            )}
            {!premium && me && (
              <p className="rounded-lg border border-sun/30 bg-sun/10 p-3 text-sm text-sun">
                Free accounts can&apos;t be remote-controlled or play in the browser, but lyrics still follow whatever you play in the Spotify app.
              </p>
            )}
            {spotify.sdkDetail && <p className="text-sm text-ink-300">{spotify.sdkDetail}</p>}
            <div>
              <div className="mb-1.5 flex items-center gap-2 text-sm text-ink-300">
                Devices {busy && <Spinner />}
                <button className="underline" onClick={() => void refreshSpotify()}>
                  refresh
                </button>
              </div>
              {devices.length === 0 ? (
                <p className="text-sm text-ink-400">No devices online. Open Spotify on a phone or computer, or start the browser device by playing a song.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {devices.map((d) => (
                    <li key={d.id ?? d.name} className="flex items-center gap-2">
                      <span className={d.is_active ? 'text-spotify' : 'text-ink-400'}>●</span>
                      {d.name} <span className="text-ink-400">({d.type})</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <Button
              variant="danger"
              onClick={() => {
                disconnect();
                player.syncSpotifyConnection();
              }}
            >
              Disconnect Spotify
            </Button>
          </div>
        )}
        {err && (
          <p role="alert" className="mt-4 rounded-lg border border-red-500/30 bg-red-950/40 p-3 text-sm text-red-200">
            {err}
          </p>
        )}

        <details className="mt-5 text-sm">
          <summary className="cursor-pointer text-ink-300">What works with Spotify (and what doesn&apos;t)</summary>
          <ul className="mt-3 space-y-1.5">
            {capKeys.map((k) => (
              <li key={k} className="flex gap-2">
                <span className={caps[k] ? 'text-aqua' : 'text-ink-500'}>{caps[k] ? <Check size={14} aria-label="yes" className="inline" /> : <X size={14} aria-label="no" className="inline" />}</span>
                <span>
                  <span className="font-mono text-xs">{k}</span>
                  {!caps[k] && explainSpotifyCapability(k) && <span className="block text-ink-400">{explainSpotifyCapability(k)}</span>}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-ink-400">
            Development Mode allows 5 authorized users. Showing lyrics beside Spotify playback uses lyrics you supply or look up; a public product would need Spotify&apos;s and a lyrics licensor&apos;s permission.
          </p>
        </details>
      </Section>

      <Section title="Lyrics" id="lyrics">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={auto}
            onChange={(e) => {
              setAuto(e.target.checked);
              void setAutoFind(e.target.checked);
            }}
            className="mt-1 h-4 w-4 accent-[var(--color-signal)]"
          />
          <span>
            <span className="block font-semibold">Automatically look up lyrics for songs I play</span>
            <span className="text-sm text-ink-300">
              Uses LRCLIB, an open lyrics database. Sends the song title, artist and length only, never your account or listening history. Found lyrics are saved on this device. You can always paste your own.
            </span>
          </span>
        </label>
        <label className="mt-4 flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={estimatedWords}
            onChange={(e) => setUi({ estimatedWords: e.target.checked })}
            className="mt-1 h-4 w-4 accent-[var(--color-signal)]"
          />
          <span>
            <span className="block font-semibold">Word-by-word motion on line-synced lyrics (estimated)</span>
            <span className="text-sm text-ink-300">
              Most online lyrics only say when each <em>line</em> starts. Off: a line appears as a unit, exactly on time. On: words are animated one after another from a guess of the word timing, which can be a few hundred milliseconds off. Lyrics with real word timing always animate word by word.
            </span>
          </span>
        </label>
        <label className="mt-4 flex cursor-pointer items-start gap-3">
          <input type="checkbox" checked={onlineGenres} onChange={(e) => setUi({ onlineGenres: e.target.checked })} className="mt-1 h-4 w-4 accent-[var(--color-signal)]" />
          <span>
            <span className="block font-semibold">Look up genre tags online when a song has none</span>
            <span className="text-sm text-ink-300">
              Genres help Auto choose an art direction for the song. Spotify provides them when connected; otherwise this asks MusicBrainz, an open music encyclopedia, for the artist&apos;s community tags. Sends the artist name only. Off: songs without tags are styled from their words and cover alone.
            </span>
          </span>
        </label>
        <label className="mt-4 flex cursor-pointer items-start gap-3">
          <input type="checkbox" checked={aiInterpret} onChange={(e) => setUi({ aiInterpret: e.target.checked })} className="mt-1 h-4 w-4 accent-[var(--color-signal)]" />
          <span>
            <span className="block font-semibold">AI reading of lyric themes (optional)</span>
            <span className="text-sm text-ink-300">
              Asks an AI gateway you configure (<code>OMNIROUTE_API_KEY</code>, see the README) for the emotional shape and imagery of a song&apos;s lyrics, once per song, then keeps the answer on this device. It sends the title, artist, genre tags and an excerpt of the lyrics to that gateway. It never controls animation; it is one more clue, with its confidence capped, and the app works fully without it. Off by default.
            </span>
          </span>
        </label>
      </Section>

      <Section title="Default look">
        <button
          onClick={() => setUi({ autoTheme: true })}
          aria-pressed={autoTheme}
          className={`mb-3 block w-full rounded-xl border p-4 text-left transition ${autoTheme ? 'border-signal bg-signal/10' : 'border-ink-700 hover:border-ink-500'}`}
        >
          <span className="block font-semibold">Auto: fits each song</span>
          <span className="text-sm text-ink-300">
            Each song gets its own art direction: warm shadow for late-night R&amp;B, paper and serif type for reflective rap, flat colour for bright pop, grain for rock, stillness for slow songs, and so on. Chosen from what is known about the song (genre tags, its words, delivery pace, the cover) and explained in the stage&apos;s Studio panel, where you can correct it, adjust it, save your own themes or pin a look for any song.
          </span>
        </button>
        <p className="mb-2 text-xs text-ink-400">Or use one look for everything:</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {STYLE_IDS.filter((id) => id !== 'custom').map((id) => (
            <button
              key={id}
              onClick={() => {
                setStyle(id);
                setUi({ autoTheme: false });
              }}
              aria-pressed={!autoTheme && style === id}
              className={`rounded-xl border p-3 text-left transition ${!autoTheme && style === id ? 'border-signal bg-signal/10' : 'border-ink-700 hover:border-ink-500'}`}
            >
              <span className="block font-semibold">{STYLES[id].label}</span>
              <span className="text-xs text-ink-300">{STYLES[id].description}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Graphics">
        <p className="mb-3 text-sm text-ink-300">Which processor draws the lyrics. The dedicated GPU is used whenever the browser is running on it; the page itself cannot choose.</p>
        <GpuStatus />
      </Section>

      <Section title="Your data">
        <p className="mb-3 text-sm text-ink-300">
          Everything lives in this browser (imported audio, saved lyrics, playlists, session) plus the local <code>.data</code> folder for parties. Nothing is sent to a cloud service.
        </p>
        <Button
          variant="danger"
          onClick={async () => {
            if (!confirm('Delete all imported files, saved lyrics and playlists from this browser? This cannot be undone.')) return;
            await clearAllLocalData();
            player.clearQueue();
            alert('Local library cleared.');
          }}
        >
          Delete local library
        </Button>
      </Section>
    </div>
  );
}
