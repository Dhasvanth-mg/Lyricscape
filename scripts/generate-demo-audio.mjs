// Generates ORIGINAL, copyright-cleared demo audio, timed lyrics and artwork.
// Everything here is synthesized from scratch by this script (CC0 / public domain).
//
//   node scripts/generate-demo-audio.mjs
//
// Output (public/demo):
//   <id>.wav        mono 16-bit PCM
//   <id>.lrc        enhanced LRC with word-level <mm:ss.xx> stamps
//   <id>.svg        original cover artwork
//   catalog.json    track metadata + beat grid (ground truth for tests)

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'demo');
mkdirSync(OUT, { recursive: true });

const SR = 44100;

// ---- deterministic PRNG ---------------------------------------------------
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const midiToHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

// ---- instruments ----------------------------------------------------------
function addKick(buf, start, vel = 1) {
  const len = Math.floor(0.32 * SR);
  let phase = 0;
  for (let i = 0; i < len && start + i < buf.length; i++) {
    const t = i / SR;
    const f = 42 + 120 * Math.exp(-t * 28);
    phase += (2 * Math.PI * f) / SR;
    const env = Math.exp(-t * 11) * (t < 0.002 ? t / 0.002 : 1);
    buf[start + i] += Math.sin(phase) * env * 0.95 * vel;
  }
}

function addSnare(buf, start, rnd, vel = 1) {
  const len = Math.floor(0.22 * SR);
  let lp = 0;
  for (let i = 0; i < len && start + i < buf.length; i++) {
    const t = i / SR;
    const n = rnd() * 2 - 1;
    lp += 0.55 * (n - lp);
    const noise = (n - lp) * Math.exp(-t * 20);
    const tone = Math.sin(2 * Math.PI * 190 * t) * Math.exp(-t * 28) * 0.5;
    buf[start + i] += (noise * 0.55 + tone) * vel;
  }
}

function addHat(buf, start, rnd, open = false, vel = 1) {
  const len = Math.floor((open ? 0.16 : 0.05) * SR);
  let lp = 0;
  for (let i = 0; i < len && start + i < buf.length; i++) {
    const t = i / SR;
    const n = rnd() * 2 - 1;
    lp += 0.82 * (n - lp);
    buf[start + i] += (n - lp) * Math.exp(-t * (open ? 22 : 75)) * 0.3 * vel;
  }
}

function addBass(buf, start, midi, durSamples, vel = 1) {
  const f = midiToHz(midi);
  let lp = 0;
  const cutoff = 0.09;
  for (let i = 0; i < durSamples && start + i < buf.length; i++) {
    const t = i / SR;
    const ph = (f * t) % 1;
    const saw = ph * 2 - 1;
    const sq = ph < 0.5 ? 1 : -1;
    const raw = saw * 0.6 + sq * 0.25 + Math.sin(2 * Math.PI * f * t) * 0.6;
    lp += cutoff * (raw - lp);
    const a = Math.min(1, t / 0.006);
    const r = Math.min(1, (durSamples - i) / (0.03 * SR));
    buf[start + i] += lp * a * r * 0.55 * vel;
  }
}

function addPad(buf, start, midis, durSamples, vel = 1) {
  const detunes = [-0.07, 0, 0.07];
  const lpState = new Array(midis.length * detunes.length).fill(0);
  for (let i = 0; i < durSamples && start + i < buf.length; i++) {
    const t = i / SR;
    let s = 0;
    let k = 0;
    for (const m of midis) {
      for (const d of detunes) {
        const f = midiToHz(m + d);
        const ph = (f * t) % 1;
        const raw = ph * 2 - 1;
        lpState[k] += 0.05 * (raw - lpState[k]);
        s += lpState[k];
        k++;
      }
    }
    const a = Math.min(1, t / 0.12);
    const r = Math.min(1, (durSamples - i) / (0.2 * SR));
    buf[start + i] += (s / (midis.length * 2.4)) * a * r * 0.4 * vel;
  }
}

function addPluck(buf, start, midi, vel = 1, decay = 9) {
  const f = midiToHz(midi);
  const len = Math.floor(0.45 * SR);
  for (let i = 0; i < len && start + i < buf.length; i++) {
    const t = i / SR;
    let s = 0;
    for (let h = 1; h <= 5; h++) s += Math.sin(2 * Math.PI * f * h * t) / (h * h * 0.8);
    buf[start + i] += s * Math.exp(-t * decay) * 0.24 * vel * Math.min(1, t / 0.002);
  }
}

