'use client';

// The floating lyrics window: Document Picture-in-Picture (Chrome and Edge 116+). It is a real always-on-top window that
// shares this tab's JavaScript, so the lyrics in it come from the same player and clock. React renders into it through a
// portal (components/live/NowPlayingBridge.tsx).

import { create } from 'zustand';

type DocPip = { requestWindow(o?: { width?: number; height?: number }): Promise<Window>; window: Window | null };
const api = (): DocPip | null => (typeof window !== 'undefined' ? ((window as unknown as { documentPictureInPicture?: DocPip }).documentPictureInPicture ?? null) : null);

export const pipSupported = () => !!api();

type PipState = { win: Window | null; error: string | null; open: () => Promise<void>; close: () => void };

/** Copy this page's styles into the new window so Tailwind classes and fonts work there too. */
function copyStyles(to: Document) {
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const css = Array.from(sheet.cssRules)
        .map((r) => r.cssText)
        .join('\n');
      const el = to.createElement('style');
      el.textContent = css;
      to.head.appendChild(el);
    } catch {
      // a stylesheet from another origin cannot be read: link it instead
      if (sheet.href) {
        const link = to.createElement('link');
        link.rel = 'stylesheet';
        link.href = sheet.href;
        to.head.appendChild(link);
      }
    }
  }
}

export const usePip = create<PipState>((set, get) => ({
  win: null,
  error: null,
  open: async () => {
    const pip = api();
    if (!pip) return set({ error: 'Floating lyrics need Chrome or Edge (Document Picture-in-Picture).' });
    if (get().win) return;
    try {
      const win = await pip.requestWindow({ width: 520, height: 180 });
      copyStyles(win.document);
      win.document.title = 'Lyricscape lyrics';
      win.document.documentElement.style.background = '#0b0a12';
      win.document.body.style.margin = '0';
      win.addEventListener('pagehide', () => set({ win: null }), { once: true });
      set({ win, error: null });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Could not open the floating window.' });
    }
  },
  close: () => {
    get().win?.close();
    set({ win: null });
  },
}));
