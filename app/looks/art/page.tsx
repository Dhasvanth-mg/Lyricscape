'use client';

// Review sheet for the shared art library: every drawing, in a light and a dark paint. A QA page, like /looks/icons.

import { useEffect, useRef, useState } from 'react';
import { ART_FAMILIES, ART_IDS, drawArt, type ArtFamily } from '@/lib/kinetic/art/library';
import type { DoodlePaint } from '@/lib/kinetic/doodles';

const PAINTS: DoodlePaint[] = [
  { fill: '#ff5d8f', stroke: '#1b1530', lineWidth: 3, accent: '#ffd43b' },
  { fill: '#7ad3ff', stroke: '#0c1a2b', lineWidth: 3, accent: '#ff7a3b' },
  { fill: '#b6f36b', stroke: '#14240a', lineWidth: 3, accent: '#9b6bff' },
  { fill: '#ffd43b', stroke: '#2b1a05', lineWidth: 3, accent: '#ff3d6e' },
];

function Cell({ id, i }: { id: string; i: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current?.getContext('2d');
    if (!c) return;
    c.clearRect(0, 0, 96, 96);
    c.save();
    c.translate(48, 48);
    drawArt(c, id, 36, PAINTS[i % PAINTS.length]!);
    c.restore();
  }, [id, i]);
  return (
    <div className="rounded-lg bg-[#f4efe4] p-1 text-center" title={id} data-art={id}>
      <canvas ref={ref} width={96} height={96} style={{ width: 72, height: 72 }} />
      <p className="font-mono text-[9px] text-[#555]">{id}</p>
    </div>
  );
}

export default function ArtSheet() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return (
    <div className="p-4" data-testid="art-sheet">
      <h1 className="font-display mb-1 text-3xl uppercase">Art library</h1>
      <p className="mb-4 text-sm text-ink-300">
        {ART_IDS.length} drawings made in code, shared by Sketch cards, doodles and Acid grain. {Object.keys(ART_FAMILIES).length} families: {(Object.keys(ART_FAMILIES) as ArtFamily[]).map((f) => `${f} (${ART_FAMILIES[f].n})`).join(', ')}.
      </p>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))' }}>
        {ART_IDS.map((id, i) => (
          <Cell key={id} id={id} i={i} />
        ))}
      </div>
    </div>
  );
}
