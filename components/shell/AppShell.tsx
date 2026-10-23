'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import clsx from 'clsx';
import { Headphones, Library, Map as MapIcon, PartyPopper, Settings, Sparkles, Compass, X } from 'lucide-react';
import { player, usePlayer } from '@/lib/player/controller';
import { useUi } from '@/lib/ui-store';
import type { StyleId } from '@/lib/kinetic/types';
import { MiniPlayer } from '@/components/player/MiniPlayer';
import { QueueDrawer } from '@/components/player/QueueDrawer';
import { StageOverlay } from './StageOverlay';
import { ListeningLogger } from '@/components/map/ListeningLogger';

const NAV = [
  { href: '/listen', label: 'Listen', icon: Headphones },
  { href: '/visuals', label: 'Visuals', icon: Sparkles },
  { href: '/map', label: 'Map', icon: MapIcon },
  { href: '/parties', label: 'Parties', icon: PartyPopper },
  { href: '/discover', label: 'Discover', icon: Compass },
  { href: '/library', label: 'Library', icon: Library },
] as const;

/** Routes that render without the app chrome (guest join + big-screen display). */
function isBare(pathname: string) {
  return pathname.startsWith('/join/') || pathname.startsWith('/p/') || /^\/parties\/[^/]+\/screen/.test(pathname) || pathname.startsWith('/spotify/callback');
}

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) {
        if (!(el.tagName === 'INPUT' && (el as HTMLInputElement).type === 'range')) return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const st = usePlayer.getState();
      switch (e.key) {
        case ' ':
          if (!st.track && st.queue.entries.length === 0) return;
          if (el?.tagName === 'BUTTON') return; // let buttons handle space
          e.preventDefault();
          void player.toggle();
          break;
        case 'ArrowRight':
          if (el?.tagName === 'INPUT') return;
          if (e.shiftKey) void player.next();
          else void player.seek(player.getPositionMs() + 5000);
          break;
        case 'ArrowLeft':
          if (el?.tagName === 'INPUT') return;
          if (e.shiftKey) void player.previous();
          else void player.seek(player.getPositionMs() - 5000);
          break;
        case 'ArrowUp':
          if (el?.tagName === 'INPUT') return;
          e.preventDefault();
          player.setVolume(Math.min(1, st.volume + 0.05));
          break;
        case 'ArrowDown':
          if (el?.tagName === 'INPUT') return;
          e.preventDefault();
          player.setVolume(Math.max(0, st.volume - 0.05));
          break;
        case 'm':
          player.toggleMute();
          break;
        case 'l': {
          const ui = useUi.getState();
          if (ui.stageOpen) ui.closeStage();
          else if (st.track) ui.openStage();
          break;
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const notice = usePlayer((s) => s.notice);
  useShortcuts();

  useEffect(() => {
    player.init();
    try {
      const saved = localStorage.getItem('lyricscape.style') as StyleId | null;
      if (saved) useUi.setState({ style: saved });
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => player.dismissNotice(), 5000);
    return () => clearTimeout(t);
  }, [notice]);

  const bare = isBare(pathname);

  return (
    <>
      {bare ? (
        <main id="main">{children}</main>
      ) : (
        <div className="min-h-dvh">
          {/* desktop sidebar */}
          <aside className="fixed inset-y-0 left-0 z-30 hidden w-[220px] flex-col border-r border-ink-800 bg-ink-950 px-4 py-6 md:flex">
            <Link href="/" className="mb-8 block px-2">
              <span className="font-display text-[28px] leading-none tracking-wide uppercase">
                Lyric<span className="text-signal">scape</span>
              </span>
            </Link>
            <nav aria-label="Primary" className="flex flex-1 flex-col gap-1">
              {NAV.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(href + '/');
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? 'page' : undefined}
                    className={clsx(
                      'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition',
                      active ? 'bg-ink-800 text-bone' : 'text-ink-300 hover:bg-ink-850 hover:text-bone',
                    )}
                  >
                    <Icon size={18} className={active ? 'text-signal' : ''} />
                    {label}
                  </Link>
                );
              })}
            </nav>
            <Link
              href="/settings"
              className={clsx(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition',
                pathname.startsWith('/settings') ? 'bg-ink-800 text-bone' : 'text-ink-300 hover:bg-ink-850 hover:text-bone',
              )}
            >
              <Settings size={18} /> Settings
            </Link>
          </aside>

          <main
            id="main"
            className="px-4 pt-6 pb-[calc(var(--player-h)+var(--nav-h)+32px)] sm:px-8 md:ml-[220px] md:pt-10 md:pb-[calc(var(--player-h)+40px)]"
          >
            <div className="mx-auto max-w-[1200px]">{children}</div>
          </main>

          <MiniPlayer />

          {/* mobile bottom nav */}
          <nav
            aria-label="Primary mobile"
            className="fixed inset-x-0 bottom-0 z-40 flex h-[var(--nav-h)] items-center justify-around border-t border-ink-800 bg-ink-950/95 backdrop-blur md:hidden"
          >
            {NAV.slice(0, 5).map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + '/');
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={clsx('flex flex-col items-center gap-0.5 px-2 text-[10px] font-semibold', active ? 'text-bone' : 'text-ink-400')}
                >
                  <Icon size={20} className={active ? 'text-signal' : ''} />
                  {label}
                </Link>
              );
            })}
            <Link href="/settings" aria-label="Settings" className={clsx('flex flex-col items-center gap-0.5 px-2 text-[10px] font-semibold', pathname.startsWith('/settings') ? 'text-bone' : 'text-ink-400')}>
              <Settings size={20} />
              More
            </Link>
          </nav>

          <QueueDrawer />
        </div>
      )}
      <StageOverlay />
      <ListeningLogger />
      {notice && (
        <div
          role="status"
          className="fixed top-4 left-1/2 z-[120] flex max-w-[92vw] -translate-x-1/2 items-center gap-3 rounded-full border border-ink-600 bg-ink-850/95 py-2 pr-2 pl-5 text-sm shadow-2xl backdrop-blur animate-rise"
        >
          <span>{notice}</span>
          <button onClick={() => player.dismissNotice()} aria-label="Dismiss" className="rounded-full p-1.5 text-ink-300 hover:bg-ink-700">
            <X size={14} />
          </button>
        </div>
      )}
    </>
  );
}
