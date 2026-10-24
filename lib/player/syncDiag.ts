// Opt-in sync diagnostics. OFF by default and invisible: there is no UI and nothing is recorded unless you turn it on.
//
//   localStorage.setItem('lyricscape.debug.sync', '1')   then reload      (or open the app with ?syncdebug=1)
//
// While Spotify plays, each playback poll and SDK event is kept in a small in-memory ring buffer. In the browser console:
//
//   lyricscapeSync.summary()          what the numbers say (is `timestamp` fresh or a last-change time? how big is the age?)
//   lyricscapeSync.probeClock()       measures this PC's clock against Spotify's own (via the app server: the browser cannot)
//   lyricscapeSync.dump()             every sample, to paste into a bug report
//   lyricscapeSync.clear()
//
// It exists to answer one question with real data: how old is Spotify's reported position when we read it, on THIS machine?

export type PollSample = {
  wall: number; // Date.now() when the response arrived
  perf: number; // performance.now() then
  rttMs: number;
  timestamp: number; // Spotify's `timestamp`
  progressMs: number;
  playing: boolean;
  trackId: string;
  /** the age actually added to progress_ms (the formula used for the position) */
  appliedAgeMs: number;
  /** what the experimental skew-removing estimator would have said (never used for the position) */
  shadowAgeMs: number;
  positionBeforeMs: number;
  positionAfterMs?: number;
  epoch: number;
  commandsInFlight: number;
};
/** One look at the whole chain, a couple of times a second: provider position -> corrections -> lyric clock -> lyric timeline. */
export type FrameSample = {
  wall: number;
  positionMs: number;
  lyricTimeMs: number;
  deviceAdvanceMs: number;
  trackOffsetMs: number;
  outputLatencyMs: number;
  lyricSource: string | null;
  lyricVersionId: number | null;
  timingSource: string | null;
  lineIndex: number;
  lineStartMs: number | null;
  lineEndMs: number | null;
  /** 'authored' | 'estimated' | 'none' for the line on screen */
  wordTiming: string | null;
  activeWordStartMs: number | null;
  /** lyricTime minus the start of the line on screen: how far into the line we are */
  intoLineMs: number | null;
};
export type SdkSample = { wall: number; positionMs: number; paused: boolean; sdkTimestamp?: number; clockPositionMs: number };

const KEY = 'lyricscape.debug.sync';
const MAX = 300;
let on: boolean | null = null;
const polls: PollSample[] = [];
const sdk: SdkSample[] = [];
const frames: FrameSample[] = [];
let corrections: (() => Record<string, number>) | null = null;

function enabled(): boolean {
  if (on !== null) return on;
  try {
    on = typeof window !== 'undefined' && (window.localStorage.getItem(KEY) === '1' || /[?&]syncdebug=1\b/.test(window.location.search));
  } catch {
    on = false;
  }
  if (on && typeof window !== 'undefined') {
    (window as unknown as { lyricscapeSync: unknown }).lyricscapeSync = api;
    console.info('[lyricscape sync] diagnostics ON: see lyricscapeSync.summary(), .probeClock(), .dump()');
  }
  return on;
}

const median = (a: number[]) => (a.length ? [...a].sort((x, y) => x - y)[a.length >> 1]! : NaN);
const round = (n: number) => (Number.isFinite(n) ? Math.round(n) : null);

/**
 * Read the samples. Pure so it can be tested: is Spotify's `timestamp` the time of the response (it advances by about
 * as much as the wall clock between polls), or the time of the last state change (it stays put)?
 */
export function summarizePolls(samples: PollSample[]) {
  const playing = samples.filter((s) => s.playing);
  const steps: { dWall: number; dTs: number }[] = [];
  for (let i = 1; i < playing.length; i++) {
    const a = playing[i - 1]!;
    const b = playing[i]!;
    if (a.trackId === b.trackId) steps.push({ dWall: b.wall - a.wall, dTs: b.timestamp - a.timestamp });
  }
  const advancing = steps.filter((s) => Math.abs(s.dTs - s.dWall) < 400).length;
  const constant = steps.filter((s) => Math.abs(s.dTs) < 50).length;
  const raw = playing.map((s) => s.wall - s.timestamp);
  return {
    polls: samples.length,
    playingPolls: playing.length,
    timestampBehaviour: !steps.length
      ? 'not enough polls yet'
      : advancing / steps.length > 0.7
        ? 'ADVANCES with every poll: it is (close to) the time of the response'
        : constant / steps.length > 0.7
          ? 'STAYS CONSTANT between polls: it is the time of the last state change, not of the response'
          : 'mixed',
    rawAgeMedianMs: round(median(raw)), // Date.now() - timestamp: includes any clock error
    rawAgeRangeMs: raw.length ? [round(Math.min(...raw)), round(Math.max(...raw))] : null,
    appliedAgeMedianMs: round(median(playing.map((s) => s.appliedAgeMs))),
    experimentalAgeMedianMs: round(median(playing.map((s) => s.shadowAgeMs))),
    rttMedianMs: round(median(samples.map((s) => s.rttMs))),
    positionStepMedianMs: round(median(samples.filter((s) => s.positionAfterMs !== undefined).map((s) => s.positionAfterMs! - s.positionBeforeMs))),
  };
}