// ---- track definitions ----------------------------------------------------
// Each lyric line sits on a bar; words are distributed across the bar's beats.
// Lyrics are original text written for this project.
const TRACKS = [
  {
    id: 'neon-static',
    title: 'Neon Static',
    artist: 'Lyricscape Demo Lab',
    album: 'Cleared Signals',
    bpm: 112,
    root: 57, // A3
    minor: true,
    progression: [0, 5, 3, 4], // i VI iv v  (scale degrees in semitone offsets below)
    bars: 24,
    seed: 11,
    palette: ['#ff2e63', '#ffd23f', '#08d9d6', '#1a1a2e'],
    style: 'drive',
    lyrics: [
      [2, 'City hums in electric blue'],
      [3, 'Every sign is calling you'],
      [4, 'Turn it up till the static sings'],
      [5, 'Light the night with everything'],
      [8, 'Neon static in my veins'],
      [9, 'Run the red light, shake the chains'],
      [10, 'Neon static'],
      [11, 'Neon static'],
      [14, 'Wires glow and we move as one'],
      [15, 'Chasing echoes of the sun'],
      [16, 'Neon static in my veins'],
      [17, 'Run the red light, shake the chains'],
      [18, 'Neon static'],
      [19, 'Neon static'],
      [21, 'Fade to white'],
    ],
  },
  {
    id: 'paper-planets',
    title: 'Paper Planets',
    artist: 'Lyricscape Demo Lab',
    album: 'Cleared Signals',
    bpm: 88,
    root: 60, // C4
    minor: false,
    progression: [0, 9, 5, 7], // I vi IV V
    bars: 18,
    seed: 23,
    palette: ['#f9a826', '#f6f1d1', '#e63946', '#1d3557'],
    style: 'chill',
    lyrics: [
      [2, 'Folded wings of paper skies'],
      [3, 'Planets drift where the daylight lies'],
      [4, 'Hold me slow in the afterglow'],
      [5, 'Soft orbits, nowhere to go'],
      [8, 'Paper planets, spinning round'],
      [9, 'Gravity is a gentle sound'],
      [10, 'Paper planets'],
      [11, 'Never fall down'],
      [14, 'Tape the stars back on the wall'],
      [15, 'We were never small at all'],
    ],
  },
  {
    id: 'glass-hours',
    title: 'Glass Hours',
    artist: 'Lyricscape Demo Lab',
    album: 'Cleared Signals',
    bpm: 128,
    root: 55, // G3
    minor: true,
    progression: [0, 3, 8, 7],
    bars: 28,
    seed: 37,
    palette: ['#7b2cbf', '#c77dff', '#e0aaff', '#10002b'],
    style: 'drive',
    lyrics: [
      [2, 'Count the hours made of glass'],
      [3, 'Watch them shatter as they pass'],
      [4, 'Every second is a spark'],
      [5, 'Dancing through the dark'],
      [8, 'Glass hours break'],
      [9, 'Glass hours break'],
      [10, 'Catch the pieces, make them ours'],
      [11, 'Glass hours'],
      [16, 'Count the hours made of glass'],
      [17, 'Watch them shatter as they pass'],
      [18, 'Glass hours break'],
      [19, 'Glass hours break'],
      [20, 'Catch the pieces, make them ours'],
      [21, 'Glass hours'],
      [24, 'Hold the light'],
    ],
  },
];

const MINOR = [0, 2, 3, 5, 7, 8, 10];
const MAJOR = [0, 2, 4, 5, 7, 9, 11];

function chordFor(track, degreeSemis) {
  const root = track.root + degreeSemis;
  // simple triad quality from scale membership
  const scale = track.minor ? MINOR : MAJOR;
  const rel = (degreeSemis % 12 + 12) % 12;
  const third = scale.includes((rel + 3) % 12) && !scale.includes((rel + 4) % 12) ? 3 : 4;
  return [root, root + third, root + 7];
}

