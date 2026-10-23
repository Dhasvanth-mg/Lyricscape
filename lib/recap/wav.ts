// Minimal WAV reader (PCM 8/16/24/32-bit and float32) -> mono Float32. Lets analysis run without FFmpeg
// for WAV inputs (demo songs, tests). Other formats are decoded by FFmpeg in the worker.

export type DecodedAudio = { samples: Float32Array; sampleRate: number; durationMs: number };

export function decodeWav(buf: Uint8Array): DecodedAudio {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const tag = (o: number) => String.fromCharCode(buf[o]!, buf[o + 1]!, buf[o + 2]!, buf[o + 3]!);
  if (buf.length < 44 || tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw new Error('Not a WAV file');
  let off = 12;
  let fmt: { format: number; channels: number; rate: number; bits: number } | null = null;
  let dataStart = -1;
  let dataLen = 0;
  while (off + 8 <= buf.length) {
    const id = tag(off);
    const size = dv.getUint32(off + 4, true);
    if (id === 'fmt ') {
      fmt = { format: dv.getUint16(off + 8, true), channels: dv.getUint16(off + 10, true), rate: dv.getUint32(off + 12, true), bits: dv.getUint16(off + 22, true) };
    } else if (id === 'data') {
      dataStart = off + 8;
      dataLen = Math.min(size, buf.length - dataStart);
      break;
    }
    off += 8 + size + (size % 2);
  }
  if (!fmt || dataStart < 0) throw new Error('Malformed WAV (missing fmt/data)');
  const bytes = fmt.bits / 8;
  const frames = Math.floor(dataLen / (bytes * fmt.channels));
  const out = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let acc = 0;
    for (let c = 0; c < fmt.channels; c++) {
      const p = dataStart + (i * fmt.channels + c) * bytes;
      let v: number;
      if (fmt.format === 3 && fmt.bits === 32) v = dv.getFloat32(p, true);
      else if (fmt.bits === 16) v = dv.getInt16(p, true) / 32768;
      else if (fmt.bits === 8) v = (dv.getUint8(p) - 128) / 128;
      else if (fmt.bits === 24) v = ((dv.getUint8(p) | (dv.getUint8(p + 1) << 8) | (dv.getInt8(p + 2) << 16)) as number) / 8388608;
      else if (fmt.bits === 32) v = dv.getInt32(p, true) / 2147483648;
      else throw new Error(`Unsupported WAV bit depth ${fmt.bits}`);
      acc += v;
    }
    out[i] = acc / fmt.channels;
  }
  return { samples: out, sampleRate: fmt.rate, durationMs: Math.round((frames / fmt.rate) * 1000) };
}
