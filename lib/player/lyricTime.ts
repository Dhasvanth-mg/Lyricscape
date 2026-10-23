// The time at which lyrics are looked up, from the provider's playback position and three DIFFERENT corrections.
//
//   lyricTime = position - outputLatency + deviceAdvance + trackOffset        (positive advance = lyrics appear sooner)
//
//  outputLatency  what the audio stack reports (local playback: AudioContext base + output latency). Automatic.
//  deviceAdvance  how far this device/speaker/Bluetooth link is off, the SAME for every song. A property of the setup.
//  trackOffset    how far THIS lyric version is off against THIS recording. A property of the lyric version.
//
// None of them is ever written into stored lyric timestamps: changing a latency setting must never edit saved data.
// (The timing editor stamps with this same function, so what you stamp is what you then see.)

export type LyricCorrections = {
  outputLatencyMs: number;
  deviceAdvanceMs: number;
  trackOffsetMs: number;
};

export const NO_CORRECTIONS: LyricCorrections = { outputLatencyMs: 0, deviceAdvanceMs: 0, trackOffsetMs: 0 };

export function lyricTimeMs(positionMs: number, c: LyricCorrections = NO_CORRECTIONS): number {
  return positionMs - c.outputLatencyMs + c.deviceAdvanceMs + c.trackOffsetMs;
}