function renderTrack(track) {
  const beat = 60 / track.bpm;
  const bar = beat * 4;
  const total = Math.ceil((track.bars * bar + 1.5) * SR);
  const mix = new Float32Array(total);
  const rnd = mulberry32(track.seed);
  const swing = track.style === 'chill' ? 0.04 : 0;
  const prog = track.progression;
  const drive = track.style === 'drive';

  for (let b = 0; b < track.bars; b++) {
    const barStart = b * bar;
    const degree = prog[b % prog.length];
    const chord = chordFor(track, degree);
    const section = b < 2 ? 'intro' : b >= track.bars - 2 ? 'outro' : 'main';
    const intensity = section === 'intro' ? 0.5 : section === 'outro' ? 0.6 : 1;

    // pad (every bar)
    addPad(mix, Math.floor(barStart * SR), chord.map((m) => m + 12), Math.floor(bar * SR * 1.02), 0.9 * intensity);

    for (let s = 0; s < 16; s++) {
      const t = barStart + s * (beat / 4) + (s % 2 === 1 ? swing * beat : 0);
      const at = Math.floor(t * SR);
      const step = s % 16;

      // drums
      if (section !== 'intro' || b === 1) {
        if (drive) {
          if (step % 4 === 0) addKick(mix, at, intensity);
          if (step === 4 || step === 12) addSnare(mix, at, rnd, 0.9 * intensity);
          if (step % 2 === 0) addHat(mix, at, rnd, step % 4 === 2, 0.8 * intensity);
          if (step % 4 === 3) addHat(mix, at, rnd, false, 0.4 * intensity);
        } else {
          if (step === 0 || step === 10) addKick(mix, at, 0.9 * intensity);
          if (step === 8) addSnare(mix, at, rnd, 0.7 * intensity);
          if (step % 2 === 0) addHat(mix, at, rnd, false, 0.55 * intensity);
        }
      }

      // bass
      if (section !== 'intro') {
        if (drive && step % 2 === 0 && step !== 6 && step !== 14) {
          addBass(mix, at, chord[0] - 24, Math.floor(beat * 0.45 * SR), intensity);
        } else if (!drive && (step === 0 || step === 6 || step === 10)) {
          addBass(mix, at, chord[0] - 24, Math.floor(beat * 0.9 * SR), intensity);
        }
      }

      // arp / pluck melody
      const arpPattern = drive ? [0, 1, 2, 1, 0, 2, 1, 2] : [0, 2, 1, 2];
      if (drive ? step % 2 === 0 : step % 4 === 0) {
        const idx = arpPattern[(step / (drive ? 2 : 4)) % arpPattern.length];
        const octave = (drive ? 12 : 12) + (step >= 8 && drive ? 12 : 0);
        if (section !== 'intro' || b === 1) {
          addPluck(mix, at, chord[idx] + octave, 0.8 * intensity, drive ? 11 : 6);
        }
      }
    }
  }

  // gentle soft clip + fade
  let peak = 0;
  for (let i = 0; i < mix.length; i++) {
    const x = Math.tanh(mix[i] * 1.1);
    mix[i] = x;
    peak = Math.max(peak, Math.abs(x));
  }
  const gain = 0.89 / (peak || 1);
  const fadeIn = Math.floor(0.05 * SR);
  const fadeOut = Math.floor(1.2 * SR);
  for (let i = 0; i < mix.length; i++) {
    let g = gain;
    if (i < fadeIn) g *= i / fadeIn;
    if (i > mix.length - fadeOut) g *= (mix.length - i) / fadeOut;
    mix[i] *= g;
  }
  return mix;
}

function wavBuffer(samples) {
  const dataBytes = samples.length * 2;
  const buf = Buffer.alloc(44 + dataBytes);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataBytes, 40);
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  return buf;
}

// ---- lyrics (word-level timing aligned to the beat grid) -------------------
function fmt(ms) {
  const m = Math.floor(ms / 60000);
  const s = (ms % 60000) / 1000;
  return `${String(m).padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}`;
}

function buildLyrics(track) {
  const beatMs = 60000 / track.bpm;
  const barMs = beatMs * 4;
  const lines = [];
  for (const [barIndex, text] of track.lyrics) {
    const words = text.split(/\s+/);
    const lineStart = barIndex * barMs;
    // Use ~3.4 beats for the line; words share it proportionally to length.
    const span = barMs * 0.88;
    const weights = words.map((w) => 0.6 + w.replace(/[^\w]/g, '').length);
    const sum = weights.reduce((a, b) => a + b, 0);
    let cursor = lineStart;
    const timed = words.map((w, i) => {
      const dur = (weights[i] / sum) * span;
      const start = Math.round(cursor);
      cursor += dur;
      return { text: w, startMs: start, endMs: Math.round(cursor) };
    });
    lines.push({ startMs: Math.round(lineStart), endMs: Math.round(lineStart + span), words: timed });
  }
  return lines;
}

