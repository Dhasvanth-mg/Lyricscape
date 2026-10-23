"""Local HTTP service around aligner.py. Optional: Lyricscape works without it.

    python -m uvicorn server:app --host 127.0.0.1 --port 8765        (from tools/aligner, inside its .venv)
    or:  pnpm aligner

POST /align   multipart: audio (file), lyrics (text), separate (true/false, default true), language (default "en")
GET  /health

It listens on loopback only and processes only the file you send it. The response always carries per-word
confidence, a list of words to review, and plain-language warnings when the result should not be trusted.
"""

from __future__ import annotations

import os
import statistics
import tempfile
import threading
import time

from fastapi import FastAPI, File, Form, HTTPException, UploadFile

import aligner as A

app = FastAPI(title="Lyricscape aligner", docs_url=None, redoc_url=None)
_lock = threading.Lock()  # one alignment at a time: the models are big
_al: A.Aligner | None = None


def get_aligner() -> A.Aligner:
    global _al
    if _al is None:
        _al = A.Aligner()
    return _al


def _has_demucs() -> bool:
    try:
        import demucs  # noqa: F401

        return True
    except Exception:
        return False


@app.get("/health")
def health() -> dict:
    import torch

    return {
        "ok": True,
        "model": "torchaudio WAV2VEC2_ASR_BASE_960H (CTC forced alignment of known text)",
        "languages": ["en"],
        "device": "cuda" if torch.cuda.is_available() else "cpu",
        "separation": _has_demucs(),
    }


def _rows(text: str) -> list[list[str]]:
    """Lyric sheet -> rows of words (same cleaning as the app's cleanLyricRows)."""
    rows: list[list[str]] = []
    for row in text.replace("\r", "").split("\n"):
        w = A.split_words(row)
        if w:
            rows.append(w)
    return rows


@app.post("/align")
async def align(
    audio: UploadFile = File(...),
    lyrics: str = Form(...),
    separate: bool = Form(True),
    language: str = Form("en"),
) -> dict:
    if language.lower() not in ("en", "eng", "english"):
        raise HTTPException(400, "This build aligns English lyrics only (the model's character set). Other languages are not supported yet.")
    rows = _rows(lyrics)
    words = [w for r in rows for w in r]
    if len(words) < 3:
        raise HTTPException(400, "Need the lyric text to align (at least a few words).")
    suffix = os.path.splitext(audio.filename or "")[1] or ".audio"
    with tempfile.TemporaryDirectory() as tmp:
        path = os.path.join(tmp, "in" + suffix)
        with open(path, "wb") as fh:
            while chunk := await audio.read(1 << 20):
                fh.write(chunk)
        t0 = time.time()
        warnings: list[str] = []
        try:
            with _lock:
                al = get_aligner()
                if separate and _has_demucs():
                    sig = A.separate_vocals(path)
                else:
                    sig = A.load_audio(path)
                    warnings.append(
                        "Aligned on the full mix (vocal separation not used). Speech models mostly cannot hear singing inside a mix: expect poor results."
                        if not separate
                        else "Vocal separation (Demucs) is not installed, so this was aligned on the full mix. Expect poor results: pip install demucs."
                    )
                res = al.align(sig, words)
        except ValueError as e:
            raise HTTPException(422, str(e))
        except Exception as e:  # unreadable audio, out of memory, ...
            raise HTTPException(500, f"Alignment failed: {e}")

    out_lines = []
    k = 0
    for r in rows:
        ws = res[k : k + len(r)]
        k += len(r)
        timed = [w for w in ws if w.start_ms is not None]
        out_lines.append(
            {
                "text": " ".join(r),
                "start_ms": timed[0].start_ms if timed else None,
                "end_ms": timed[-1].end_ms if timed else None,
                "confidence": round(statistics.fmean(w.confidence for w in ws), 3),
                "words": [{"text": w.text, "start_ms": w.start_ms, "end_ms": w.end_ms, "confidence": w.confidence, "flags": w.flags} for w in ws],
            }
        )
    conf = [w.confidence for w in res if w.aligned]
    med = statistics.median(conf) if conf else 0.0
    low = sum(1 for w in res if "low_confidence" in w.flags)
    if med < 0.2:
        warnings.append("The aligner could barely hear the lyrics in this audio (median confidence {:.0%}). Do not trust these times.".format(med))
    elif low / max(1, len(res)) > 0.4:
        warnings.append(f"{low} of {len(res)} words are low confidence. Review the highlighted words before saving.")
    return {
        "model": {"name": get_aligner().model_name, "separated": bool(separate and _has_demucs())},
        "seconds": round(time.time() - t0, 1),
        "lines": out_lines,
        "summary": {"words": len(res), "median_confidence": round(med, 3), "low_confidence_words": low, "warnings": warnings},
    }
