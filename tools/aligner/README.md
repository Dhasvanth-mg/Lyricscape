# Optional lyric aligner

Lines up a lyric text with audio **you hold on this machine** (an imported file or the bundled demo songs) and hands back
a draft with per-word times and confidences. It is optional: Lyricscape's normal sync (lyrics lookup + playback position)
needs none of it, and it can never touch Spotify audio (the app has none).

> **Read [docs/lyric-sync-report.md](../../docs/lyric-sync-report.md) before relying on it.** The measured results show
> what it can and cannot do. The short version: on separated vocals it is often within a couple of hundred milliseconds
> and often far off; on a full mix it fails. Every result is a draft to review, never silently saved as fact.

## What it is

- `aligner.py`: CTC forced alignment of the **known text** (torchaudio `WAV2VEC2_ASR_BASE_960H`, English). It does not
  transcribe, so it cannot reorder or drop lyrics. Optional Demucs (`htdemucs`) vocal separation first.
- `server.py`: small FastAPI service on `127.0.0.1:8765` (`pnpm aligner`). The app talks to it through
  `/api/lyrics/align`, which only ever calls a loopback address.
- `evaluate.py` + `line_level_baseline.ts`: the measurement harness (below).

## Setup (one time)

```bash
py -3.11 -m venv tools/aligner/.venv            # Python 3.10-3.12
tools/aligner/.venv/Scripts/python -m pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu
tools/aligner/.venv/Scripts/python -m pip install -r tools/aligner/requirements.txt
pnpm aligner                                     # leave running; the Lyrics panel then offers "Auto-align from audio"
```

CPU is enough (a few minutes per song with Demucs). Use a CUDA build of torch for speed. The first run downloads the
wav2vec2 model (~360 MB) and Demucs (~80 MB) into the usual torch/huggingface caches. Demucs needs an `ffmpeg` on `PATH`
for some inputs (the repo's `ffmpeg-static` binary works).

## Using it

Open a local or demo track, open the lyrics panel, **Auto-align from audio**. The result opens in the timing editor as an
**unsaved draft**: words with an amber ring are low confidence. Fix what is wrong, then Save. A saved aligner result stays
marked "auto-aligned" so it is never mistaken for a hand-timed or file-supplied timing.

## Measuring it yourself

```bash
python tools/aligner/evaluate.py fetch --songs 20      # JamendoLyrics English subset (CC audio + human word annotations), ~100 MB
python tools/aligner/evaluate.py run   --songs 20 --vocals
pnpm exec tsx tools/aligner/line_level_baseline.ts     # the app's own line-level heuristic on the same songs
python tools/aligner/evaluate.py report
```

Downloaded audio and raw outputs are git-ignored; `results/report.json` is the summary that went into the report.

## Limits (by design, stated up front)

- English only in this build; other languages are refused rather than aligned badly.
- Trained on read speech: singing, held notes, overlapping vocals, choirs and heavy production are out of distribution.
- No lyric sheet that disagrees with the recording (extra verses, a different edit) can be fixed by alignment.
- Never treat an unreviewed result as accurate.
