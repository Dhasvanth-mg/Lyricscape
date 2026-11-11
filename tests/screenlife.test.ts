// Screenlife (Phase 3): the typing engine, the song plan's rules, colour contrast, the kit layouts and asset ids.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { compileTimeline } from '@/lib/kinetic/compile';
import { parseLrc } from '@/lib/lyrics/parse';
import type { VisualTimeline, WordCue } from '@/lib/kinetic/types';
import { contrastRatio } from '@/lib/kinetic/util';
import { graphemes, typeLine, fieldAt, PROFILE_IDS, TYPO_IDS } from '@/lib/styles/screenlife/typing';
import { screenPlan, SCENE_KIT } from '@/lib/styles/screenlife/plan';
import { themeFor, DARK, LIGHT } from '@/lib/styles/screenlife/theme';
import { KIT_IDS, kitSpec, screenFor, type KitEnv } from '@/lib/styles/screenlife/kits';
import { STICKER_IDS } from '@/lib/styles/screenlife/props';
import { FRAME_IDS, ROOM_IDS, WALL_IDS, GLASS_IDS } from '@/lib/styles/screenlife/world';

const manifest = JSON.parse(readFileSync(join(process.cwd(), 'docs/visual-production/styles/screenlife/asset-manifest.json'), 'utf8')) as { assets: { id: string; status: string }[] };
const live = new Set(manifest.assets.filter((a) => a.status !== 'rejected' && a.status !== 'merged').map((a) => a.id));

const demo = (name: string, label = 'Song • Artist'): VisualTimeline => {
  const doc = parseLrc(readFileSync(join(process.cwd(), 'public', 'demo', `${name}.lrc`), 'utf8'));
  const cat = JSON.parse(readFileSync(join(process.cwd(), 'public', 'demo', 'catalog.json'), 'utf8')) as { id: string; durationMs: number; bpm: number; beatTimesMs: number[] }[];
  const t = cat.find((c) => c.id === name)!;
  return { ...compileTimeline(doc, { trackId: `demo:${name}`, durationMs: t.durationMs, palette: ['#e0574a', '#2f7fe0'], bpm: t.bpm, beatTimesMs: t.beatTimesMs }), label };
};
const words = (text: string, start: number, per: number, timing: WordCue['timing'] = 'authored') =>
  text.split(' ').map((w, i) => ({ text: w, startMs: start + i * per, endMs: start + i * per + per * 0.8, timing }));