function toEnhancedLrc(track, lines) {
  const header = [
    `[ti:${track.title}]`,
    `[ar:${track.artist}]`,
    `[al:${track.album}]`,
    `[by:Lyricscape demo generator - original lyrics, CC0]`,
  ];
  const body = lines.map(
    (l) => `[${fmt(l.startMs)}] ` + l.words.map((w) => `<${fmt(w.startMs)}>${w.text}`).join(' ') + ` <${fmt(l.endMs)}>`,
  );
  return [...header, ...body].join('\n') + '\n';
}

// ---- artwork (original SVG; no raster, no AI) ------------------------------
function artwork(track) {
  const rnd = mulberry32(track.seed * 101);
  const [c1, c2, c3, bg] = track.palette;
  const W = 800;
  const parts = [];
  parts.push(`<rect width="${W}" height="${W}" fill="${bg}"/>`);
  // sun / planet
  const cx = 280 + rnd() * 240;
  const cy = 260 + rnd() * 160;
  const r = 170 + rnd() * 80;
  parts.push(`<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${r.toFixed(0)}" fill="${c1}"/>`);
  // stripes cutting the sun
  for (let i = 0; i < 7; i++) {
    const y = cy + 10 + i * 24 + rnd() * 8;
    parts.push(`<rect x="0" y="${y.toFixed(0)}" width="${W}" height="${(4 + i * 2.2).toFixed(1)}" fill="${bg}"/>`);
  }
  // halftone dots
  for (let gy = 0; gy < 14; gy++) {
    for (let gx = 0; gx < 14; gx++) {
      const x = 40 + gx * 52;
      const y = 40 + gy * 52;
      const d = Math.hypot(x - cx, y - cy);
      const rr = Math.max(0, 9 - (d / W) * 18 + rnd() * 1.5);
      if (rr > 1 && d > r + 20) parts.push(`<circle cx="${x}" cy="${y}" r="${rr.toFixed(1)}" fill="${c2}" opacity="0.55"/>`);
    }
  }
  // ground wedge
  parts.push(`<polygon points="0,${W} ${W},${W} ${W},${(W * 0.72).toFixed(0)} 0,${(W * 0.86).toFixed(0)}" fill="${c3}"/>`);
  // big title glyph
  parts.push(
    `<text x="48" y="${W - 52}" font-family="Impact, Anton, sans-serif" font-size="120" fill="${bg}" letter-spacing="2">${track.title.toUpperCase()}</text>`,
  );
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${W}" width="${W}" height="${W}">${parts.join('')}</svg>`;
}

// ---- main ------------------------------------------------------------------
const catalog = [];
for (const track of TRACKS) {
  const samples = renderTrack(track);
  const beatMs = 60000 / track.bpm;
  const durationMs = Math.round((samples.length / SR) * 1000);
  const beats = [];
  for (let t = 0; t < track.bars * 4 * beatMs; t += beatMs) beats.push(Math.round(t));
  const lines = buildLyrics(track);

  writeFileSync(join(OUT, `${track.id}.wav`), wavBuffer(samples));
  writeFileSync(join(OUT, `${track.id}.lrc`), toEnhancedLrc(track, lines));
  writeFileSync(join(OUT, `${track.id}.svg`), artwork(track));
  catalog.push({
    id: track.id,
    title: track.title,
    artists: [track.artist],
    album: track.album,
    durationMs,
    bpm: track.bpm,
    beatTimesMs: beats,
    palette: track.palette,
    audio: `/demo/${track.id}.wav`,
    artwork: `/demo/${track.id}.svg`,
    lyrics: `/demo/${track.id}.lrc`,
    license: 'CC0-1.0 (synthesized by scripts/generate-demo-audio.mjs)',
  });
  console.log(`generated ${track.id}: ${(durationMs / 1000).toFixed(1)}s @ ${track.bpm} BPM`);
}
writeFileSync(join(OUT, 'catalog.json'), JSON.stringify(catalog, null, 2));
console.log('wrote catalog.json');
