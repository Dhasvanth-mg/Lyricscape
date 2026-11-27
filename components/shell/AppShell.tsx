'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import clsx from 'clsx';
import { Headphones, Library, Map as MapIcon, PartyPopper, Settings, Sparkles, Compass, X } from 'lucide-react';
import { player, usePlayer } from '@/lib/player/controller';
import { useUi } from '@/lib/ui-store';
import { MiniPlayer } from '@/components/player/MiniPlayer';
import { AudioIndexer } from '@/components/player/AudioIndexer';
import { QueueDrawer } from '@/components/player/QueueDrawer';
import { StageOverlay } from './StageOverlay';
import { ListeningLogger } from '@/components/map/ListeningLogger';
import { NowPlayingBridge } from '@/components/live/NowPlayingBridge';

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
  return pathname.startsWith('/join/') || pathname.startsWith('/p/') || /^\/parties\/[^/]+\/screen/.test(pathname) || pathname.startsWith('/spotify/callback') || pathname === '/overlay' || pathname === '/looks' || pathname.startsWith('/looks/');
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

  // the overlay is read-only: it must not start a player of its own (it may run in the same browser as the app)
  const overlay = pathname === '/overlay';
  useEffect(() => {
    if (overlay) return;
    player.init();
    useUi.getState().hydrate();
  }, [overlay]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => player.dismissNotice(), 5000);
    return () => clearTimeout(t);
  }, [notice]);

  const bare = isBare(pathname);
  if (overlay) return <main id="main">{children}</main>;

  return (
    <>
      {bare ? (
        <main id="main">{children}</main>
      ) : (
        <div className="min-h-dvh">
          <header className="fixed inset-x-0 top-0 z-40 h-[var(--top-h)] border-b border-line bg-ink-950 px-4 sm:px-6">
            <div className="mx-auto flex h-full max-w-[1320px] items-stretch gap-8">
              <Link href="/" className="flex items-center text-[15px] font-bold tracking-[-0.01em]">
                Lyricscape
              </Link>
              <nav aria-label="Primary" className="hidden items-stretch gap-6 md:flex">
                {NAV.map(({ href, label }) => {
                  const active = pathname === href || pathname.startsWith(href + '/');
                  return (
                    <Link
                      key={href}
                      href={href}
                      aria-current={active ? 'page' : undefined}
                      className={clsx(
                        '-mb-px flex items-center border-b-2 text-[13px] font-medium transition-colors duration-150',
                        active ? 'border-signal text-bone' : 'border-transparent text-ink-400 hover:text-bone',
                      )}
                    >
                      {label}
                    </Link>
                  );
                })}
              </nav>
              <Link
                href="/settings"
                aria-current={pathname.startsWith('/settings') ? 'page' : undefined}
                className={clsx(
                  '-mb-px ml-auto flex items-center gap-2 border-b-2 text-[13px] font-medium transition-colors duration-150',
                  pathname.startsWith('/settings') ? 'border-signal text-bone' : 'border-transparent text-ink-400 hover:text-bone',
                )}
              >
                <Settings size={16} /> <span className="hidden sm:inline">Settings</span>
              </Link>
            </div>
          </header>

          <main
            id="main"
            className="px-4 pt-[calc(var(--top-h)+28px)] pb-[calc(var(--player-h)+var(--nav-h)+32px)] sm:px-6 md:pb-[calc(var(--player-h)+48px)]"
          >
            <div className="mx-auto max-w-[1320px]">{children}</div>
          </main>

          <MiniPlayer />
          <AudioIndexer />

          {/* mobile bottom nav */}
          <nav
            aria-label="Primary mobile"
            className="fixed inset-x-0 bottom-0 z-40 grid h-[var(--nav-h)] grid-cols-6 border-t border-line bg-ink-950 md:hidden"
          >
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + '/');
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={clsx(
                    '-mt-px flex flex-col items-center justify-center gap-1 border-t-2 text-[10px] font-medium',
                    active ? 'border-signal text-bone' : 'border-transparent text-ink-400',
                  )}
                >
                  <Icon size={18} />
                  {label}
                </Link>
              );
            })}
          </nav>

          <QueueDrawer />
        </div>
      )}
      <StageOverlay />
      <ListeningLogger />
      <NowPlayingBridge />
      {notice && (
        <div
          role="status"
          className="fixed top-[calc(var(--top-h)+12px)] left-1/2 z-[120] flex max-w-[92vw] -translate-x-1/2 items-center gap-3 rounded border border-ink-600 bg-ink-850 py-1.5 pr-1.5 pl-4 text-[13px] shadow-[0_2px_8px_rgba(0,0,0,0.3)] animate-rise"
        >
          <span>{notice}</span>
          <button onClick={() => player.dismissNotice()} aria-label="Dismiss" className="rounded p-1.5 text-ink-300 hover:bg-ink-700">
            <X size={14} />
          </button>
        </div>
      )}
    </>
  );
}
