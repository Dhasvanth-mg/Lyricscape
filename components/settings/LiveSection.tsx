'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Download, PictureInPicture2 } from 'lucide-react';
import { useUi } from '@/lib/ui-store';
import { pipSupported, usePip } from '@/lib/live/pip';
import { overlayUrl } from '@/lib/live/overlayParams';
import { DEFAULT_STRIP, STRIP_FONTS, STRIP_FONT_LABEL, type StripOptions } from '@/components/live/LyricStrip';
import { Button } from '@/components/ui/bits';

/** A tiny web wallpaper for Wallpaper Engine (Create Wallpaper -> Web): a full-page frame showing the overlay. */
export function wallpaperHtml(url: string): string {
  const safe = url.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  return `<!doctype html>\n<html><head><meta charset="utf-8"><title>Lyricscape lyrics</title>\n<style>html,body{margin:0;height:100%;background:#0b0a12;overflow:hidden}iframe{border:0;width:100%;height:100%}</style></head>\n<body><iframe src="${safe}" allow="autoplay"></iframe></body></html>\n`;
}

const sel = 'h-9 rounded-lg border border-ink-600 bg-ink-850 px-2 text-sm';

/** Settings card: the floating lyrics window, and lyrics for OBS and desktop wallpapers. */
export function LiveSection() {
  const share = useUi((s) => s.liveShare);
  const setUi = useUi((s) => s.set);
  const pip = usePip();
  const [supported, setSupported] = useState(false);
  const [origin, setOrigin] = useState('');
  const [o, setO] = useState<StripOptions>({ ...DEFAULT_STRIP, bg: 'transparent', size: 'l', meta: false });
  const [copied, setCopied] = useState<string | null>(null);
  const [readers, setReaders] = useState<number | null>(null);

  useEffect(() => {
    setSupported(pipSupported());
    setOrigin(window.location.origin);
  }, []);

  // how many overlays are listening right now (so the person can tell OBS picked it up)
  useEffect(() => {
    if (!share) return setReaders(null);
    let dead = false;
    const poll = async () => {
      try {
        const r = await fetch('/api/live', { cache: 'no-store' });
        const j = (await r.json()) as { readers?: number };
        if (!dead) setReaders(j.readers ?? 0);
      } catch {
        if (!dead) setReaders(null);
      }
    };
    void poll();
    const t = setInterval(() => void poll(), 3000);
    return () => {
      dead = true;
      clearInterval(t);
    };
  }, [share]);

  const url = useMemo(() => (origin ? overlayUrl(origin, o) : ''), [origin, o]);
  const wallUrl = useMemo(() => (origin ? overlayUrl(origin, { ...o, bg: 'cover', size: 'xl', meta: true }) : ''), [origin, o]);

  const copy = (text: string, key: string) => {
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    });
  };
  const download = () => {
    const blob = new Blob([wallpaperHtml(wallUrl)], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'index.html';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <div data-testid="live-section" className="space-y-6">
      <div>
        <h3 className="mb-1 font-semibold">Floating lyrics</h3>
        <p className="mb-3 text-sm text-ink-300">A small always-on-top window with the line being sung, so you can keep the lyrics in view while you work or while Spotify is in front. Space plays and pauses from it.</p>
        <Button onClick={() => void (pip.win ? pip.close() : pip.open())} disabled={!supported} data-testid="pip-open">
          <PictureInPicture2 size={14} /> {pip.win ? 'Close floating lyrics' : 'Open floating lyrics'}
        </Button>
        {!supported && <p className="mt-2 text-xs text-amber-300">This browser cannot open one. It needs Chrome or Edge 116 or newer (Document Picture-in-Picture).</p>}
        {pip.error && <p className="mt-2 text-xs text-amber-300">{pip.error}</p>}
      </div>

      <div>
        <h3 className="mb-1 font-semibold">Stream overlay and desktop wallpaper</h3>
        <label className="flex cursor-pointer items-start gap-3">
          <input type="checkbox" checked={share} onChange={(e) => setUi({ liveShare: e.target.checked })} className="mt-1 h-4 w-4 accent-[var(--color-signal)]" data-testid="live-share" />
          <span>
            <span className="block font-semibold">Share what is playing with overlays on this computer</span>
            <span className="text-sm text-ink-300">
              While this tab plays, it hands the song title, artist, lyric lines and playback position to Lyricscape&apos;s own local server, where an OBS browser source or a wallpaper app can show them. Nothing leaves this computer, but anything that can open this app&apos;s address (for example a phone on your network, if you started it for a party) can read it while this is on. Off by default.
            </span>
          </span>
        </label>
        {share && <p className="mt-2 text-xs text-ink-300" data-testid="live-readers">{readers === null ? 'Checking for overlays…' : readers === 1 ? '1 overlay is showing the lyrics.' : `${readers} overlays are showing the lyrics.`}</p>}

        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <label className="flex items-center gap-1.5">
            Background
            <select className={sel} value={o.bg} onChange={(e) => setO({ ...o, bg: e.target.value as StripOptions['bg'] })}>
              <option value="transparent">Transparent (OBS)</option>
              <option value="solid">Dark</option>
              <option value="cover">Cover, blurred</option>
            </select>
          </label>
          <label className="flex items-center gap-1.5">
            Size
            <select className={sel} value={o.size} onChange={(e) => setO({ ...o, size: e.target.value as StripOptions['size'] })}>
              <option value="s">Small</option>
              <option value="m">Medium</option>
              <option value="l">Large</option>
              <option value="xl">Huge</option>
            </select>
          </label>
          <label className="flex items-center gap-1.5">
            Font
            <select className={sel} value={o.font} onChange={(e) => setO({ ...o, font: e.target.value as StripOptions['font'] })}>
              {STRIP_FONTS.map((f) => (
                <option key={f} value={f}>
                  {STRIP_FONT_LABEL[f]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1.5">
            Align
            <select className={sel} value={o.align} onChange={(e) => setO({ ...o, align: e.target.value as StripOptions['align'] })}>
              <option value="center">Centre</option>
              <option value="left">Left</option>
            </select>
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={o.next} onChange={(e) => setO({ ...o, next: e.target.checked })} className="h-4 w-4 accent-[var(--color-signal)]" /> Next line
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={o.meta} onChange={(e) => setO({ ...o, meta: e.target.checked })} className="h-4 w-4 accent-[var(--color-signal)]" /> Title
          </label>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-lg bg-ink-850 px-3 py-2 text-xs" data-testid="overlay-url">{url}</code>
          <Button size="sm" onClick={() => copy(url, 'url')}>
            {copied === 'url' ? <Check size={14} /> : <Copy size={14} />} Copy
          </Button>
        </div>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-ink-300">
          <li>
            <strong>OBS:</strong> Sources → + → Browser, paste the address, set the size of your canvas (for example 1920 × 300), and leave &quot;Custom CSS&quot; empty. The background is see-through.
          </li>
          <li>
            <strong>Lively Wallpaper</strong> (free, Windows): + → paste this address with the background set to &quot;Cover, blurred&quot;:{' '}
            <button className="underline" onClick={() => copy(wallUrl, 'wall')}>
              {copied === 'wall' ? 'copied' : 'copy the wallpaper address'}
            </button>
            .
          </li>
          <li>
            <strong>Wallpaper Engine:</strong>{' '}
            <button className="underline" onClick={download}>
              <Download size={12} className="mr-0.5 inline" />
              download index.html
            </button>
            , then Create Wallpaper → Web and pick that file. It frames the wallpaper address, so Lyricscape must be running.
          </li>
        </ul>
        <p className="mt-2 text-xs text-ink-400">The overlay follows this tab: keep Lyricscape open (it can be in the background) while you stream.</p>
      </div>
    </div>
  );
}
