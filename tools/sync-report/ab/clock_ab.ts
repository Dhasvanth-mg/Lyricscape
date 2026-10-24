// Controlled A/B of the Spotify position estimate on IDENTICAL telemetry, old vs rebuilt vs shipped fix.
//   pnpm exec tsx tools/sync-report/ab/clock_ab.ts
//
// Same scripted /me/player responses go into three implementations; the table shows each one's position MINUS the OLD
// one's (what real use was calibrated against). 0 = same as before the rebuild.
//   OLD           transcription of the pre-rebuild code (age = clamp(Date.now() - timestamp, 0, 2000); sync() snap 120 / slew 25%)
//   EXPERIMENTAL  the rebuild's skew-removing estimator (TelemetryAgeEstimator)
//   SHIPPED       what the app runs now: PlaybackClock + telemetryAgeMs (the old age formula)
// Two readings of Spotify's `timestamp` are tried, because a browser cannot tell which is true:
//   F  it is (about) when the response was produced; progress_ms was true then  (state is `staleMs` old at that moment)
//   L  it is when playback state last CHANGED (track start / pause / seek) and stays put between polls

import { PlaybackClock } from '../../../lib/player/clock';
import { TelemetryAgeEstimator, telemetryAgeMs } from '../../../lib/player/telemetry';

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

const T0 = 1_700_000_000_000;
const rows: { name: string; skew: number; semantic: 'F' | 'L'; staleMs: number }[] = [
  { name: 'THIS PC: clock +60.4 s, F (stale 1.0 s)', skew: 60_400, semantic: 'F', staleMs: 1000 },
  { name: 'THIS PC: clock +60.4 s, L (last-change time)', skew: 60_400, semantic: 'L', staleMs: 0 },
  { name: 'accurate clock, F (stale 1.0 s)', skew: 0, semantic: 'F', staleMs: 1000 },
  { name: 'accurate clock, F (stale 0.1 s)', skew: 0, semantic: 'F', staleMs: 100 },
  { name: 'accurate clock, L (last-change time)', skew: 0, semantic: 'L', staleMs: 0 },
  { name: 'clock -5 s, F (stale 1.0 s)', skew: -5000, semantic: 'F', staleMs: 1000 },
];
const q = (a: number[], p: number) => [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(p * a.length))]!;

console.log('position vs the pre-rebuild code (ms), polls every 3.5 s for 4 minutes (first 20 s ignored)\n');
console.log('scenario'.padEnd(46), 'EXPERIMENTAL (rebuild)  median [p5, p95]', '   ', 'SHIPPED (now)  median [p5, p95]');
for (const r of rows) {
  let wall = T0;
  let perf = 0;
  const trackStartWall = T0;
  const progressTrue = (w: number) => 30_000 + (w - T0); // the real playhead
  const oldC = new OldClock(() => perf);
  const expC = new PlaybackClock(() => perf);
  const newC = new PlaybackClock(() => perf);
  const est = new TelemetryAgeEstimator();
  oldC.reset(30_000, true);
  expC.reset(30_000, true);
  newC.reset(30_000, true);
  const dExp: number[] = [];
  const dNew: number[] = [];
  let nextPoll = 0;
  for (let t = 0; t < 240_000; t += 50) {
    wall += 50;
    perf += 50;
    if (t >= nextPoll) {
      nextPoll += 3500;
      const rtt = 80;
      const arrivalWall = wall + rtt;
      // progress_ms: where the song was when it was valid
      const validWall = r.semantic === 'F' ? arrivalWall - rtt / 2 - r.staleMs : arrivalWall - rtt / 2;
      const progress = Math.round(progressTrue(validWall));
      // timestamp on SPOTIFY's clock (= true wall - skew): F -> when produced; L -> when state last changed
      const timestamp = (r.semantic === 'F' ? validWall : trackStartWall) - r.skew;
      wall = arrivalWall;
      perf += rtt;
      t += rtt - (rtt % 50);
      // the PC's Date.now() reads the true time plus its error; `timestamp` is on Spotify's (correct) clock
      const dateNow = wall + r.skew;
      const tsOnLocal = timestamp;
      oldC.sync(progress + Math.min(2000, Math.max(0, dateNow - tsOnLocal)), true);
      expC.observe({ positionMs: progress, playing: true, validAt: perf - est.ageAtReceipt(tsOnLocal, dateNow, rtt) });
      newC.observe({ positionMs: progress, playing: true, validAt: perf - telemetryAgeMs(tsOnLocal, dateNow) });
    }
    if (t > 20_000) {
      dExp.push(expC.position() - oldC.position());
      dNew.push(newC.position() - oldC.position());
    }
  }
  const f = (a: number[]) => `${String(Math.round(q(a, 0.5))).padStart(6)} [${Math.round(q(a, 0.05))}, ${Math.round(q(a, 0.95))}]`;
  console.log(r.name.padEnd(46), f(dExp).padEnd(40), f(dNew));
}
