'use client';

// The listener's own themes and defaults, kept in this browser (localStorage). Nothing leaves the device.

import { create } from 'zustand';
import type { GenreFamily } from '../identity/types';
import type { StyleId } from '../kinetic/types';
import type { SavedTheme, Tweaks } from './types';

const KEY = 'lyricscape.studio.v1';

type Persisted = { saved: SavedTheme[]; familyDefaults: Partial<Record<GenreFamily, StyleId>> };

function read(): Persisted {
  try {
    const raw = localStorage.getItem(KEY);
    const p = raw ? (JSON.parse(raw) as Partial<Persisted>) : {};
    return { saved: Array.isArray(p.saved) ? p.saved.filter((t) => t && typeof t.id === 'string' && typeof t.name === 'string') : [], familyDefaults: p.familyDefaults && typeof p.familyDefaults === 'object' ? p.familyDefaults : {} };
  } catch {
    return { saved: [], familyDefaults: {} };
  }
}

type State = Persisted & {
  hydrated: boolean;
  hydrate: () => void;
  saveTheme: (name: string, base: StyleId, tweaks: Tweaks) => SavedTheme;
  renameTheme: (id: string, name: string) => void;
  deleteTheme: (id: string) => void;
  setFamilyDefault: (family: GenreFamily, id: StyleId | null) => void;
};

export const useStudio = create<State>((set, get) => {
  const persist = () => {
    const { saved, familyDefaults } = get();
    try {
      localStorage.setItem(KEY, JSON.stringify({ saved, familyDefaults }));
    } catch {
      /* storage unavailable: themes last for this session */
    }
  };
  return {
    saved: [],
    familyDefaults: {},
    hydrated: false,
    hydrate: () => set({ ...read(), hydrated: true }),
    saveTheme: (name, base, tweaks) => {
      const theme: SavedTheme = { id: `th-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, name: name.trim().slice(0, 40) || 'My theme', base, tweaks: JSON.parse(JSON.stringify(tweaks)) as Tweaks, createdAt: Date.now() };
      set({ saved: [...get().saved, theme] });
      persist();
      return theme;
    },
    renameTheme: (id, name) => {
      set({ saved: get().saved.map((t) => (t.id === id ? { ...t, name: name.trim().slice(0, 40) || t.name } : t)) });
      persist();
    },
    deleteTheme: (id) => {
      set({ saved: get().saved.filter((t) => t.id !== id) });
      persist();
    },
    setFamilyDefault: (family, id) => {
      const next = { ...get().familyDefaults };
      if (id) next[family] = id;
      else delete next[family];
      set({ familyDefaults: next });
      persist();
    },
  };
});
