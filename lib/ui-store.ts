'use client';

import { create } from 'zustand';
import type { StyleId } from './kinetic/types';
import type { ColorMode, EmotionId } from './kinetic/emotion';
import type { ArtworkAmount } from './kinetic/render';
import { isStageMode, type StageMode } from './kinetic/modes';
import { isTurboStyle, type TurboStyleId } from './kinetic/turbo';

const PREFS_KEY = 'lyricscape.prefs.v1';

type SyncFamily = 'spotify' | 'local';

export type Prefs = {
  /** Clean = the art-direction renderer (Canvas 2D); Turbo = everything on the GPU (WebGL2) at full intensity */
  mode: StageMode;
  /** which Turbo style to draw (only used in Turbo mode) */
  turboStyle: TurboStyleId;
  style: StyleId;
  colorMode: ColorMode;
  emojis: boolean;
  doodles: boolean;
  /** generative show in instrumental breaks and for songs without lyrics */
  interlude: boolean;
  /** off | soft blurred background (default) | background + the cover itself in long instrumental breaks */
  artwork: ArtworkAmount;
  /** 'auto' adapts to the machine; the others pin a level */
  quality: 'auto' | 'high' | 'medium' | 'low';
  /** 'auto' = detect from lyrics + tempo */
  mood: EmotionId | 'auto';
  /** keep ONE sync delay for every song instead of resetting per track */
  syncShared: boolean;
  syncGlobal: Record<SyncFamily, number>;
  /** pick the look from the song (genre, pace, mood, cover); off = always use `style` */
  autoTheme: boolean;
  /** word-by-word motion on line-synced lyrics from ESTIMATED word times (default on, as before; off = the line appears as a unit) */
  estimatedWords: boolean;
  /** ask the configured AI gateway to read the lyric themes (sends title, artist and a lyric excerpt). Off by default; the local analysis always runs. */
  aiInterpret: boolean;
  /** look up genre tags online (MusicBrainz, artist name only) when the track carries none */
  onlineGenres: boolean;
};

const DEFAULTS: Prefs = { mode: 'clean', turboStyle: 'liquid', style: 'maximalist', colorMode: 'blend', emojis: true, doodles: true, interlude: true, artwork: 'background', quality: 'auto', mood: 'auto', syncShared: true, syncGlobal: { spotify: 0, local: 0 }, estimatedWords: true, autoTheme: true, aiInterpret: false, onlineGenres: true };

function readPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    const legacyStyle = localStorage.getItem('lyricscape.style') as StyleId | null;
    const parsed = raw ? (JSON.parse(raw) as Partial<Prefs> & { splitV?: number }) : {};
    // Before the device/song split (stored prefs without splitV), "same for all songs" off meant the shared value was
    // NOT used: only the per-song one, which now lives on as the song offset. Keep that behaviour for people who had it
    // off by starting their device delay at 0. Prefs written by this version carry splitV and are taken as they are.
    const legacyOff = parsed.splitV === undefined && parsed.syncShared === false;
    const syncGlobal = legacyOff ? DEFAULTS.syncGlobal : { ...DEFAULTS.syncGlobal, ...(parsed.syncGlobal ?? {}) };
    return { ...DEFAULTS, ...(legacyStyle ? { style: legacyStyle } : {}), ...parsed, mode: isStageMode(parsed.mode) ? parsed.mode : DEFAULTS.mode, turboStyle: isTurboStyle(parsed.turboStyle) ? parsed.turboStyle : DEFAULTS.turboStyle, syncGlobal };
  } catch {
    return DEFAULTS;
  }
}

type UiState = Prefs & {
  /** Fullscreen lyric stage that can be opened from anywhere ("chill mode") */
  stageOpen: boolean;
  openStage: () => void;
  closeStage: () => void;
  /** the export dialog is open: the live stage stops drawing so the exporter has the machine to itself */
  exportOpen: boolean;
  setExportOpen: (v: boolean) => void;
  queueOpen: boolean;
  setQueueOpen: (v: boolean) => void;
  hydrate: () => void;
  setStyle: (s: StyleId) => void;
  set: (patch: Partial<Prefs>) => void;
  setSyncGlobal: (family: SyncFamily, ms: number) => void;
};

export const useUi = create<UiState>((set, get) => {
  const persist = () => {
    const { mode, turboStyle, style, colorMode, emojis, doodles, interlude, artwork, quality, mood, syncShared, syncGlobal, estimatedWords, autoTheme, aiInterpret, onlineGenres } = get();
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ mode, turboStyle, style, colorMode, emojis, doodles, interlude, artwork, quality, mood, syncShared, syncGlobal, estimatedWords, autoTheme, aiInterpret, onlineGenres, splitV: 2 }));
    } catch {
      /* storage unavailable */
    }
  };
  return {
    ...DEFAULTS,
    stageOpen: false,
    openStage: () => set({ stageOpen: true }),
    closeStage: () => set({ stageOpen: false }),
    exportOpen: false,
    setExportOpen: (exportOpen) => set({ exportOpen }),
    queueOpen: false,
    setQueueOpen: (queueOpen) => set({ queueOpen }),
    hydrate: () => set(readPrefs()),
    setStyle: (style) => {
      set({ style });
      persist();
    },
    set: (patch) => {
      set(patch);
      persist();
    },
    setSyncGlobal: (family, ms) => {
      set({ syncGlobal: { ...get().syncGlobal, [family]: ms } });
      persist();
    },
  };
});
