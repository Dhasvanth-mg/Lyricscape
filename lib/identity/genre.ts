// Genre tags -> family shares, subgenre, aesthetics and weak dimension priors.
//
// A tag is only evidence about a genre, never about a single song's mood. The priors below are deliberately small
// (see build.ts: they are blended with, and outvoted by, the lyrics, the delivery pace and the cover).

import { GENRE_FAMILIES, type DimKey, type GenreFamily, type GenreTag } from './types';

type Rule = {
  re: RegExp;
  fam: GenreFamily;
  /** label shown to the listener when this is the most specific thing the tags say */
  sub?: string;
  w: number;
  /** weak priors: dimension -> 0..1 */
  prior?: Partial<Record<DimKey, number>>;
};

// Order matters only for readability: every matching rule counts. More specific rules carry the subgenre label.
const RULES: Rule[] = [
  // ---- hip-hop
  { re: /hip.?hop|\brap\b/, fam: 'hiphop', w: 2.2 },
  { re: /conscious hip|jazz rap|lyrical|storytell|backpack/, fam: 'hiphop', sub: 'conscious hip-hop', w: 1.6, prior: { intimacy: 0.62, energy: 0.4, urgency: 0.35 } },
  { re: /boom.?bap|golden age hip|old school hip|east coast hip/, fam: 'hiphop', sub: 'boom bap', w: 1.4, prior: { nostalgia: 0.6 } },
  { re: /\btrap\b|trap metal|rage|\bdrill\b|uk drill|brooklyn drill|chicago drill|hardcore hip|gangsta|crunk|horrorcore/, fam: 'hiphop', sub: 'hard-edged rap', w: 1.8, prior: { energy: 0.8, urgency: 0.75, tension: 0.65, valence: 0.35 } },
  { re: /cloud rap|emo rap|sad rap|vapor trap|plugg/, fam: 'hiphop', sub: 'cloud rap', w: 1.5, prior: { dreaminess: 0.7, melancholy: 0.6, energy: 0.4 } },
  { re: /pop rap|melodic rap|rap pop/, fam: 'hiphop', sub: 'melodic rap', w: 1.2, prior: { valence: 0.55 } },
  { re: /desi hip|hindi hip|punjabi hip|indian hip|\bgully\b|hinglish/, fam: 'hiphop', sub: 'desi hip-hop', w: 2 },
  { re: /grime|phonk|memphis rap/, fam: 'hiphop', sub: 'underground rap', w: 1.4, prior: { energy: 0.7, tension: 0.6 } },
  { re: /\bg.?funk\b|west coast/, fam: 'hiphop', sub: 'west coast', w: 1.2, prior: { warmth: 0.65 } },
  // ---- r&b
  { re: /r&b|\brnb\b|r and b|urban contemporary|r&b\/soul/, fam: 'rnb', w: 2.2 },
  { re: /contemporary r&b|contemporary rnb/, fam: 'rnb', sub: 'contemporary R&B', w: 1.2, prior: { intimacy: 0.62, warmth: 0.6 } },
  { re: /alternative r&b|alt r&b|alternative rnb|experimental r&b|future r&b/, fam: 'rnb', sub: 'alt R&B', w: 1.8, prior: { intimacy: 0.7, dreaminess: 0.65, energy: 0.3, tension: 0.5 } },
  { re: /neo.?soul|(?<!trap )\bsoul\b|quiet storm/, fam: 'rnb', sub: 'neo-soul', w: 1.5, prior: { warmth: 0.75, intimacy: 0.7, energy: 0.35 } },
  { re: /trap soul|trapsoul|pbr&b|dark r&b/, fam: 'rnb', sub: 'dark R&B', w: 1.6, prior: { valence: 0.35, tension: 0.55, intimacy: 0.68 } },
  { re: /new jack swing|funk|disco soul|motown/, fam: 'rnb', sub: 'funk & soul', w: 1.1, prior: { warmth: 0.72, valence: 0.65 } },
  // ---- pop
  { re: /\bpop\b/, fam: 'pop', w: 1.8 },
  { re: /dance pop|electropop|synth.?pop|teen pop|bubblegum|europop|k-pop|j-pop|latin pop|girl group|boy band/, fam: 'pop', sub: 'pop', w: 1.2, prior: { valence: 0.7, energy: 0.68 } },
  { re: /bollywood|filmi|hindi pop|punjabi pop|desi pop|indian pop/, fam: 'pop', sub: 'Bollywood / desi pop', w: 2, prior: { warmth: 0.68, valence: 0.62 } },
  { re: /kollywood|tamil|tollywood|telugu|malayalam|kannada|south indian|tamil film|tamil pop|tamil cinema/, fam: 'pop', sub: 'South Indian film music', w: 2, prior: { warmth: 0.66, valence: 0.6, energy: 0.62 } },
  { re: /tamil hip|hiphop tamizha|tamil rap|tamil indie|hindi rap|hindi indie|desi indie/, fam: 'hiphop', sub: 'desi hip-hop', w: 1.4 },
  { re: /carnatic|hindustani|ghazal|qawwali|sufi|bhajan|raga|devotional|classical indian|indian classical/, fam: 'atmospheric', sub: 'Indian classical / devotional', w: 1.6, prior: { intimacy: 0.7, dreaminess: 0.55, energy: 0.35 } },
  { re: /art pop|chamber pop|baroque pop|dream pop/, fam: 'pop', sub: 'art pop', w: 1.1, prior: { dreaminess: 0.65, intimacy: 0.6 } },
  { re: /disco|funk pop|new wave pop/, fam: 'pop', sub: 'pop', w: 0.9, prior: { valence: 0.7, warmth: 0.62 } },
  // ---- rock & indie
  { re: /\brock\b|alt rock|alternative rock|hard rock|classic rock|grunge|garage rock|post.?punk|britpop/, fam: 'rock', w: 2.1, prior: { energy: 0.65 } },
  { re: /alt rock|alternative rock|grunge|garage rock|post.?punk|britpop/, fam: 'rock', sub: 'alternative rock', w: 1, prior: { nostalgia: 0.45 } },
  { re: /punk|hardcore|metal|screamo/, fam: 'rock', sub: 'punk / heavy', w: 1.6, prior: { energy: 0.85, urgency: 0.8, tension: 0.7 } },
  { re: /indie rock|garage rock revival|post-punk revival|jangle/, fam: 'rock', sub: 'indie rock', w: 1.2, prior: { nostalgia: 0.5 } },
  { re: /indie|bedroom|lo.?fi indie|indie pop|indietronica/, fam: 'indie', w: 2 },
  { re: /shoegaze|slowcore|dream pop|noise pop/, fam: 'indie', sub: 'shoegaze / dream', w: 1.5, prior: { dreaminess: 0.85, energy: 0.4 } },
  { re: /singer.?songwriter|acoustic|sadcore|chamber folk|anti-?folk/, fam: 'folk', sub: 'singer-songwriter', w: 1.8, prior: { intimacy: 0.85, energy: 0.3, melancholy: 0.55 } },
  { re: /\bfolk\b|americana|country|bluegrass|roots/, fam: 'folk', sub: 'folk', w: 1.7, prior: { warmth: 0.72, nostalgia: 0.6 } },
  { re: /emo\b|midwest emo|pop punk/, fam: 'indie', sub: 'emo', w: 1.5, prior: { melancholy: 0.65, urgency: 0.55 } },
  { re: /psychedelic|psych rock|neo.?psychedelia|krautrock/, fam: 'rock', sub: 'psychedelic', w: 1.3, prior: { dreaminess: 0.8 } },
  // ---- atmospheric
  { re: /ambient|drone|new age|meditation|sleep|\bchill\b|chillout|downtempo|lo.?fi|lofi|study/, fam: 'atmospheric', sub: 'ambient', w: 2.1, prior: { energy: 0.15, tension: 0.15, dreaminess: 0.75 } },
  { re: /piano|classical|neoclassical|instrumental|soundtrack|score|cinematic|post.?rock|trip hop|ethereal|darkwave/, fam: 'atmospheric', sub: 'cinematic', w: 1.7, prior: { energy: 0.3, intimacy: 0.6 } },
  // ---- electronic & experimental
  { re: /electronic|\bedm\b|house|techno|trance|dubstep|garage|uk garage|drum and bass|dnb|synthwave|electro/, fam: 'electronic', w: 1.9, prior: { energy: 0.72 } },
  { re: /hyperpop|glitch|\bidm\b|experimental|avant|noise|industrial|deconstructed|breakcore|vaporwave|witch house|art rock/, fam: 'experimental', w: 2, prior: { tension: 0.6 } },
  { re: /hyperpop|glitch|breakcore|digicore/, fam: 'experimental', sub: 'hyperpop / glitch', w: 0.6, prior: { energy: 0.78, urgency: 0.6 } },
];

