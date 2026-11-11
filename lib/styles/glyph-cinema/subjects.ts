// The Glyph Cinema subject library (GLY-ENV-SUB-001..062) as data: which scene family each subject belongs to, where its
// focal area sits (so the lyric band takes the other third), its motion channel, and the lyric words that call it. The pictures
// themselves are drawn by shader.ts (subject index i = GLY-ENV-SUB-(i + 1)). Selection is title first, then the lyrics, then a
// seeded pick inside the section's scene family, so a song about the sea gets the sea and a song about nothing in particular
// gets a stable choice. Pure.

export type Focal = 'centre' | 'high' | 'low';
export type SubjectDef = {
  id: string;
  name: string;
  family: string;
  focal: Focal;
  motion: string;
  /** a round subject (the spiral calligram rule applies) */
  round?: boolean;
  words: string;
};

const S = (n: number, name: string, family: string, focal: Focal, motion: string, words: string, round = false): SubjectDef => ({
  id: `GLY-ENV-SUB-${String(n).padStart(3, '0')}`,
  name,
  family: `GLY-SCN-${String(family).padStart(2, '0')}`,
  focal,
  motion: `GLY-MOT-ANI-${motion}`,
  round,
  words,
});

export const SUBJECTS: SubjectDef[] = [
  S(1, 'Eye', '07', 'centre', '006', 'eye eyes look looking stare staring see seeing watch watching gaze vision blink', true),
  S(2, 'Highway at night', '02', 'low', '003', 'car cars drive driving drove driver highway freeway speed speeding race racing engine wheel wheels e85 ride riding ferrari lambo porsche mph gas fuel motorway autobahn truck cruise cruising pedal dashboard backseat turbo drift asphalt traffic lane'),
  S(3, 'Slow lights', '09', 'high', '011', 'flash flashing light lights strobe neon glow glowing disco club spotlight spotlights siren blink flicker camera cameras paparazzi shine shining laser lasers stage'),
  S(4, 'Ocean waves', '04', 'low', '002', 'ocean sea seas wave waves tide tides beach shore surf coast water salt'),
  S(5, 'Fire', '09', 'centre', '004', 'fire fires burn burning burned flame flames smoke ash ashes inferno blaze hell torch ignite bonfire'),
  S(6, 'City skyline', '05', 'centre', '005', 'city cities skyline building buildings tower towers downtown skyscraper skyscrapers rooftop concrete manhattan'),
  S(7, 'Ringed planet', '01', 'centre', '009', 'space planet planets galaxy universe orbit cosmic saturn mars astronaut', true),
  S(8, 'Rain', '03', 'centre', '001', 'rain raining rainy drizzle wet umbrella puddle'),
  S(9, 'Tunnel', '02', 'centre', '003', 'tunnel underground subway deeper inside escape', true),
  S(10, 'Heart', '07', 'centre', '010', 'heart hearts heartbeat love lover loving beating', true),
  S(11, 'Flower', '06', 'centre', '002', 'flower flowers bloom blooming petal petals garden daisy lily'),
  S(12, 'Mountains', '06', 'centre', '008', 'mountain mountains peak climb climbing summit hills valley'),
  S(13, 'Globe', '01', 'centre', '009', 'world globe earth everywhere countries around', true),
  S(14, 'Helix', '13', 'centre', '009', 'dna blood veins genes born nature science'),
  S(15, 'Butterfly', '10', 'centre', '007', 'butterfly butterflies wings fly flutter'),
  S(16, 'Crescent moon and clouds', '01', 'high', '008', 'moon moonlight midnight night nights tonight lunar', true),
  S(17, 'Comet over a field', '01', 'high', '005', 'comet shooting wish falling star meteor'),
  S(18, 'Constellation chart', '01', 'centre', '005', 'stars star constellation sky skies heaven heavens zodiac'),
  S(19, 'Solar eclipse', '01', 'centre', '005', 'eclipse shadow darkness dark sun corona', true),
  S(20, 'Lighthouse in fog', '04', 'centre', '011', 'lighthouse fog harbor harbour guide lost signal shore'),
  S(21, 'Sailing boat at dusk', '04', 'centre', '002', 'sail sailing ship boat boats sailor anchor drifting'),
  S(22, 'Rowing boat on a still lake', '04', 'centre', '002', 'lake still calm quiet row rowing river reflection'),
  S(23, 'Whale under the surface', '10', 'centre', '008', 'whale deep drown drowning underwater sink sinking dive'),
  S(24, 'Train on a viaduct', '02', 'centre', '003', 'train trains railway rail tracks station platform'),
  S(25, 'Station clock', '08', 'centre', '009', 'clock clocks time tick ticking minute minutes hour hours late waiting', true),
  S(26, 'Airplane window', '02', 'centre', '008', 'plane flight flights flying airport fly jet window takeoff'),
  S(27, 'Empty desert road', '02', 'low', '003', 'desert road roads miles horizon dust nowhere'),
  S(28, 'Streetlight in snow', '03', 'centre', '001', 'snow snowing winter cold freezing frozen streetlight lamp'),
  S(29, 'Lit window grid', '05', 'centre', '005', 'window windows apartment neighbors lights block'),
  S(30, 'Bridge over a river', '05', 'centre', '002', 'bridge bridges river cross crossing'),
  S(31, 'Thunderstorm over plains', '03', 'high', '004', 'storm storms thunder lightning thunderstorm'),
  S(32, 'Snowfall in a forest', '03', 'centre', '001', 'forest woods pine pines december'),
  S(33, 'Fog over a valley', '03', 'centre', '008', 'fog mist haze grey cloudy blur'),
  S(34, 'Single tree on a hill', '06', 'centre', '008', 'tree trees roots branches leaves alone hill'),
  S(35, 'Rose close-up', '06', 'centre', '002', 'rose roses thorn thorns red', true),
  S(36, 'Sunflower field', '06', 'low', '002', 'sunflower sunflowers field fields summer golden'),
  S(37, 'Cactus in the desert', '06', 'centre', '004', 'cactus west western sand sunset'),
  S(38, 'Waterfall', '06', 'centre', '001', 'waterfall falls falling stream cascade'),
  S(39, 'Candle in the dark', '09', 'centre', '004', 'candle candles candlelight wax pray prayer'),
  S(40, 'Struck match', '09', 'centre', '004', 'match matches spark sparks lighter strike'),
  S(41, 'Sunrise', '09', 'centre', '005', 'sunrise morning dawn sun sunshine rise rising daylight', true),
  S(42, 'Two hands almost touching', '07', 'centre', '008', 'hand hands touch touching hold holding reach reaching fingers'),
  S(43, 'Dancer mid-spin', '07', 'centre', '009', 'dance dancing dancer spin spinning twirl ballet'),
  S(44, 'Raised hands in a crowd', '07', 'low', '010', 'crowd hands up concert festival everybody together scream'),
  S(45, 'Cassette tape', '08', 'centre', '009', 'tape cassette mixtape rewind play playlist'),
  S(46, 'Vinyl record', '08', 'centre', '009', 'record records vinyl spin spinning song songs music dj', true),
  S(47, 'Telephone handset', '08', 'centre', '008', 'phone telephone call calling ring ringing hello voicemail'),
  S(48, 'Radio with a dial', '08', 'centre', '008', 'radio station frequency static airwaves'),
  S(49, 'Speaker cone', '08', 'centre', '010', 'bass speaker speakers loud volume boom beat beats', true),
  S(50, 'Hourglass', '13', 'centre', '001', 'hourglass sand forever running out lasting'),
  S(51, 'Key and lock', '13', 'centre', '009', 'key keys lock locked unlock door secret secrets'),
  S(52, 'Crown', '13', 'centre', '005', 'crown king queen kings queens throne royal royalty reign'),
  S(53, 'Diamond', '13', 'centre', '005', 'diamond diamonds ice gold jewel jewels rich money'),
  S(54, 'Swallow in flight', '10', 'centre', '007', 'bird birds fly flying free freedom wings swallow'),
  S(55, 'Birds on a wire', '10', 'centre', '005', 'wire wires waiting sitting line'),
  S(56, 'Cat on a windowsill', '10', 'centre', '007', 'cat cats kitty kitten purr'),
  S(57, 'Rocket launch', '01', 'centre', '001', 'rocket launch blast liftoff moonshot', false),
  S(58, 'Ferris wheel', '05', 'centre', '009', 'carnival fair wheel ride rides', true),
  S(59, 'Paper plane', '10', 'centre', '008', 'paper plane letter letters note glide'),
  S(60, 'Balloon floating away', '10', 'centre', '001', 'balloon balloons float floating away birthday'),
  S(61, 'Cracked mirror', '07', 'centre', '005', 'mirror mirrors broken break breaking crack cracked shatter reflection'),
  S(62, 'Steaming cup', '08', 'centre', '001', 'coffee tea cup morning kitchen warm'),
];

