'use client';

import { create } from 'zustand';
import type { StyleId } from './kinetic/types';

type UiState = {
  /** Fullscreen lyric stage that can be opened from anywhere ("chill mode") */
  stageOpen: boolean;
  openStage: () => void;
  closeStage: () => void;
  style: StyleId;
  setStyle: (s: StyleId) => void;
  queueOpen: boolean;
  setQueueOpen: (v: boolean) => void;
};

export const useUi = create<UiState>((set) => ({
  stageOpen: false,
  openStage: () => set({ stageOpen: true }),
  closeStage: () => set({ stageOpen: false }),
  style: 'maximalist',
  setStyle: (style) => {
    try {
      localStorage.setItem('lyricscape.style', style);
    } catch {
      /* ignore */
    }
    set({ style });
  },
  queueOpen: false,
  setQueueOpen: (queueOpen) => set({ queueOpen }),
}));
