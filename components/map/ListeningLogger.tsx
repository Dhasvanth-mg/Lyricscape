'use client';

import { useEffect, useRef } from 'react';
import { api } from '@/lib/party/client';
import { usePlayer } from '@/lib/player/controller';
import { refFromTrack } from '@/lib/party/tracks';
import type { MapSettings } from '@/lib/map/schemas';

export const MAP_SETTINGS_EVENT = 'lyricscape:map-settings';

/**
 * Foreground-only listening logger. It runs while the app is open and a song is playing, and ONLY when:
 *  1. the user opted in (server-side setting) and has not paused it, and
 *  2. the browser already granted geolocation (we never prompt from here; the prompt lives in the Map page).
 * It never backfills: a session is only recorded while the song is actually playing.
 */
export function ListeningLogger() {
  const settingsRef = useRef<MapSettings | null>(null);
  const lastKey = useRef<string>('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await api<{ available: boolean; settings: MapSettings }>('GET', '/api/map/settings');
        if (alive) settingsRef.current = r.available ? r.settings : null;
      } catch {
        if (alive) settingsRef.current = null; // not signed in: nothing is logged
      }
    };
    void load();
    window.addEventListener(MAP_SETTINGS_EVENT, load);
    return () => {
      alive = false;
      window.removeEventListener(MAP_SETTINGS_EVENT, load);
    };
  }, []);

  useEffect(() => {
    const record = async (trackId: string) => {
      const s = settingsRef.current;
      const st = usePlayer.getState();
      if (!s?.enabled || s.paused || !st.track || st.track.id !== trackId || st.status !== 'playing') return;
      if (!('geolocation' in navigator)) return;
      try {
        const perm = await navigator.permissions?.query({ name: 'geolocation' as PermissionName });
        if (perm && perm.state !== 'granted') return; // never prompt here
      } catch {
        return;
      }
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const cur = usePlayer.getState();
          if (!cur.track || cur.track.id !== trackId || cur.status !== 'playing') return; // overlap check: still playing
          try {
            await api('POST', '/api/map/sessions', {
              track: refFromTrack(cur.track),
              startedAt: new Date().toISOString(),
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              accuracyM: pos.coords.accuracy,
              source: cur.track.provider,
            });
          } catch {
            /* offline, paused or rate limited: dropping a sample is fine */
          }
        },
        () => undefined,
        { enableHighAccuracy: false, maximumAge: 5 * 60_000, timeout: 8000 },
      );
    };

    const unsub = usePlayer.subscribe((s) => {
      const key = s.status === 'playing' && s.track ? s.track.id : '';
      if (key === lastKey.current) return;
      lastKey.current = key;
      if (timer.current) clearTimeout(timer.current);
      if (interval.current) clearInterval(interval.current);
      if (!key) return;
      // a song must actually be listened to for a few seconds before it counts
      timer.current = setTimeout(() => void record(key), 8000);
      interval.current = setInterval(() => void record(key), 5 * 60_000);
    });
    return () => {
      unsub();
      if (timer.current) clearTimeout(timer.current);
      if (interval.current) clearInterval(interval.current);
    };
  }, []);

  return null;
}
