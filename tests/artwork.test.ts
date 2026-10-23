import { describe, expect, it } from 'vitest';
import { ART_STYLES, coverDataUrl, coverStyleFor, generateCoverSvg, paletteFromSeed } from '@/lib/artwork/generate';
import { artworkFor } from '@/lib/artwork/forTrack';

describe('generated cover art', () => {
  it('is deterministic: same input, byte-identical SVG', () => {
    for (const style of ART_STYLES) {
      const a = generateCoverSvg({ seed: 'track:1', title: 'Hello World', style });
      expect(generateCoverSvg({ seed: 'track:1', title: 'Hello World', style })).toBe(a);
    }
  });

  it('every style makes a distinct, well-formed picture', () => {
    const svgs = ART_STYLES.map((style) => generateCoverSvg({ seed: 'x', title: 'T', style }));
    expect(new Set(svgs).size).toBe(ART_STYLES.length);
    for (const s of svgs) {
      expect(s.startsWith('<svg')).toBe(true);
      expect(s.endsWith('</svg>')).toBe(true);
      expect(s).not.toMatch(/NaN|undefined/);
    }
  });

  it('different tracks look different, and spread across styles', () => {
    expect(generateCoverSvg({ seed: 'a' })).not.toBe(generateCoverSvg({ seed: 'b' }));
    const styles = new Set(Array.from({ length: 60 }, (_, i) => coverStyleFor(`track:${i}`)));
    expect(styles.size).toBe(ART_STYLES.length);
  });

  it('uses the given palette and escapes text', () => {
    const svg = generateCoverSvg({ seed: 's', title: '<b>"A" & B</b>', artist: "O'Neil", palette: ['#123456', '#abcdef', '#fedcba', '#0a0a0a'], style: 'bauhaus' });
    expect(svg).toContain('#123456');
    expect(svg).not.toContain('<b>');
    expect(svg).toContain('&lt;B&gt;');
    expect(svg).toContain('&amp;');
  });

  it('derives a palette from the seed when none is given', () => {
    const p = paletteFromSeed('some-track');
    expect(p).toHaveLength(4);
    for (const c of p) expect(c).toMatch(/^#[0-9a-f]{6}$/);
    expect(paletteFromSeed('some-track')).toEqual(p);
  });

  it('artworkFor keeps real artwork and fills in generated art otherwise', () => {
    expect(artworkFor({ id: 'a', artworkUrl: 'https://i.scdn.co/x.jpg' })).toBe('https://i.scdn.co/x.jpg');
    const gen = artworkFor({ id: 'a' });
    expect(gen.startsWith('data:image/svg+xml')).toBe(true);
    expect(artworkFor({ id: 'a' })).toBe(gen);
    expect(coverDataUrl({ seed: 'a' })).toBe(gen);
  });
});
