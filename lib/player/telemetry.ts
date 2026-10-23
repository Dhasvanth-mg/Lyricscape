// How old is a Spotify playback report by the time we read it?
//
// `GET /me/player` returns `progress_ms` plus `timestamp`, the server's Unix time when that progress was true.
// Comparing it with the local `Date.now()` mixes two things: how long ago the data was true (what we want) and how far
// the local clock is from Spotify's (which we don't care about, and is often seconds). They cannot be told apart from
// one sample, but they can from many: for each response
//
//     s = (localWallAtReceipt - serverTimestamp) - rtt/2  =  clockSkew + staleness      (staleness >= 0)
//
// so the smallest `s` seen recently is the skew (plus the freshest staleness ever seen), and each report's staleness is
// `s - min(s)`. Total age at receipt = staleness + rtt/2 (the response spent about half the round trip travelling).
// This is the min-filter used by NTP-style estimators. It is an estimate. Two limits are built in:
//  - A cache that is ALWAYS stale by the same amount looks exactly like clock skew. So an apparent skew within
//    +-SKEW_TRUST_MS is taken to be real staleness, not skew (a PC with a synced clock then gets the exact answer);
//    only a larger one is removed. The worst case is therefore bounded by SKEW_TRUST_MS.
//  - The result is capped.

const WINDOW = 24;
/** An apparent clock offset smaller than this is treated as data staleness, larger as a wrong local clock. */
export const SKEW_TRUST_MS = 250;
/** Never trust more than this much correction: beyond it the sample is unusable, not just old. */
export const MAX_TELEMETRY_AGE_MS = 3000;

export class TelemetryAgeEstimator {
  private samples: number[] = [];

  /**
   * @param serverTimestampMs `timestamp` from the Spotify response (server clock)
   * @param receivedWallMs    `Date.now()` when the response arrived (local clock)
   * @param rttMs             request round trip, measured with a monotonic clock
   * @returns how long before receipt `progress_ms` was true, in ms
   */
  ageAtReceipt(serverTimestampMs: number, receivedWallMs: number, rttMs: number): number {
    const half = Math.max(0, rttMs) / 2;
    if (!Number.isFinite(serverTimestampMs) || !Number.isFinite(receivedWallMs)) return half;
    const s = receivedWallMs - serverTimestampMs - half;
    this.samples.push(s);
    if (this.samples.length > WINDOW) this.samples.shift();
    const apparent = Math.min(...this.samples);
    const skew = Math.abs(apparent) > SKEW_TRUST_MS ? apparent : 0;
    return Math.min(MAX_TELEMETRY_AGE_MS, Math.max(0, s - skew) + half);
  }

  reset() {
    this.samples = [];
  }
}
