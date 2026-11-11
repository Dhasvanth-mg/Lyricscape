// The Screenlife song plan (scene-families.md "Deterministic selection" and "Repetition control"). Scene families come from
// the shared planner with this style's rules; then, per song, one device world (seeded by the track id); per section, the app
// kit, composition, theme, room, wallpaper, typing profile, glass, kit state, a sticker for a chorus hook and at most one
// notification; per line, the keystrokes. Pure and cached per timeline, so playback, seeking and export agree.

import { hashString } from '../../kinetic/util';
import type { VisualTimeline } from '../../kinetic/types';
import { sceneData } from '../scene/data';
import { h01, planScenes, type PlannedSection, type ScenePlan, type StyleRules } from '../scene/planner';
import { signalMatch, songSignals, type SongSignals } from '../scene/signals';
import { scriptOf, type Script } from '../sketch-cards/letter';
import type { KitId } from './kits';
import { PLAYFUL_STK, STICKER_IDS, type Notif, type StickerId } from './props';
import { typeLine, type ProfileId, type TypingPlan } from './typing';
import { ROOM_IDS, type FrameId, type GlassId, type RoomId, type WallId } from './world';

export const SCENE_KIT: Record<string, KitId> = {
  'SCR-SCN-01': 'SCR-UIK-APP-001',
  'SCR-SCN-02': 'SCR-UIK-APP-002',
  'SCR-SCN-03': 'SCR-UIK-APP-003',
  'SCR-SCN-04': 'SCR-UIK-APP-004',
  'SCR-SCN-05': 'SCR-UIK-APP-005',
  'SCR-SCN-06': 'SCR-UIK-APP-006',
  'SCR-SCN-08': 'SCR-UIK-APP-008',
  'SCR-SCN-09': 'SCR-UIK-APP-009',
  'SCR-SCN-10': 'SCR-UIK-APP-010',
  'SCR-SCN-11': 'SCR-UIK-APP-012',
  'SCR-SCN-12': 'SCR-UIK-APP-013',
};

export type Comp = 'C1' | 'C2' | 'C3' | 'C4' | 'C6' | 'C7';

export type SectionWorld = {
  ps: PlannedSection;
  kit: KitId;
  comp: Comp;
  dark: boolean;
  room: RoomId;
  wall: WallId;
  profile: ProfileId;
  glass: GlassId | null;
  state: string;
  sticker: StickerId | null;
  notif: Notif | null;
};
export type LineWorld = { line: number; section: number; script: Script; typing: TypingPlan; repeat: number; firstOfSection: boolean };
export type ScreenPlan = {
  plan: ScenePlan;
  song: SongSignals;
  seed: number;
  phone: FrameId;
  desk: FrameId;
  phosphor: 'green' | 'amber';
  sections: SectionWorld[];
  lines: LineWorld[];
};

const has = (song: SongSignals, ...ws: string[]) => ws.some((w) => song.tags.has(w));

export const screenRules = (seed: number): StyleRules => ({
  allowScene(scene, { song }) {
    switch (scene.id) {
      case 'SCR-SCN-07':
        return false; // code editor: only when the song is about code or the user picks it (never by default)
      case 'SCR-SCN-06':
        return has(song, 'electronic', 'industrial', 'techno', 'cold', 'synth') || signalMatch(scene.signals, song) > 0.2;
      case 'SCR-SCN-11':
        return has(song, 'travel', 'night', 'city', 'driving', 'road');
      case 'SCR-SCN-12':
        return has(song, 'memory', 'nostalgia', 'older') || h01(seed, 'plaid') < 0.15;
      default:
        return true;
    }
  },
  maxScenePerSong: 3,
});

const cache = new WeakMap<object, Map<string, ScreenPlan>>();

function compOf(ps: PlannedSection, kit: KitId): Comp {
  if (kit === 'SCR-UIK-APP-008') return 'C6';
  if (kit === 'SCR-UIK-APP-006') return ps.composition.id === 'SCR-CMP-C3' ? 'C3' : 'C7';
  if (kit === 'SCR-UIK-APP-013' || kit === 'SCR-UIK-APP-004') return ps.composition.id === 'SCR-CMP-C2' ? 'C2' : 'C3';
  if (kit === 'SCR-UIK-APP-012') return 'C1';
  const id = ps.composition.id.replace('SCR-CMP-', '');
  // C5 two screens is not built yet (blockers B-09): its sections use the thread scroll
  if (id === 'C5' || id === 'C3' || id === 'C6' || id === 'C7') return 'C4';
  return id as Comp;
}

