// What the ASCII scene draws is chosen from the song: a word in its title decides; otherwise the lyrics' most frequent theme (three hits at least). "E85" or lyrics about
// cars give a highway with cars on it; flashing lights give flashing lights; the sea, fire, a city at night, space or rain have their
// own picture. Nothing matched: the eye (and, for a lively song, strobing lights; for a low, sad one, rain). Pure, so it is tested.

export const SUBJECTS = ['eye', 'highway', 'lights', 'ocean', 'fire', 'city', 'space', 'rain'] as const;
export type Subject = (typeof SUBJECTS)[number];
/** the index the shader uses */
export const subjectIndex = (s: Subject) => SUBJECTS.indexOf(s);

const WORDS: Record<Exclude<Subject, 'eye'>, string> = {
  highway: 'car cars drive driving drove driver highway road roads speed speeding race racing racer engine engines wheel wheels e85 e-85 ride riding rides ferrari lambo lamborghini porsche bmw benz mercedes tires tire rev revving mph gas fuel motorway autobahn truck trucks motorcycle cruise cruising pedal dashboard backseat gti coupe turbo drift drifting asphalt traffic lane',
  lights: 'flash flashing flashes flashed light lights strobe strobes neon glow glowing disco club spotlight spotlights siren sirens blink blinking flicker flickering lamp lamps camera cameras paparazzi sparkle sparkling shine shining bright laser lasers',
  ocean: 'ocean sea seas wave waves tide tides beach shore sail sailing ship boat water drown drowning swim island surf coast harbor marina',
  fire: 'fire fires burn burning burned flame flames smoke ash ashes inferno blaze hell torch ignite lit-up bonfire',
  city: 'city cities skyline building buildings tower towers downtown streets street skyscraper skyscrapers rooftop concrete apartment manhattan',
  space: 'space star stars moon planet planets galaxy universe rocket orbit cosmic saturn mars sun astronaut heaven comet',
  rain: 'rain raining rainy storm thunder lightning cloud clouds tears cry crying umbrella weather wet drizzle',
};

const LOOKUP = new Map<string, Exclude<Subject, 'eye'>>();
for (const [k, v] of Object.entries(WORDS) as [Exclude<Subject, 'eye'>, string][]) for (const w of v.split(' ')) if (!LOOKUP.has(w)) LOOKUP.set(w, k);

const words = (s: string) => s.toLowerCase().match(/[a-z0-9][a-z0-9'-]*/g) ?? [];

/**
 * @param title  the song title and artist (any hit here decides)
 * @param lyrics the whole lyric text
 * @param mood   from the song's own reading, if there is one
 */
export function pickSubject(title: string, lyrics: string, mood?: { arousal: number; valence: number }): Subject {
  const sub = (w: string) => LOOKUP.get(w.replace(/'s$/, '')) ?? LOOKUP.get(w.replace(/-/g, ''));
  // ties go to the more specific picture
  const order: Subject[] = ['highway', 'lights', 'rain', 'fire', 'ocean', 'space', 'city'];
  const top = (score: Map<Subject, number>, min: number): Subject | null => {
    let best: Subject | null = null;
    let bestScore = min - 1;
    for (const s of order) {
      const v = score.get(s) ?? 0;
      if (v > bestScore) {
        best = s;
        bestScore = v;
      }
    }
    return best;
  };
  const count = (text: string) => {
    const m = new Map<Subject, number>();
    for (const w of words(text)) {
      const s = sub(w);
      if (s) m.set(s, (m.get(s) ?? 0) + 1);
    }
    return m;
  };
  // the title decides: a song called "E85" is a highway whatever the verses say
  const fromTitle = top(count(title), 1);
  if (fromTitle) return fromTitle;
  const fromLyrics = top(count(lyrics), 3);
  if (fromLyrics) return fromLyrics;
  if (mood) {
    if (mood.arousal >= 0.78) return 'lights';
    if (mood.arousal <= 0.28 && mood.valence < -0.2) return 'rain';
  }
  return 'eye';
}
