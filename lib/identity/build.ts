// buildIdentity(): evidence in, a SongIdentity out. Pure and deterministic: same inputs, same profile.
//
// Principles
//  - every emotional dimension is separate, so a song can be warm AND tense, or intimate AND intense;
//  - a dimension with no evidence stays unknown (v = null) rather than becoming "medium";
//  - evidence from different sources is blended by weight, and DISAGREEMENT between sources lowers confidence and raises
//    ambiguity instead of being averaged away;
//  - genre tags move things only a little (they describe an artist's catalogue, not this song);
//  - nothing here pretends to hear the music. What would need audio is listed under provenance.unknown.

import { MOTIFS, type MotifId } from '../kinetic/emotion';
import { readGenres } from './genre';
import { lyricStats } from './lyricStats';
import { detectDocLanguage } from '../lyrics/script';
import { rate, readText } from './text';
import { AI_CONF_CAP } from './ai';
import { GENRE_LABEL, DIM_KEYS, clamp01, knownDim, type Delivery, type Dim, type DimKey, type IdentityInputs, type ProvenanceRow, type Source, type SongIdentity } from './types';

type Ev = { v: number; w: number; src: Source };

const UNKNOWN: Dim = { v: null, conf: 0, src: [] };

/** Weighted blend. Agreement raises confidence; spread between the pieces lowers it. */
export function blend(evs: Ev[]): Dim {
  const W = evs.reduce((a, e) => a + e.w, 0);
  if (W < 0.35) return { ...UNKNOWN };
  const mean = evs.reduce((a, e) => a + e.w * e.v, 0) / W;
  const spread = Math.sqrt(evs.reduce((a, e) => a + e.w * (e.v - mean) ** 2, 0) / W);
  const conf = (1 - Math.exp(-W / 1.4)) * (1 - Math.min(0.6, spread * 1.3));
  const srcs = [...new Set(evs.filter((e) => e.w >= 0.1).map((e) => e.src))];
  return { v: Math.round(clamp01(mean) * 1000) / 1000, conf: Math.round(conf * 100) / 100, src: srcs };
}

const sat = (x: number, half: number) => x / (x + half);
const round2 = (n: number) => Math.round(n * 100) / 100;