describe('typing', () => {
  it('ends on the full line, in time order, and is complete before the send', () => {
    for (const profile of PROFILE_IDS)
      for (const timing of ['authored', 'estimated', 'none'] as const) {
        const ws = words('never retyped from scratch more than twice tonight', 1000, 420, timing);
        const p = typeLine({ words: ws, startMs: 1000, untilMs: 5200, script: 'latin', profile, reduced: false, seed: 7, allowTypo: true });
        expect(p.keys[p.keys.length - 1]!.text).toBe(ws.map((w) => w.text).join(' '));
        for (let i = 1; i < p.keys.length; i++) expect(p.keys[i]!.at).toBeGreaterThanOrEqual(p.keys[i - 1]!.at);
        expect(p.doneAt).toBeLessThanOrEqual(p.sendAt);
        expect(p.sendAt).toBeLessThanOrEqual(5200);
        expect(fieldAt(p, 5200)).toBe(p.text);
        expect(fieldAt(p, 0)).toBe('');
      }
  });
  it('lands each authored word on its end time', () => {
    const ws = words('city hums in electric blue', 0, 500);
    const p = typeLine({ words: ws, startMs: 0, untilMs: 3000, script: 'latin', profile: 'SCR-MOT-TYP-001', reduced: false, seed: 3, allowTypo: false });
    let acc = '';
    ws.forEach((w, i) => {
      acc = i ? `${acc} ${w.text}` : w.text;
      expect(fieldAt(p, w.endMs)).toBe(acc);
    });
  });
  it('line-synced typing finishes by 85% of the line', () => {
    const ws = words('every sign is calling you', 0, 400, 'none');
    const p = typeLine({ words: ws, startMs: 0, untilMs: 4000, script: 'latin', profile: 'SCR-MOT-TYP-002', reduced: false, seed: 9, allowTypo: false });
    expect(p.doneAt).toBeLessThanOrEqual(0.85 * 4000 + 1);
    expect(p.timing).toBe('line');
  });
  it('types complex scripts by whole grapheme clusters and never with typos', () => {
    for (const text of ['शहर की रोशनी में तेरा नाम', 'நகரத்தின் ஒளியில் உன் பெயர்', 'في ضوء المدينة كتبت اسمك']) {
      const ws = words(text, 0, 600);
      const script = /[ऀ-ॿ]/.test(text) ? 'devanagari' : /[஀-௿]/.test(text) ? 'tamil' : 'arabic';
      for (const profile of PROFILE_IDS) {
        const p = typeLine({ words: ws, startMs: 0, untilMs: 4000, script, profile, reduced: false, seed: 1, allowTypo: true });
        expect(p.typo).toBeNull();
        const full = graphemes(text);
        for (const k of p.keys) {
          const g = graphemes(k.text);
          expect(full.slice(0, g.length)).toEqual(g); // always a prefix of whole clusters
        }
      }
    }
  });
  it('a typo is Latin only, inside a word longer than four letters, and corrected', () => {
    let seen = 0;
    for (let seed = 0; seed < 60; seed++) {
      const ws = words('the static sings tonight forever', 0, 700, 'none');
      const p = typeLine({ words: ws, startMs: 0, untilMs: 4200, script: 'latin', profile: 'SCR-MOT-TYP-005', reduced: false, seed, allowTypo: true });
      if (!p.typo) continue;
      seen++;
      expect(TYPO_IDS).toContain(p.typo);
      expect(p.keys.some((k) => !p.text.startsWith(k.text))).toBe(true);
      expect(p.keys[p.keys.length - 1]!.text).toBe(p.text);
    }
    expect(seen).toBeGreaterThan(0);
  });
  it('reduced motion shows whole words on word cues, or the whole line', () => {
    const ws = words('hold me slow', 0, 500);
    const p = typeLine({ words: ws, startMs: 0, untilMs: 2000, script: 'latin', profile: 'SCR-MOT-TYP-001', reduced: true, seed: 1, allowTypo: true });
    expect(p.keys.map((k) => k.text)).toEqual(['hold', 'hold me', 'hold me slow']);
    const q = typeLine({ words: words('hold me slow', 0, 500, 'none'), startMs: 0, untilMs: 2000, script: 'latin', profile: 'SCR-MOT-TYP-001', reduced: true, seed: 1, allowTypo: true });
    expect(q.keys.map((k) => k.text)).toEqual(['hold me slow']);
  });
  it('dense lines are dictated in chunks, very dense ones pasted', () => {
    const dense = typeLine({ words: words('a b c d e f g h i j k l m n o p q r s t u v w', 0, 60, 'none'), startMs: 0, untilMs: 1600, script: 'latin', profile: 'SCR-MOT-TYP-001', reduced: false, seed: 1, allowTypo: false });
    expect(['dictation', 'paste']).toContain(dense.mode);
  });
});

describe('plan', () => {
  const songs = ['neon-static', 'glass-hours', 'paper-planets'];
  it('is deterministic and never offers the code editor by default', () => {
    for (const s of songs) {
      const a = screenPlan(demo(s), false, true);
      const b = screenPlan({ ...demo(s) }, false, true);
      expect(a.sections.map((x) => [x.kit, x.comp, x.dark, x.room])).toEqual(b.sections.map((x) => [x.kit, x.comp, x.dark, x.room]));
      expect(a.sections.some((x) => x.ps.scene.id === 'SCR-SCN-07')).toBe(false);
    }
  });
  it('keeps stickers to choruses, two a song, never on terminals or the old desktop', () => {
    for (const s of songs) {
      const p = screenPlan(demo(s), false, true);
      const st = p.sections.filter((x) => x.sticker);
      expect(st.length).toBeLessThanOrEqual(2);
      for (const x of st) {
        expect(x.ps.section.role).toBe('chorus');
        expect(['SCR-UIK-APP-006', 'SCR-UIK-APP-013']).not.toContain(x.kit);
      }
    }
  });
  it('fills notifications only from the song metadata and its own lines', () => {
    for (const s of songs) {
      const tl = demo(s, 'My Title • My Artist');
      const lines = new Set(tl.scenes.map((x) => x.words.map((w) => w.text).join(' ')));
      for (const x of screenPlan(tl, false, true).sections) {
        if (!x.notif) continue;
        const ok = (v: string) => v === 'My Title' || v === 'My Artist' || lines.has(v) || /^(Download complete|Missed call|Do not disturb|Every day|Now recording|Low battery|\d+% of the song left)$/.test(v);
        expect(ok(x.notif.title)).toBe(true);
        expect(ok(x.notif.body)).toBe(true);
      }
    }
  });
  it('types every demo line before it leaves the field, and resends repeats', () => {
    for (const s of songs) {
      const tl = demo(s);
      const p = screenPlan(tl, false, true);
      p.lines.forEach((l, i) => {
        const next = tl.scenes[i + 1];
        const until = Math.min(next ? next.startMs - 30 : Infinity, tl.scenes[i]!.endMs + 1600);
        expect(fieldAt(l.typing, until)).toBe(l.typing.text);
        if (l.repeat >= 3 && l.typing.profile !== 'SCR-MOT-TYP-010') expect(l.typing.mode === 'paste' || l.typing.mode === 'whole').toBe(true);
      });
      // at most one typo a section, never on the first line
      const bySection = new Map<number, number>();
      p.lines.forEach((l) => l.typing.typo && bySection.set(l.section, (bySection.get(l.section) ?? 0) + 1));
      for (const n of bySection.values()) expect(n).toBeLessThanOrEqual(1);
      expect(p.lines[0]!.typing.typo).toBeNull();
    }
  });
});