export const subjectIndex = (id: string) => SUBJECTS.findIndex((s) => s.id === id);

const LOOKUP = new Map<string, number>();
SUBJECTS.forEach((s, i) => {
  for (const w of s.words.split(' ')) if (!LOOKUP.has(w)) LOOKUP.set(w, i);
});

const wordsOf = (s: string) => s.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}'-]*/gu) ?? [];

/** subject hits in a text: subject index -> count */
export function subjectHits(text: string): Map<number, number> {
  const m = new Map<number, number>();
  for (const raw of wordsOf(text)) {
    const w = raw.replace(/'s$/, '');
    const i = LOOKUP.get(w) ?? LOOKUP.get(w.replace(/-/g, '')) ?? (w.endsWith('s') ? LOOKUP.get(w.slice(0, -1)) : undefined);
    if (i !== undefined) m.set(i, (m.get(i) ?? 0) + 1);
  }
  return m;
}

export const familySubjects = (family: string) => SUBJECTS.map((s, i) => ({ s, i })).filter((x) => x.s.family === family).map((x) => x.i);

/**
 * The subject for a section in scene family `family`: a title hit in that family wins, then the family's most frequent lyric
 * hit (the section's own lines count double), then a seeded pick; `avoid` keeps a song from repeating a subject in another
 * family's section.
 */
export function pickSubjectFor(family: string, title: Map<number, number>, lyrics: Map<number, number>, section: Map<number, number>, pick: number, avoid: Set<number>): number {
  const pool = familySubjects(family);
  if (!pool.length) return 0;
  const score = (i: number) => (title.get(i) ?? 0) * 100 + (section.get(i) ?? 0) * 2 + (lyrics.get(i) ?? 0);
  let best = -1;
  let bestScore = 0;
  for (const i of pool) {
    const s = score(i) - (avoid.has(i) ? 50 : 0);
    if (s > bestScore) {
      best = i;
      bestScore = s;
    }
  }
  if (best >= 0) return best;
  const fresh = pool.filter((i) => !avoid.has(i));
  const from = fresh.length ? fresh : pool;
  return from[Math.floor(pick * from.length) % from.length]!;
}

/** the scene family whose subjects the song's title or lyrics call most (null = none clearly) */
export function familyOfSong(title: Map<number, number>, lyrics: Map<number, number>): string | null {
  for (const [i] of [...title.entries()].sort((a, b) => b[1] - a[1])) return SUBJECTS[i]!.family;
  let best: string | null = null;
  let bestN = 2;
  const byFam = new Map<string, number>();
  for (const [i, n] of lyrics) byFam.set(SUBJECTS[i]!.family, (byFam.get(SUBJECTS[i]!.family) ?? 0) + n);
  for (const [f, n] of byFam)
    if (n > bestN) {
      best = f;
      bestN = n;
    }
  return best;
}