function hashStr(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

export function identityKey(inp: IdentityInputs): string {
  const doc = inp.lyrics;
  const lyr = doc ? `${doc.lines.length}:${doc.lines.reduce((a, l) => a + l.words.length, 0)}:${Math.round(doc.lines[doc.lines.length - 1]?.startMs ?? 0)}:${doc.timing?.source ?? doc.source}` : '-';
  const cov = inp.cover ? `${inp.cover.light.toFixed(2)},${inp.cover.vibrance.toFixed(2)},${(inp.cover.warmth ?? -1).toFixed(2)}` : '-';
  const tags = inp.tags.map((t) => `${t.tag}:${t.weight.toFixed(2)}`).sort().join('|');
  const ai = inp.ai ? `${inp.ai.model ?? ''}${inp.ai.generatedAt ?? ''}` : '-';
  return hashStr([inp.trackId, tags, lyr, inp.bpm ?? '-', cov, inp.releaseYear ?? '-', inp.album ?? '-', ai, JSON.stringify(inp.corrections ?? null)].join('#'));
}

const cache = new Map<string, SongIdentity>();

export function buildIdentity(inp: IdentityInputs): SongIdentity {
  const key = identityKey(inp);
  const hit = cache.get(key);
  if (hit) return hit;
  const id = compute(inp, key);
  if (cache.size > 60) cache.delete(cache.keys().next().value as string);
  cache.set(key, id);
  return id;
}

function compute(inp: IdentityInputs, key: string): SongIdentity {
  const g = readGenres(inp.tags);
  const text = readText(inp.lyrics);
  const stats = lyricStats(inp.lyrics);
  // The mood word lists are strongest in English and thinner in other languages, and absent for some. How much "none of these words
  // appeared" may count as evidence follows that, so a Turkish or Thai song is never called "not sad" just because we cannot read it.
  const lang = inp.lyrics && inp.lyrics.lines.length >= 3 ? detectDocLanguage(inp.lyrics) : null;
  const COVERED = ['hi', 'ta', 'hi-latn', 'ta-latn', 'es', 'fr', 'pt', 'de', 'it', 'ko', 'ja', 'zh', 'ru', 'ar'];
  const absenceScale = !lang || lang.id === 'en' || lang.id === 'unknown' ? 1 : COVERED.includes(lang.id) ? 0.45 : 0;
  const pace = stats?.pace;
  const cover = inp.cover ?? null;
  const ai = inp.ai ?? null;
  const ev: Record<DimKey, Ev[]> = Object.fromEntries(DIM_KEYS.map((k) => [k, [] as Ev[]])) as Record<DimKey, Ev[]>;
  const push = (k: DimKey, v: number, w: number, src: Source) => {
    if (w > 0.02 && Number.isFinite(v)) ev[k].push({ v: clamp01(v), w, src });
  };

  // ---- 1. genre tags: weak priors about the catalogue, not the song ----------------------------------------------------
  for (const [k, p] of Object.entries(g.priors) as [DimKey, { v: number; w: number }][]) push(k, p.v, 0.45 * p.w, 'genre');
  if (g.aesthetics.includes('vintage')) push('nostalgia', 0.75, 0.4, 'genre');
  if (g.aesthetics.includes('dark')) push('valence', 0.3, 0.3, 'genre');
  if (g.aesthetics.includes('lo-fi') || g.aesthetics.includes('bedroom')) push('intimacy', 0.72, 0.3, 'genre');
  if (g.aesthetics.includes('chillwave') || g.aesthetics.includes('shoegaze')) push('dreaminess', 0.85, 0.4, 'genre');

  // ---- 2. lyric text ----------------------------------------------------------------------------------------------------
  if (text && text.words >= 40) {
    const R = (c: Parameters<typeof rate>[1]) => rate(text, c);
    const cat = text.cat;
    const pos = R('joy') + 0.8 * R('love') + 0.3 * R('energy') + 0.2 * R('calm') + 0.3 * R('warm');
    const neg = R('sadness') + 0.9 * R('anger') + 0.8 * R('dark') + 0.6 * R('tension') + 0.3 * R('cold');
    const absence = (text.words >= 120 ? 0.22 : 0.1) * absenceScale; // plenty of words and none of these: weak evidence of "not this"
    const lex = (k: DimKey, v: number, mass: number) => push(k, v, Math.max(absence, Math.min(0.9, mass / 5)), 'lyrics');
    if (pos + neg > 0.3) push('valence', 0.5 + (0.5 * (pos - neg)) / (pos + neg + 1.2), Math.min(1.1, text.hits / 8), 'lyrics');
    if (R('energy') + R('calm') > 0.2) push('energy', 0.5 + (0.5 * (R('energy') - R('calm'))) / (R('energy') + R('calm') + 1), Math.min(0.45, (cat.energy + cat.calm) / 10), 'lyrics');
    lex('tension', 0.2 + 0.8 * sat(R('tension') + 0.5 * R('anger') + 0.3 * R('dark'), 1.8), cat.tension + 0.5 * cat.anger);
    if (R('warm') + R('cold') > 0.2) push('warmth', 0.5 + (0.5 * (R('warm') - R('cold'))) / (R('warm') + R('cold') + 1), Math.min(0.6, (cat.warm + cat.cold) / 8), 'lyrics');
    lex('nostalgia', sat(R('nostalgia'), 1.0), cat.nostalgia);
    lex('melancholy', sat(R('sadness') + 0.4 * R('dark') + 0.3 * R('cold'), 1.6), cat.sadness + 0.4 * cat.dark);
    lex('urgency', sat(R('anger') + 0.6 * R('energy') + 0.5 * R('tension') + (stats?.exclaims ?? 0) * 2, 2), cat.anger + cat.energy * 0.6);
    lex('dreaminess', sat(R('calm'), 1.4), cat.calm);
  }
  if (stats && stats.words >= 40) {
    // who is speaking to whom: first-person, close address reads intimate; "we / everybody" reads expansive
    push('intimacy', 0.4 + stats.firstPerson * 4 + stats.secondPerson * 1.2 - stats.plural * 5 - (stats.perspective === 'narrative' ? 0.08 : 0), 0.7, 'lyrics');
    push('tension', 0.2 + Math.min(0.5, stats.questions * 1.2), 0.15, 'lyrics');
  }

  // ---- 3. delivery pace (needs line-synced lyrics; spread-out plain text has no pace) ------------------------------------
  if (pace !== undefined) {
    push('energy', (pace - 1.0) / 3.4, 0.7, 'pace');
    push('urgency', (pace - 1.6) / 3.2, 0.35, 'pace');
    push('intimacy', 1 - (pace - 1) / 3.5, 0.3, 'pace');
    if (pace < 1.4) push('dreaminess', 0.6, 0.2, 'pace');
  }

  // ---- 4. tempo (only when the track carries one: demo / imported audio) -------------------------------------------------
  if (inp.bpm) {
    push('energy', (inp.bpm - 60) / 90, 1, 'tempo');
    push('urgency', (inp.bpm - 90) / 80, 0.25, 'tempo');
    if (inp.bpm >= 112) push('valence', 0.58, 0.25, 'tempo');
    else if (inp.bpm < 84) {
      push('valence', 0.42, 0.2, 'tempo');
      push('melancholy', 0.6, 0.15, 'tempo');
    }
  }

  // ---- 5. the cover -----------------------------------------------------------------------------------------------------
  if (cover) {
    if (cover.light < 0.25) {
      push('valence', 0.4, 0.3, 'cover');
      if (cover.vibrance < 0.25) push('melancholy', 0.6, 0.2, 'cover');
    } else if (cover.light > 0.55 && cover.vibrance > 0.4) push('valence', 0.62, 0.25, 'cover');
    if (cover.warmth !== undefined) push('warmth', cover.warmth, 0.4, 'cover');
    push('energy', 0.35 + cover.vibrance * 0.5, 0.12, 'cover');
  }

  // ---- 6. an AI interpretation, when the listener allowed one (its confidence is capped: it read text, it did not listen) ---
  if (ai) for (const k of DIM_KEYS) if (ai.dims?.[k]) push(k, ai.dims[k]!.v, Math.min(AI_CONF_CAP, ai.dims[k]!.conf) * 1.1, 'ai');

  const corr = inp.corrections ?? null;
  const emo = {} as Record<DimKey, Dim>;
  for (const k of DIM_KEYS) {
    let d = blend(ev[k]);
    const adj = corr?.adjust[k] ?? 0;
    if (adj !== 0) d = { v: round2(clamp01((d.v ?? 0.5) + adj)), conf: Math.max(d.conf, 0.85), src: [...new Set([...d.src, 'user' as Source])] };
    emo[k] = d;
  }

  // ---- ambiguity: mixed feelings in the words, and sources that disagree ---------------------------------------------------
  const ambiguity = ((): Dim => {
    const parts: { v: number; w: number; src: Source }[] = [];
    if (text && text.words >= 40) {
      const R = (c: Parameters<typeof rate>[1]) => rate(text, c);
      const pos = R('joy') + 0.8 * R('love') + 0.3 * R('energy') + 0.3 * R('warm');
      const neg = R('sadness') + 0.9 * R('anger') + 0.8 * R('dark') + 0.6 * R('tension');
      if (pos + neg > 0.6) parts.push({ v: (2 * Math.min(pos, neg)) / (pos + neg + 0.01), w: Math.min(0.9, text.hits / 10), src: 'lyrics' });
      const masses = (['joy', 'love', 'sadness', 'anger', 'dark', 'calm', 'energy', 'nostalgia'] as const).map((c) => text.cat[c]);
      const tot = masses.reduce((a, b) => a + b, 0);
      if (tot > 4) {
        const h = -masses.reduce((a, m) => (m > 0 ? a + (m / tot) * Math.log(m / tot) : a), 0) / Math.log(masses.length);
        parts.push({ v: h, w: Math.min(0.5, tot / 14), src: 'lyrics' });
      }
    }
    const val = ev.valence;
    const sources = new Set(val.map((e) => e.src));
    if (sources.size >= 2) {
      const W = val.reduce((a, e) => a + e.w, 0);
      const mean = val.reduce((a, e) => a + e.w * e.v, 0) / W;
      const spread = Math.sqrt(val.reduce((a, e) => a + e.w * (e.v - mean) ** 2, 0) / W);
      parts.push({ v: Math.min(1, spread * 2.4), w: 0.5, src: 'cover' });
    }
    if (ai?.ambiguity) parts.push({ v: ai.ambiguity.v, w: Math.min(AI_CONF_CAP, ai.ambiguity.conf), src: 'ai' });
    return blend(parts);
  })();

  // ---- delivery & rhythm ----------------------------------------------------------------------------------------------------
  const hip = g.familyShare.hiphop ?? 0;
  let delivery: { kind: Delivery; conf: number } = { kind: 'unknown', conf: 0 };
  if (pace !== undefined) {
    if (pace >= 3.1) delivery = { kind: 'rapped', conf: round2(0.6 + hip * 0.3) };
    else if (pace >= 2.3) delivery = hip > 0.5 ? { kind: 'rapped', conf: 0.5 } : { kind: 'mixed', conf: 0.4 };
    else delivery = hip > 0.6 && pace > 1.8 ? { kind: 'mixed', conf: 0.4 } : { kind: 'sung', conf: round2(0.55 - hip * 0.2) };
  } else if (hip > 0.6) delivery = { kind: 'rapped', conf: 0.35 };
  else if (g.primary) delivery = { kind: 'sung', conf: 0.3 };
  if (delivery.kind === 'unknown' && ai?.delivery) delivery = { kind: ai.delivery, conf: 0.3 };

  const rhythmEv: Ev[] = [];
  if (pace !== undefined) rhythmEv.push({ v: (pace - 1.2) / 3.0, w: 1, src: 'pace' });
  if (inp.bpm) rhythmEv.push({ v: (inp.bpm - 60) / 90, w: 0.8, src: 'tempo' });
  if (hip > 0.4) rhythmEv.push({ v: 0.65, w: 0.3 * hip, src: 'genre' });
  const rhythm = blend(rhythmEv.map((e) => ({ ...e, v: clamp01(e.v) })));

  const pacing: SongIdentity['musical']['pacing'] = pace === undefined ? { label: 'unknown' } : { label: pace < 1.6 ? 'slow' : pace < 3.0 ? 'moderate' : 'fast', wordsPerSecond: round2(pace) };

  // ---- lyrical + cultural -----------------------------------------------------------------------------------------------------
  const subjects = [...(text?.subjects.map((s) => s.label) ?? [])];
  for (const s of ai?.subjects ?? []) if (!subjects.includes(s)) subjects.push(s);
  const motifs: MotifId[] = [];
  for (const m of [...(text?.subjects.flatMap((s) => s.motifs) ?? []), ...(ai?.motifs ?? [])]) if ((MOTIFS as readonly string[]).includes(m) && !motifs.includes(m)) motifs.push(m);

  // ---- taste -----------------------------------------------------------------------------------------------------------------------
  const taste = corr?.taste ?? { cinematic: 0, experimental: 0, minimal: 0 };

  // ---- provenance --------------------------------------------------------------------------------------------------------------------
  const tagSources = [...new Set(inp.tags.map((t) => t.source))];
  const rows: ProvenanceRow[] = [
    { source: 'genre', used: inp.tags.length > 0, detail: inp.tags.length ? `${inp.tags.length} tag${inp.tags.length === 1 ? '' : 's'} from ${tagSources.join(' + ')}` : 'no genre tags for this artist' },
    { source: 'lyrics', used: !!text && text.words >= 40, detail: text ? `${Math.round(text.words)} words read${lang && lang.id !== 'en' && lang.id !== 'unknown' ? ` (${lang.label})` : ''} (a word list, not understanding)` : 'no lyrics loaded' },
    { source: 'pace', used: pace !== undefined, detail: pace !== undefined ? `${pace.toFixed(1)} words per second` : 'needs line-synced lyrics' },
    { source: 'cover', used: !!cover, detail: cover ? 'brightness, colourfulness and colour temperature of the cover' : 'cover not read' },
    { source: 'tempo', used: !!inp.bpm, detail: inp.bpm ? `${Math.round(inp.bpm)} BPM` : 'not available (Spotify exposes no audio features)' },
    { source: 'metadata', used: !!(inp.album || inp.releaseYear), detail: [inp.album, inp.releaseYear].filter(Boolean).join(' · ') || 'no album details' },
    { source: 'ai', used: !!ai, detail: ai ? `AI reading of the lyric text (${ai.model ?? 'model'}), confidence capped at ${AI_CONF_CAP}` : 'off or not available' },
    { source: 'user', used: !!corr && corr.history.length > 0, detail: corr?.history.length ? `${corr.history.length} correction${corr.history.length === 1 ? '' : 's'} from you` : 'no corrections' },
  ];
  const reported: string[] = [];
  if (inp.tags.length) reported.push('genre tags');
  if (inp.releaseYear) reported.push('release year');
  if (inp.album) reported.push('album');
  const inferred: string[] = [];
  if (text) inferred.push('mood words in the lyrics');
  if (pace !== undefined) inferred.push('delivery pace');
  if (cover) inferred.push('cover colour and light');
  if (ai) inferred.push('AI reading of lyric themes');
  const unknown = ['timbre, harmony and production (no audio analysis)', 'how the recording builds through its sections', "the artist's influences and intentions (never inferred)"];
  if (!inp.bpm) unknown.unshift('tempo');
  if (lang && !['en', 'unknown'].includes(lang.id)) unknown.unshift(COVERED.includes(lang.id) ? `mood from the words is approximate for ${lang.label} lyrics (a small word list)` : `mood from the words (this app has no word list for ${lang.label})`);

  const genreW = Math.min(1, inp.tags.reduce((a, t) => a + t.weight, 0) / 3);
  const evidence = clamp01(0.35 * genreW + 0.35 * (text ? Math.min(1, text.hits / 12) : 0) + 0.15 * (pace !== undefined ? 1 : 0) + 0.15 * (cover ? 1 : 0));

  return {
    version: 2,
    trackId: inp.trackId,
    key,
    musical: {
      primaryGenre: g.primary,
      secondaryGenre: g.secondary,
      familyShare: g.familyShare,
      subgenre: g.subgenre,
      subgenres: g.subgenres,
      tags: inp.tags,
      delivery,
      rhythm,
      pacing,
      instrumental: g.instrumental,
    },
    emotional: { ...emo, ambiguity },
    lyrical: { stats, subjects: subjects.slice(0, 4), motifs: motifs.slice(0, 4) },
    cultural: { era: inp.releaseYear ? Math.floor(inp.releaseYear / 10) * 10 : null, album: inp.album ?? null, aesthetics: g.aesthetics, influences: [] },
    taste,
    provenance: { rows, reported, inferred, unknown },
    evidence: round2(evidence),
    ai: !!ai,
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Describing a profile to the listener
// ---------------------------------------------------------------------------------------------------------------------
type Word = { score: number; word: string; theme: string };

export function describeIdentity(id: SongIdentity): { headline: string; words: string[]; genre: string | null; why: string[]; limits: string[] } {
  const e = id.emotional;
  const known = (k: DimKey, min = 0.3) => knownDim(id, k, min);
  const cands: Word[] = [];
  const dev = (k: DimKey, hi: string, lo: string | null, theme: string, thr = 0.62) => {
    const v = known(k);
    if (v === null) return;
    if (v >= thr) cands.push({ score: (v - 0.5) * e[k].conf, word: hi, theme });
    else if (lo && v <= 1 - thr) cands.push({ score: (0.5 - v) * e[k].conf, word: lo, theme });
  };
  const dream = known('dreaminess');
  const energy = known('energy');
  if (dream !== null && dream >= 0.62 && (energy === null || energy < 0.5)) cands.push({ score: (dream - 0.5) * e.dreaminess.conf * 1.2, word: 'Atmospheric', theme: 'dream' });
  else dev('dreaminess', 'Dreamy', null, 'dream');
  dev('melancholy', 'Melancholic', null, 'mood');
  dev('nostalgia', 'Nostalgic', null, 'time');
  dev('urgency', 'Urgent', null, 'push');
  dev('tension', 'Tense', 'Relaxed', 'push', 0.66);
  dev('valence', 'Uplifting', 'Dark', 'mood', 0.64);
  dev('warmth', 'Warm', 'Cool', 'temp');
  dev('energy', 'Intense', 'Calm', 'energy');
  dev('intimacy', 'Intimate', 'Expansive', 'close');
  const words: string[] = [];
  const themes = new Set<string>();
  for (const c of cands.sort((a, b) => b.score - a.score || a.word.localeCompare(b.word))) {
    if (themes.has(c.theme) || words.length >= 2) continue;
    themes.add(c.theme);
    words.push(c.word);
  }
  if (e.ambiguity.v !== null && e.ambiguity.conf >= 0.35 && e.ambiguity.v >= 0.6 && words.length < 3) words.push('Mixed feelings');
  const genre = id.musical.subgenre ?? (id.musical.primaryGenre ? GENRE_LABEL[id.musical.primaryGenre] : null);
  const headline = [...words, ...(genre ? [genre.charAt(0).toUpperCase() + genre.slice(1)] : [])].join(' · ') || (id.evidence >= 0.15 ? 'No strong mood signal yet' : 'Not enough information yet');
  const why: string[] = id.provenance.rows.filter((r) => r.used).map((r) => `${r.source}: ${r.detail}`);
  return { headline, words, genre, why, limits: id.provenance.unknown };
}
