// Position-estimate error, OLD vs NEW, on identical scripted Spotify telemetry (virtual time, fully deterministic).
//
//   pnpm exec tsx tools/sync-report/clock_report.ts
//
// OLD is a transcription of the code this branch replaced (git: lib/player/clock.ts + SpotifyBackend.poll at the
// branch point): age = clamp(Date.now() - state.timestamp, 0, 2000) added to progress_ms, clock.sync() snapping beyond
// 120 ms and otherwise moving the anchor 25% of the way, no RTT, no epoch.
// NEW is the code in lib/player (PlaybackClock.observe + TelemetryAgeEstimator).

import { PlaybackClock } from '../../lib/player/clock';
import { TelemetryAgeEstimator } from '../../lib/player/telemetry';

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class OldClock {
  private anchorPos = 0;
  private anchorAt = 0;
  private playing = false;
  constructor(private now: () => number) {}
  position() {
    return this.playing ? this.anchorPos + (this.now() - this.anchorAt) : this.anchorPos;
  }
  sync(pos: number, playing: boolean) {
    const est = this.position();
    const t = this.now();
    if (!this.playing || !playing || Math.abs(est - pos) > 120) this.anchorPos = pos;
    else this.anchorPos = est + (pos - est) * 0.25;
    this.anchorAt = t;
    this.playing = playing;
  }
  reset(pos: number, playing: boolean) {
    this.anchorPos = pos;
    this.anchorAt = this.now();
    this.playing = playing;
  }
}

type Scenario = { name: string; skew: number; jitter: boolean; driftPpm: number };
const scenarios: Scenario[] = [
  { name: 'clock in sync, quiet network', skew: 0, jitter: false, driftPpm: 0 },
  { name: 'clock 3 s ahead', skew: 3000, jitter: true, driftPpm: 0 },
  { name: 'clock 5 s behind', skew: -5000, jitter: true, driftPpm: 0 },
  { name: 'clock 45 s ahead', skew: 45_000, jitter: true, driftPpm: 0 },
  { name: 'jittery network + 0.2% drift', skew: 800, jitter: true, driftPpm: 2000 },
];

function pct(a: number[], p: number) {
  const s = [...a].sort((x, y) => x - y);
  return Math.round(s[Math.min(s.length - 1, Math.floor(p * s.length))]!);
}

function runScenario(sc: Scenario) {
  const rnd = rng(1234 + sc.skew);
  let wall = 1_700_000_000_000; // ms, "true" wall time
  let perf = 0;
  const startPos = 30_000;
  const truth = () => startPos + (wall - 1_700_000_000_000) * (1 + sc.driftPpm / 1e6);
  const oldC = new OldClock(() => perf);
  const newC = new PlaybackClock(() => perf);
  const est = new TelemetryAgeEstimator();
  oldC.reset(startPos, true);
  newC.reset(startPos, true);
  const eOld: number[] = [];
  const eNew: number[] = [];
  const STEP = 50;
  let nextPoll = 0;
  for (let t = 0; t < 10 * 60_000; t += STEP) {
    wall += STEP;
    perf += STEP;
    if (t >= nextPoll) {
      nextPoll += 3500;
      const rtt = sc.jitter ? 40 + rnd() * 160 : 30;
      const stale = sc.jitter ? (rnd() < 0.75 ? rnd() * 60 : 300 + rnd() * 600) : 20;
      // the answer is produced `stale` ms ago on the server, travels rtt/2 back; we read it at arrival
      const arrivalWall = wall + rtt;
      const arrivalPerf = perf + rtt;
      const serverWallTrue = arrivalWall - rtt / 2 - stale;
      const progress = startPos + (serverWallTrue - 1_700_000_000_000) * (1 + sc.driftPpm / 1e6);
      const timestamp = serverWallTrue - sc.skew; // server clock = true wall - skew
      // advance both clocks to the arrival instant, then feed them
      wall = arrivalWall;
      perf = arrivalPerf;
      t += rtt - (rtt % STEP);
      // OLD: age against the local wall clock, clamped
      const age = Math.min(2000, Math.max(0, wall - timestamp));
      oldC.sync(Math.round(progress) + age, true);
      // NEW: skew-free age + round-trip
      const a = est.ageAtReceipt(timestamp, wall, rtt);
      newC.observe({ positionMs: Math.round(progress), playing: true, validAt: perf - a });
    }
    if (t > 60_000) {
      eOld.push(Math.abs(oldC.position() - truth()));
      eNew.push(Math.abs(newC.position() - truth()));
    }
  }
  const row = (e: number[]) => ({ p50: pct(e, 0.5), p95: pct(e, 0.95), max: Math.round(Math.max(...e)) });
  return { old: row(eOld), new: row(eNew) };
}

console.log('position error vs the true song position (ms), 9 minutes after a 1-minute warm-up\n');
const out: Record<string, unknown> = {};
for (const sc of scenarios) {
  const r = runScenario(sc);
  out[sc.name] = r;
  console.log(sc.name.padEnd(34), 'OLD p50/p95/max', `${r.old.p50}/${r.old.p95}/${r.old.max}`.padEnd(16), 'NEW p50/p95/max', `${r.new.p50}/${r.new.p95}/${r.new.max}`);
}

// seek while a poll is in flight: error 3 s after the seek
{
  let perf = 0;
  const o = new OldClock(() => perf);
  const n = new PlaybackClock(() => perf);
  o.reset(60_000, true);
  n.reset(60_000, true);
  const epoch = n.epoch;
  perf += 300; // a poll is requested at epoch `epoch`, user seeks while it travels
  o.reset(200_000, true);
  n.reset(200_000, true);
  perf += 400; // the stale answer arrives: it describes the PRE-seek moment (60 s)
  o.sync(60_700, true);
  n.observe({ positionMs: 60_700, playing: true, epoch });
  perf += 3000;
  const truthPos = 200_000 + 3400;
  console.log('\nseek during an in-flight poll, error 3 s later:  OLD', Math.round(Math.abs(o.position() - truthPos)), 'ms   NEW', Math.round(Math.abs(n.position() - truthPos)), 'ms');
  out['seek during in-flight poll'] = { old: Math.round(Math.abs(o.position() - truthPos)), new: Math.round(Math.abs(n.position() - truthPos)) };
}
import('node:fs').then((fs) => fs.writeFileSync(new URL('./clock_report.json', import.meta.url), JSON.stringify(out, null, 2)));