/** Aesthetic labels that are carried by the tags themselves (never inferred from the words). */
const AESTHETICS: [RegExp, string][] = [
  [/lo.?fi|lofi/, 'lo-fi'],
  [/vaporwave|synthwave|retrowave|outrun|future funk/, 'retro-futurist'],
  [/chillwave|hypnagogic/, 'chillwave'],
  [/shoegaze/, 'shoegaze'],
  [/psychedelic|psych/, 'psychedelic'],
  [/hyperpop/, 'hyperpop'],
  [/bedroom/, 'bedroom'],
  [/darkwave|goth|witch house|dark ambient/, 'dark'],
  [/cinematic|soundtrack|score/, 'cinematic'],
  [/jazz/, 'jazz-influenced'],
  [/trap/, 'trap production'],
  [/boom.?bap/, 'boom-bap production'],
  [/classic|vintage|retro|oldies|60s|70s|80s|90s|throwback/, 'vintage'],
];

const INSTRUMENTS: [RegExp, string][] = [
  [/piano/, 'piano'],
  [/acoustic|folk|singer.?songwriter/, 'acoustic'],
  [/guitar|surf|shoegaze|rock/, 'guitars'],
  [/synth|electro|electronic|wave/, 'synths'],
  [/orchestr|string|chamber|classical|cinematic/, 'strings / orchestral'],
  [/trap|drill|boom.?bap|hip.?hop/, 'programmed drums'],
];