type ClockProbe = { serverNowMs: number; rttMs: number; spotifyDate: string | null };
/** local clock minus Spotify's clock, as an interval: the Date header only has 1 s resolution, so probes are intersected. */
export function intersectClockProbes(probes: ClockProbe[]): { offsetMs: number; halfWidthMs: number; probes: number } | null {
  let lo = -Infinity;
  let hi = Infinity;
  let used = 0;
  for (const p of probes) {
    const d = p.spotifyDate ? Date.parse(p.spotifyDate) : NaN;
    if (!Number.isFinite(d)) continue;
    const at = p.serverNowMs - p.rttMs / 2; // local time when Spotify wrote the header (half the server<->Spotify round trip ago)
    lo = Math.max(lo, at - (d + 1000)); // header = floor(second): true time is in [d, d+1000)
    hi = Math.min(hi, at - d);
    used++;
  }
  if (!used || lo > hi) return used ? { offsetMs: Math.round((lo + hi) / 2), halfWidthMs: Math.round(Math.abs(lo - hi) / 2 + 500), probes: used } : null;
  return { offsetMs: Math.round((lo + hi) / 2), halfWidthMs: Math.round((hi - lo) / 2), probes: used };
}

async function probeClock(n = 10) {
  const probes: ClockProbe[] = [];
  for (let i = 0; i < n; i++) {
    const t0 = performance.now();
    const r = await fetch('/api/diag/clock', { cache: 'no-store' });
    const body = (await r.json()) as { spotifyDate: string | null; serverNowMs: number; upstreamRttMs: number };
    void t0;
    probes.push({ spotifyDate: body.spotifyDate, serverNowMs: body.serverNowMs, rttMs: body.upstreamRttMs });
    await new Promise((res) => setTimeout(res, 150 + Math.random() * 850)); // spread across the second boundary
  }
  const r = intersectClockProbes(probes);
  console.info(r ? `[lyricscape sync] this PC's clock is ${r.offsetMs > 0 ? 'AHEAD of' : 'BEHIND'} Spotify's by ${Math.abs(r.offsetMs)} ms (±${r.halfWidthMs}, ${r.probes} probes)` : '[lyricscape sync] probe failed');
  return r;
}

const api = {
  dump: () => ({ polls: [...polls], sdk: [...sdk], frames: [...frames], corrections: corrections?.() ?? null }),
  summary: () => ({ ...summarizePolls(polls), sdkEvents: sdk.length, lyricFrames: frames.length, latestFrame: frames[frames.length - 1] ?? null, corrections: corrections?.() ?? null }),
  clear: () => {
    polls.length = 0;
    sdk.length = 0;
    frames.length = 0;
  },
  probeClock,
};

export const syncDiag = {
  enabled,
  poll(s: PollSample) {
    polls.push(s);
    if (polls.length > MAX) polls.shift();
  },
  /** complete the latest poll sample once the clock has absorbed it */
  patchLast(positionAfterMs: number) {
    const last = polls[polls.length - 1];
    if (last) last.positionAfterMs = positionAfterMs;
  },
  sdk(s: SdkSample) {
    sdk.push(s);
    if (sdk.length > MAX) sdk.shift();
  },
  frame(s: FrameSample) {
    frames.push(s);
    if (frames.length > MAX * 2) frames.shift();
  },
  setCorrections(fn: (() => Record<string, number>) | null) {
    corrections = fn;
  },
  /** test hook */
  _reset() {
    on = null;
    polls.length = 0;
    sdk.length = 0;
    frames.length = 0;
  },
};
