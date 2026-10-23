'use client';

import { create } from 'zustand';
import type { StyleId } from './kinetic/types';
import type { ColorMode, EmotionId } from './kinetic/emotion';
import type { ArtworkAmount } from './kinetic/render';

const PREFS_KEY = 'lyricscape.prefs.v1';

type SyncFamily = 'spotify' | 'local';

export type Prefs = {
  style: StyleId;
  colorMode: ColorMode;
  emojis: boolean;
  doodles: boolean;
  /** off | soft blurred background (default) | background + the cover itself in long instrumental breaks */
  artwork: ArtworkAmount;
  /** 'auto' adapts to the machine; the others pin a level */
  quality: 'auto' | 'high' | 'medium' | 'low';
  /** 'auto' = detect from lyrics + tempo */
  mood: EmotionId | 'auto';
  /** keep ONE sync delay for every song instead of resetting per track */
  syncShared: boolean;
  syncGlobal: Record<SyncFamily, number>;
};

const DEFAULTS: Prefs = { style: 'maximalist', colorMode: 'blend', emojis: true, doodles: true, artwork: 'background', quality: 'auto', mood: 'auto', syncShared: true, syncGlobal: { spotify: 0, local: 0 } };

function readPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    const legacyStyle = localStorage.getItem('lyricscape.style') as StyleId | null;
    const parsed = raw ? (JSON.parse(raw) as Partial<Prefs>) : {};
    return { ...DEFAULTS, ...(legacyStyle ? { style: legacyStyle } : {}), ...parsed, syncGlobal: { ...DEFAULTS.syncGlobal, ...(parsed.syncGlobal ?? {}) } };
  } catch {
    return DEFAULTS;
  }
}

type UiState = Prefs & {
  /** Fullscreen lyric stage that can be opened from anywhere ("chill mode") */
  stageOpen: boolean;
  openStage: () => void;
  closeStage: () => void;
  queueOpen: boolean;
  setQueueOpen: (v: boolean) => void;
  hydrate: () => void;
  setStyle: (s: StyleId) => void;
  set: (patch: Partial<Prefs>) => void;
  setSyncGlobal: (family: SyncFamily, ms: number) => void;
};

export const useUi = create<UiState>((set, get) => {
  const persist = () => {
    const { style, colorMode, emojis, doodles, artwork, quality, mood, syncShared, syncGlobal } = get();
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ style, colorMode, emojis, doodles, artwork, quality, mood, syncShared, syncGlobal }));
    } catch {
      /* storage unavailable */
    }
  };
  return {
    ...DEFAULTS,
    stageOpen: false,
    openStage: () => set({ stageOpen: true }),
    closeStage: () => set({ stageOpen: false }),
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
