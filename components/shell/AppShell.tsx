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
        <div className="min-h-dvh bg-ink-950">
          {/* desktop sidebar */}
          <aside className="panel fixed top-[var(--gutter)] bottom-[calc(var(--player-h)+var(--gutter))] left-[var(--gutter)] z-30 hidden w-[var(--sidebar-w)] flex-col px-3 pt-5 pb-4 md:flex">
            <Link href="/" className="mb-6 block px-3">
              <span className="font-display text-[28px] leading-none tracking-wide uppercase">
                Lyric<span className="text-signal">scape</span>
              </span>
            </Link>
            <nav aria-label="Primary" className="flex flex-1 flex-col gap-0.5">
              {NAV.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(href + '/');
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? 'page' : undefined}
                    className={clsx(
                      'flex items-center gap-4 rounded-md px-3 py-2.5 text-[15px] font-bold transition-colors',
                      active ? 'bg-ink-850 text-bone' : 'text-ink-300 hover:text-bone',
                    )}
                  >
                    <Icon size={22} strokeWidth={active ? 2.4 : 2} className={active ? 'text-signal' : ''} />
                    {label}
                  </Link>
                );
              })}
            </nav>
            <Link
              href="/settings"
              className={clsx(
                'flex items-center gap-4 rounded-md px-3 py-2.5 text-[15px] font-bold transition-colors',
                pathname.startsWith('/settings') ? 'bg-ink-850 text-bone' : 'text-ink-300 hover:text-bone',
              )}
            >
              <Settings size={22} /> Settings
            </Link>
          </aside>

          <main
            id="main"
            className="bg-ink-900 px-4 pt-6 pb-[calc(var(--player-h)+var(--nav-h)+32px)] sm:px-6 md:mt-[var(--gutter)] md:mr-[var(--gutter)] md:mb-[calc(var(--player-h)+var(--gutter))] md:ml-[calc(var(--sidebar-w)+var(--gutter)*2)] md:min-h-[calc(100dvh-var(--player-h)-var(--gutter)*2)] md:rounded-xl md:bg-[linear-gradient(to_bottom,var(--color-ink-850),var(--color-ink-900)_280px)] md:px-8 md:pt-8 md:pb-12"
          >
            <div className="mx-auto max-w-[1200px]">{children}</div>
          </main>

          <MiniPlayer />
          <AudioIndexer />

          {/* mobile bottom nav */}
          <nav
            aria-label="Primary mobile"
            className="fixed inset-x-0 bottom-0 z-40 flex h-[var(--nav-h)] items-center justify-around bg-gradient-to-t from-ink-950 via-ink-950/95 to-ink-950/80 backdrop-blur md:hidden"
          >
            {NAV.slice(0, 5).map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + '/');
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={clsx('flex flex-col items-center gap-1 px-2 text-[11px] font-semibold', active ? 'text-bone' : 'text-ink-300')}
                >
                  <Icon size={22} className={active ? 'text-signal' : ''} />
                  {label}
                </Link>
              );
            })}
            <Link href="/settings" aria-label="Settings" className={clsx('flex flex-col items-center gap-1 px-2 text-[11px] font-semibold', pathname.startsWith('/settings') ? 'text-bone' : 'text-ink-300')}>
              <Settings size={22} />
              More
            </Link>
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
          className="fixed bottom-[calc(var(--player-h)+var(--nav-h)+16px)] left-1/2 z-[120] flex max-w-[92vw] -translate-x-1/2 items-center gap-3 rounded-lg bg-bone py-2 pr-2 pl-4 text-sm font-semibold text-ink-950 shadow-menu animate-rise md:bottom-[calc(var(--player-h)+24px)]"
        >
          <span>{notice}</span>
          <button onClick={() => player.dismissNotice()} aria-label="Dismiss" className="rounded-full p-1.5 text-ink-500 hover:bg-black/10 hover:text-ink-950">
            <X size={14} />
          </button>
        </div>
      )}
    </>
  );
}