/** `cover`: whether the song has a readable cover (the composer's photo and the cover wallpapers need one) */
export function screenPlan(tl: VisualTimeline, reduced: boolean, cover: boolean): ScreenPlan {
  const key = `${reduced ? 1 : 0}${cover ? 1 : 0}`;
  let byKey = cache.get(tl);
  if (!byKey) cache.set(tl, (byKey = new Map()));
  const hit = byKey.get(key);
  if (hit) return hit;
  const seed = hashString(`${tl.trackId}|SCR`);
  const data = sceneData('screenlife');
  const song = songSignals(tl);
  const plan = planScenes({ tl, data, song, rules: screenRules(seed) });
  // the device world: one phone and one desk device per song (track hash)
  const phones: FrameId[] = ['SCR-FRM-DEV-001', 'SCR-FRM-DEV-001', 'SCR-FRM-DEV-010', 'SCR-FRM-DEV-002', 'SCR-FRM-DEV-003'];
  const phone = song.dark ? 'SCR-FRM-DEV-003' : phones[Math.floor(h01(seed, 'phone') * phones.length)]!;
  const desk: FrameId = h01(seed, 'desk') < 0.5 ? 'SCR-FRM-DEV-005' : 'SCR-FRM-DEV-006';
  const phosphor = h01(seed, 'phos') < 0.6 ? 'green' : 'amber';
  // night and dark moods choose the dark theme; morning and light moods the light one
  const songDark = song.dark || has(song, 'night', 'dark', 'sadness', 'calm') || (song.valence ?? 0) < 0.2;
  // the room follows the song's subjects (identity), seeded among the matches
  const roomPool: RoomId[] = [];
  if (has(song, 'night', 'love', 'romance')) roomPool.push('SCR-ENV-ROM-001');
  if (has(song, 'rain')) roomPool.push('SCR-ENV-ROM-005');
  if (has(song, 'travel')) roomPool.push('SCR-ENV-ROM-003', 'SCR-ENV-ROM-007');
  if (has(song, 'city')) roomPool.push('SCR-ENV-ROM-008', 'SCR-ENV-ROM-005');
  if (has(song, 'home')) roomPool.push(songDark ? 'SCR-ENV-ROM-004' : 'SCR-ENV-ROM-002');
  if (has(song, 'dance', 'energetic')) roomPool.push('SCR-ENV-ROM-009');
  if (has(song, 'grief')) roomPool.push('SCR-ENV-ROM-011');
  if (!roomPool.length) roomPool.push(...(songDark ? (['SCR-ENV-ROM-001', 'SCR-ENV-ROM-004', 'SCR-ENV-ROM-006'] as RoomId[]) : (['SCR-ENV-ROM-002', 'SCR-ENV-ROM-006', 'SCR-ENV-ROM-010'] as RoomId[])));
  const songRoom = roomPool[Math.floor(h01(seed, 'room') * roomPool.length)]!;
  const walls: WallId[] = cover ? ['SCR-PRC-WAL-001', 'SCR-PRC-WAL-002', 'SCR-PRC-WAL-004', 'SCR-PRC-WAL-006'] : ['SCR-PRC-WAL-003', 'SCR-PRC-WAL-004', 'SCR-PRC-WAL-006', 'SCR-PRC-WAL-005'];
  const songWall = walls[Math.floor(h01(seed, 'wall') * walls.length)]!;
  let stickersUsed = 0;
  const used = new Set<string>();
  const sections: SectionWorld[] = plan.sections.map((ps, i) => {
    const kit = SCENE_KIT[ps.scene.id] ?? 'SCR-UIK-APP-001';
    const comp = compOf(ps, kit);
    const role = ps.section.role;
    const e = ps.section.energy;
    // the bridge may flip the theme; notes and lists are written on light paper unless the song is dark
    let dark = songDark;
    if ((kit === 'SCR-UIK-APP-002' || kit === 'SCR-UIK-APP-010') && !song.dark) dark = false;
    if (role === 'bridge' && h01(seed, 'flip', i) < 0.5) dark = !dark;
    if (kit === 'SCR-UIK-APP-005' && has(song, 'dance', 'energetic')) dark = true;
    // typing profile from energy (the line's time sets the speed; the profile only the rhythm)
    const calm: ProfileId[] = ['SCR-MOT-TYP-002', 'SCR-MOT-TYP-003', 'SCR-MOT-TYP-006'];
    const normal: ProfileId[] = ['SCR-MOT-TYP-001', 'SCR-MOT-TYP-005', 'SCR-MOT-TYP-002'];
    const hot: ProfileId[] = ['SCR-MOT-TYP-004', 'SCR-MOT-TYP-001'];
    const pool = e < -0.2 || role === 'quiet' ? calm : e > 0.25 || ps.section.tags.includes('high') ? hot : normal;
    let profile = pool[Math.floor(h01(seed, 'prof', i) * pool.length)]!;
    if (kit === 'SCR-UIK-APP-009' || kit === 'SCR-UIK-APP-008' || kit === 'SCR-UIK-APP-012') profile = 'SCR-MOT-TYP-010';
    // a room for the over-the-shoulder and face-on compositions; choruses of the post composer go to event lights
    const room: RoomId = kit === 'SCR-UIK-APP-005' && role === 'chorus' ? 'SCR-ENV-ROM-009' : kit === 'SCR-UIK-APP-012' ? 'SCR-ENV-ROM-007' : songRoom;
    // glass: never on CRT kits; light themes get only the faintest plates
    const glassPool: GlassId[] = ['SCR-TEX-GLS-001', 'SCR-TEX-GLS-002', 'SCR-TEX-GLS-003', 'SCR-TEX-GLS-004'];
    const glass: GlassId | null = kit === 'SCR-UIK-APP-006' || kit === 'SCR-UIK-APP-013' ? (kit === 'SCR-UIK-APP-013' ? 'SCR-TEX-GLS-005' : null) : glassPool[Math.floor(h01(seed, 'glass', i) * glassPool.length)]!;
    // the kit's state for the section
    const states: Partial<Record<KitId, string[]>> = {
      'SCR-UIK-APP-001': role === 'chorus' && ps.section.chorusOrdinal > 1 ? ['SCR-UIK-STA-006'] : ['SCR-UIK-STA-003', 'SCR-UIK-STA-004'],
      'SCR-UIK-APP-002': ['SCR-UIK-STA-010', 'SCR-UIK-STA-011'],
      'SCR-UIK-APP-003': ['SCR-UIK-STA-015', 'SCR-UIK-STA-016'],
      'SCR-UIK-APP-004': ['SCR-UIK-STA-018'],
      'SCR-UIK-APP-005': ['SCR-UIK-STA-022'],
      'SCR-UIK-APP-006': ['SCR-UIK-STA-025'],
      'SCR-UIK-APP-008': ['SCR-UIK-STA-033'],
      'SCR-UIK-APP-009': ['SCR-UIK-STA-036'],
      'SCR-UIK-APP-010': ['SCR-UIK-STA-039'],
      'SCR-UIK-APP-012': ['SCR-UIK-STA-043'],
      'SCR-UIK-APP-013': ['SCR-UIK-STA-045'],
    };
    const sp = states[kit] ?? ['SCR-UIK-STA-003'];
    const state = sp[Math.floor(h01(seed, 'state', i) * sp.length)]!;
    // stickers: choruses only, at most one a section and two a song; never on terminals or the old desktop
    let sticker: StickerId | null = null;
    if (role === 'chorus' && stickersUsed < 2 && (kit === 'SCR-UIK-APP-001' || kit === 'SCR-UIK-APP-005' || kit === 'SCR-UIK-APP-010')) {
      const options = STICKER_IDS.filter((s) => !used.has(s) && !(song.dark && PLAYFUL_STK.has(s)));
      sticker = options[Math.floor(h01(seed, 'stk', i) * options.length)] ?? null;
      if (sticker) {
        used.add(sticker);
        stickersUsed++;
      }
    }
    // one notification at most, from metadata and sung lines only
    const title = (tl.label ?? '').split('•')[0]?.trim() || 'Untitled';
    const artist = (tl.label ?? '').split('•')[1]?.trim() || 'Unknown artist';
    let notif: Notif | null = null;
    const prevChorus = i > 0 && plan.sections[i - 1]!.section.role === 'chorus';
    const firstLine = ps.section.lines ? tl.scenes[ps.section.lines[0]]!.words.map((w) => w.text).join(' ') : '';
    if (role === 'intro') notif = { id: 'SCR-PRP-NTF-006', title: 'Download complete', body: title, atMs: ps.section.startMs };
    else if (role === 'outro') notif = { id: 'SCR-PRP-NTF-001', title: artist, body: title, atMs: ps.section.startMs };
    else if (role === 'break' && prevChorus) notif = { id: 'SCR-PRP-NTF-002', title: 'Missed call', body: artist, atMs: ps.section.startMs };
    else if (role === 'quiet' || role === 'break') notif = { id: 'SCR-PRP-NTF-007', title: 'Do not disturb', body: title, atMs: ps.section.startMs };
    else if (kit === 'SCR-UIK-APP-010' && role === 'chorus' && firstLine) notif = { id: 'SCR-PRP-NTF-008', title: 'Every day', body: firstLine, atMs: ps.section.startMs };
    else if (kit === 'SCR-UIK-APP-009') notif = { id: 'SCR-PRP-NTF-005', title: 'Now recording', body: title, atMs: ps.section.startMs };
    if (ps.section.endMs > tl.durationMs * 0.9 && role !== 'outro' && role !== 'intro') notif = { id: 'SCR-PRP-NTF-003', title: 'Low battery', body: `${Math.max(1, Math.round((1 - ps.section.startMs / Math.max(1, tl.durationMs)) * 100))}% of the song left`, atMs: ps.section.startMs };
    return { ps, kit, comp, dark, room, wall: kit === 'SCR-UIK-APP-013' ? 'SCR-PRC-WAL-007' : songWall, profile, glass, state, sticker, notif };
  });

  const sectionOf = (li: number) => Math.max(0, plan.sections.findIndex((ps) => ps.section.lines && li >= ps.section.lines[0] && li <= ps.section.lines[1]));
  const seen = new Map<string, number>();
  const typoLine = new Map<number, number>();
  for (let si = 0; si < plan.sections.length; si++) {
    const L = plan.sections[si]!.section.lines;
    if (!L) continue;
    // at most one typo a section, never on the song's first line
    const n = L[1] - L[0] + 1;
    const pick = L[0] + Math.floor(h01(seed, 'typoLine', si) * n);
    if (pick > 0) typoLine.set(si, pick);
  }
  const lines: LineWorld[] = tl.scenes.map((sc, li) => {
    const si = sectionOf(li);
    const sw = sections[si]!;
    const text = sc.words.map((w) => w.text).join(' ');
    const norm = text.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, '').trim();
    const repeat = (seen.get(norm) ?? 0) + 1;
    seen.set(norm, repeat);
    const next = tl.scenes[li + 1];
    const untilMs = Math.min(next ? next.startMs - 30 : Infinity, sc.endMs + 1600);
    const script = scriptOf(text) as Script;
    // repeated lines are resent, never retyped from scratch more than twice
    let profile = sw.profile;
    if (repeat === 2 && profile !== 'SCR-MOT-TYP-010') profile = 'SCR-MOT-TYP-009';
    if (repeat >= 3 && profile !== 'SCR-MOT-TYP-010') profile = 'SCR-MOT-TYP-008';
    const firstOfSection = !!sw.ps.section.lines && sw.ps.section.lines[0] === li;
    if (li === 0 && profile !== 'SCR-MOT-TYP-010') profile = 'SCR-MOT-TYP-002'; // the first line is typed slowly, to establish the act
    const typing = typeLine({ words: sc.words, startMs: sc.startMs - 30, untilMs, script, profile, reduced, seed: hashString(`${seed}|line|${li}`), allowTypo: typoLine.get(si) === li && repeat === 1 });
    return { line: li, section: si, script, typing, repeat, firstOfSection };
  });
  const out: ScreenPlan = { plan, song, seed, phone, desk, phosphor, sections, lines };
  byKey.set(key, out);
  return out;
}

export { ROOM_IDS };
