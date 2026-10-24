'use client';

// Review sheet for the custom icon set: every icon as inline SVG (the UI) and as the canvas sprite the stage draws, on dark and light
// grounds and in three accents. A QA page, like /looks.

import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { drawIcon, ICON_IDS, iconColors, type IconId } from '@/lib/kinetic/icons';

function Sprite({ id, accent, size = 72, edge }: { id: IconId; accent: string; size?: number; edge: string | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.save();
    ctx.translate(c.width / 2, c.height / 2);
    drawIcon(ctx, id, size - 8, iconColors(id, accent), edge);
    ctx.restore();
  }, [id, accent, size, edge]);
  return <canvas ref={ref} width={size} height={size} style={{ width: size, height: size }} />;
}

export default function IconSheet() {
  // drawn only in the browser: the sheet exists to look at canvas output and has nothing worth server-rendering
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return (
    <div className="p-4" data-testid="icon-sheet">
      <h1 className="font-display mb-1 text-3xl uppercase">Icon set</h1>
      <p className="mb-4 text-sm text-ink-300">{ICON_IDS.length} custom vector icons. Top row of each cell: inline SVG on dark / light. Bottom: the canvas sticker sprite in three accents.</p>
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
        {ICON_IDS.map((id) => (
          <div key={id} className="rounded-xl border border-white/10 p-2" data-icon={id}>
            <p className="mb-1 font-mono text-[10px] text-ink-300">{id}</p>
            <div className="flex gap-1">
              <div className="grid h-[72px] w-[72px] place-items-center rounded-lg bg-[#14121f]">
                <Icon id={id} size={56} />
              </div>
              <div className="grid h-[72px] w-[72px] place-items-center rounded-lg bg-[#efe8da]">
                <Icon id={id} size={56} edge />
              </div>
            </div>
            <div className="mt-1 flex gap-1">
              {['#ff3d6e', '#38c7ff', '#ffc21a'].map((a, i) => (
                <div key={a} className="rounded-lg" style={{ background: i === 1 ? '#efe8da' : '#14121f' }}>
                  <Sprite id={id} accent={a} size={44} edge={i === 1 ? '#ffffff' : '#ffffff'} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