export type GenreRead = {
  familyShare: Partial<Record<GenreFamily, number>>;
  primary: GenreFamily | null;
  secondary: GenreFamily | null;
  subgenre: string | null;
  /** every subgenre label the tags support, strongest first */
  subgenres: string[];
  aesthetics: string[];
  instrumental: string[];
  /** weight-averaged priors per dimension (+ how much tag weight stands behind them) */
  priors: Partial<Record<DimKey, { v: number; w: number }>>;
};

const norm = (s: string) => s.toLowerCase().replace(/[_]/g, ' ').trim();

export function readGenres(tags: GenreTag[]): GenreRead {
  const fam: Partial<Record<GenreFamily, number>> = {};
  const subScore = new Map<string, number>();
  const aes = new Set<string>();
  const inst = new Set<string>();
  const priorSum: Partial<Record<DimKey, { v: number; w: number }>> = {};
  for (const t of tags) {
    const tag = norm(t.tag);
    if (!tag) continue;
    const tw = Math.max(0.05, Math.min(1, t.weight));
    for (const r of RULES) {
      if (!r.re.test(tag)) continue;
      fam[r.fam] = (fam[r.fam] ?? 0) + r.w * tw;
      if (r.sub) subScore.set(r.sub, (subScore.get(r.sub) ?? 0) + r.w * tw);
      for (const [k, v] of Object.entries(r.prior ?? {}) as [DimKey, number][]) {
        const p = (priorSum[k] ??= { v: 0, w: 0 });
        p.v += v * r.w * tw;
        p.w += r.w * tw;
      }
    }
    for (const [re, label] of AESTHETICS) if (re.test(tag)) aes.add(label);
    for (const [re, label] of INSTRUMENTS) if (re.test(tag)) inst.add(label);
  }
  const total = Object.values(fam).reduce((a, b) => a + b, 0);
  const share: Partial<Record<GenreFamily, number>> = {};
  for (const f of GENRE_FAMILIES) if (fam[f]) share[f] = fam[f]! / total;
  const ranked = (Object.keys(share) as GenreFamily[]).sort((a, b) => share[b]! - share[a]! || GENRE_FAMILIES.indexOf(a) - GENRE_FAMILIES.indexOf(b));
  const primary = ranked[0] ?? null;
  const second = ranked[1];
  const secondary = second && primary && share[second]! >= 0.28 * share[primary]! ? second : null;
  // the most specific label whose family is one of the top two
  const subs = [...subScore.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const subRule = (label: string) => RULES.find((r) => r.sub === label)?.fam;
  const subgenre = subs.find(([label]) => subRule(label) === primary)?.[0] ?? subs[0]?.[0] ?? null;
  const priors: GenreRead['priors'] = {};
  for (const [k, p] of Object.entries(priorSum) as [DimKey, { v: number; w: number }][]) priors[k] = { v: p.v / p.w, w: Math.min(1, p.w / 3) };
  return { familyShare: share, primary, secondary, subgenre, subgenres: subs.map(([l]) => l), aesthetics: [...aes], instrumental: [...inst], priors };
}

/** Does any tag name this aesthetic explicitly (used so a retro-futurist tag can still choose a retro look)? */
export function hasAesthetic(tags: GenreTag[], label: string): boolean {
  return tags.some((t) => AESTHETICS.some(([re, l]) => l === label && re.test(norm(t.tag))));
}
