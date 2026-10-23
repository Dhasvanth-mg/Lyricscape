"""Forced alignment of KNOWN lyric text against audio you are allowed to process.

Optional, independent of the web app: the app never needs it. It reads a local audio file plus the lyrics you already
have, and returns per-word start/end times with a confidence for each word.

How it works
  - wav2vec2 (CTC, torchaudio WAV2VEC2_ASR_BASE_960H, English) produces per-frame character posteriors (20 ms frames).
  - torchaudio.functional.forced_align finds the most likely path through those posteriors that spells exactly the
    given text. Nothing is transcribed, so wrong "hearing" cannot reorder or drop lyrics; instrumental stretches are
    absorbed by the CTC blank.
  - optional: Demucs separates the vocals first, which matters a lot for sung music (see docs/lyric-sync-report.md).

What it cannot do (and says so)
  - It was trained on read speech. Singing, held notes, overlapping vocals, backing choirs and heavy production are
    out of distribution: onsets are only as good as the posteriors, so every word carries a confidence and the result
    is meant to be REVIEWED, never silently trusted.
  - English only in this build (the character set of the model). Other languages return an error rather than garbage.
  - Spotify audio is never an input; this only reads files you give it.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field

import numpy as np
import soundfile as sf
import torch
import torchaudio
import torchaudio.functional as AF

SR = 16000
FRAME_SAMPLES = 320  # wav2vec2 stride: 20 ms at 16 kHz
CHUNK_S = 30.0
OVERLAP_S = 2.0


@dataclass
class WordResult:
    text: str
    start_ms: int | None
    end_ms: int | None
    confidence: float  # 0..1, mean posterior of the word's characters on the aligned path; 0 when not aligned
    aligned: bool = True
    flags: list[str] = field(default_factory=list)


def load_audio(path: str, sr: int = SR) -> np.ndarray:
    """Any file libsndfile can read (wav, flac, ogg, mp3) -> mono float32 at `sr`."""
    data, rate = sf.read(path, dtype="float32", always_2d=True)
    mono = data.mean(axis=1)
    if rate != sr:
        mono = AF.resample(torch.from_numpy(mono), rate, sr).numpy()
    return mono.astype(np.float32)


def _clean(word: str, vocab: dict[str, int]) -> str:
    w = unicodedata.normalize("NFKD", word).encode("ascii", "ignore").decode().upper()
    w = w.replace("’", "'")
    return "".join(c for c in w if c in vocab and c not in ("-", "|"))


class Aligner:
    def __init__(self, device: str | None = None):
        self.device = torch.device(device or ("cuda" if torch.cuda.is_available() else "cpu"))
        bundle = torchaudio.pipelines.WAV2VEC2_ASR_BASE_960H
        self.model = bundle.get_model().to(self.device).eval()
        self.labels = bundle.get_labels()
        self.vocab = {c: i for i, c in enumerate(self.labels)}
        self.model_name = "torchaudio WAV2VEC2_ASR_BASE_960H"

    @torch.inference_mode()
    def emissions(self, audio: np.ndarray) -> torch.Tensor:
        """Log-posteriors (frames x labels), computed in overlapping chunks so memory stays bounded."""
        chunk = int(CHUNK_S * SR)
        hop = chunk - int(OVERLAP_S * SR)
        pieces: list[torch.Tensor] = []
        total = len(audio)
        pos = 0
        first = True
        while pos < total:
            seg = audio[pos : pos + chunk]
            x = torch.from_numpy(seg).to(self.device)[None]
            x = (x - x.mean()) / (x.std() + 1e-7)
            logits, _ = self.model(x)
            lp = torch.log_softmax(logits[0], dim=-1).cpu()
            last = pos + chunk >= total
            cut_l = 0 if first else int(OVERLAP_S * SR / FRAME_SAMPLES / 2)
            cut_r = 0 if last else int(OVERLAP_S * SR / FRAME_SAMPLES / 2)
            pieces.append(lp[cut_l : lp.shape[0] - cut_r if cut_r else lp.shape[0]])
            first = False
            if last:
                break
            pos += hop
        return torch.cat(pieces, dim=0)

    def align(self, audio: np.ndarray, words: list[str], emission: torch.Tensor | None = None) -> list[WordResult]:
        em = emission if emission is not None else self.emissions(audio)
        cleaned = [_clean(w, self.vocab) for w in words]
        order = [i for i, c in enumerate(cleaned) if c]
        results = [WordResult(text=w, start_ms=None, end_ms=None, confidence=0.0, aligned=False, flags=["not_alignable"]) for w in words]
        if not order:
            return results
        targets = [self.vocab[ch] for i in order for ch in cleaned[i]]
        if len(targets) >= em.shape[0]:
            raise ValueError("The lyrics have more characters than the audio has frames; wrong text or a truncated file?")
        ali, scores = AF.forced_align(em[None], torch.tensor([targets], dtype=torch.int32), blank=0)
        ali, scores = ali[0], scores[0].exp()
        spans = AF.merge_tokens(ali, scores)
        if len(spans) != len(targets):
            raise RuntimeError("Alignment produced an unexpected number of token spans")
        sec_per_frame = FRAME_SAMPLES / SR
        k = 0
        for i in order:
            n = len(cleaned[i])
            sp = spans[k : k + n]
            k += n
            conf = float(sum(s.score * (s.end - s.start) for s in sp) / max(1, sum(s.end - s.start for s in sp)))
            r = results[i]
            r.start_ms = int(round(sp[0].start * sec_per_frame * 1000))
            r.end_ms = int(round(sp[-1].end * sec_per_frame * 1000))
            r.confidence = round(conf, 3)
            r.aligned = True
            r.flags = []
        _interpolate_unaligned(results)
        _flag(results)
        return results


def _interpolate_unaligned(res: list[WordResult]) -> None:
    """Words with no characters the model knows (numbers, symbols) sit between their neighbours, flagged."""
    for i, r in enumerate(res):
        if r.aligned:
            continue
        prev = next((res[j] for j in range(i - 1, -1, -1) if res[j].aligned), None)
        nxt = next((res[j] for j in range(i + 1, len(res)) if res[j].aligned), None)
        if prev and nxt:
            r.start_ms = prev.end_ms
            r.end_ms = nxt.start_ms
        elif nxt:
            r.start_ms = r.end_ms = nxt.start_ms
        elif prev:
            r.start_ms = r.end_ms = prev.end_ms


def _flag(res: list[WordResult]) -> None:
    for r in res:
        if not r.aligned or r.start_ms is None or r.end_ms is None:
            continue
        d = r.end_ms - r.start_ms
        if r.confidence < LOW_CONFIDENCE:
            r.flags.append("low_confidence")
        if d < 40:
            r.flags.append("very_short")
        if d > 3000:
            r.flags.append("very_long")


# Words below this posterior are listed for review. The value comes from tools/aligner/evaluate.py on the annotated
# set (see docs/lyric-sync-report.md); it is a screening threshold, not a guarantee.
LOW_CONFIDENCE = 0.35


def split_words(text: str) -> list[str]:
    """Lyric sheet -> words, dropping [Chorus] style headers and (x2) markers."""
    out: list[str] = []
    for row in text.replace("\r", "").split("\n"):
        t = row.strip()
        if not t or re.fullmatch(r"[\[(]\s*(intro|verse|chorus|pre-?chorus|hook|bridge|outro|refrain|interlude|instrumental|solo|break|drop)\b[^\])]*[\])]\s*:?", t, flags=re.I):
            continue
        t = re.sub(r"\s*[\[(]\s*x\s*\d+\s*[\])]\s*$", "", t, flags=re.I)
        out.extend(w for w in t.split() if w)
    return out


def separate_vocals(path: str, device: str | None = None) -> np.ndarray:
    """Demucs (htdemucs) vocals stem as mono 16 kHz. Optional dependency: `pip install demucs`."""
    from demucs.apply import apply_model  # type: ignore
    from demucs.pretrained import get_model  # type: ignore

    dev = torch.device(device or ("cuda" if torch.cuda.is_available() else "cpu"))
    model = get_model("htdemucs").to(dev).eval()
    data, rate = sf.read(path, dtype="float32", always_2d=True)
    wav = torch.from_numpy(data.T)
    if wav.shape[0] == 1:
        wav = wav.repeat(2, 1)
    if rate != model.samplerate:
        wav = AF.resample(wav, rate, model.samplerate)
    ref = wav.mean(0)
    wav = (wav - ref.mean()) / (ref.std() + 1e-8)
    with torch.inference_mode():
        out = apply_model(model, wav[None].to(dev), split=True, overlap=0.1, progress=False)[0]
    vocals = out[model.sources.index("vocals")].cpu()
    mono = vocals.mean(0, keepdim=True)
    mono = AF.resample(mono, model.samplerate, SR)[0]
    return mono.numpy().astype(np.float32)