describe('colour', () => {
  it('keeps the neutral ramps fixed and the sent bubble at 4.5:1', () => {
    for (const pal of [['#ffffff', '#eeeeee'], ['#f5e663', '#ffd400'], ['#00ff88', '#003311'], ['#1a1a1a', '#333333'], ['#e0574a', '#2f7fe0'], ['#7fd1ff', '#ffe2f0']])
      for (const dark of [true, false]) {
        const t = themeFor(dark, pal);
        expect(t.bg).toBe(dark ? DARK.bg : LIGHT.bg);
        expect(contrastRatio(t.onBubble, t.bubble)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(t.text, t.bg)).toBeGreaterThanOrEqual(7);
      }
  });
});

describe('kits', () => {
  const measure = (f: string, s: string) => {
    const px = Number(/(\d+(?:\.\d+)?)px/.exec(f)?.[1] ?? 16);
    return s.length * px * 0.55;
  };
  it('lay out every kit with the field inside the screen, in both directions', () => {
    for (const kit of KIT_IDS)
      for (const landscape of [true, false])
        for (const rtl of [false, true]) {
          const scr = screenFor(kit, landscape, landscape ? 1280 : 720, landscape ? 720 : 1280);
          const sent = Array.from({ length: 9 }, (_, i) => ({ text: `an earlier line number ${i} that is long enough to wrap`, script: 'latin' as const, atMs: i * 3000, repeat: 1 + (i % 3), line: i }));
          const env: KitEnv = { kit, screen: { w: scr.w, h: scr.h }, size: 30, theme: themeFor(true, ['#e0574a']), script: 'latin', rtl, title: 'T', artist: 'A', section: 'verse', nowMs: 30000, durationMs: 180000, sent, current: 'the line being written right now in the field', upcoming: ['next one'], cover: null, state: 'SCR-UIK-STA-003', measure, seed: 1, phosphor: 'green' };
          const spec = kitSpec(env, () => {});
          const f = spec.field!;
          expect(f).toBeTruthy();
          expect(f.x).toBeGreaterThanOrEqual(0);
          expect(f.x + f.w).toBeLessThanOrEqual(scr.w + 1);
          expect(f.y).toBeGreaterThan(0);
          expect(f.y, `${kit} ${landscape} ${rtl}`).toBeLessThan(scr.h);
          expect(f.rtl).toBe(rtl);
        }
  });
  it('maps every live scene family except the code editor to a kit', () => {
    for (const id of ['01', '02', '03', '04', '05', '06', '08', '09', '10', '11', '12']) expect(KIT_IDS).toContain(SCENE_KIT[`SCR-SCN-${id}`]);
  });
});

describe('asset ids', () => {
  it('are live manifest entries', () => {
    for (const id of [...KIT_IDS, ...PROFILE_IDS, ...TYPO_IDS, ...STICKER_IDS, ...FRAME_IDS, ...ROOM_IDS, ...WALL_IDS, ...GLASS_IDS]) expect(live.has(id), id).toBe(true);
  });
});
