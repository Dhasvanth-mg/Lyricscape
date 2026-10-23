"""Measure word-onset error against INDEPENDENT human annotations (JamendoLyrics, English subset).

JamendoLyrics: 20 English full songs from Jamendo (Creative Commons audio), with word-level start/end times annotated
by people (Durand et al., ICASSP 2023). Nothing here is synthetic and nothing was tuned on these songs except one
screening threshold (see --calibrate-note in the report); the 3-way split into line-level, estimated-word and
aligned-word sources is explained in docs/lyric-sync-report.md.

  python evaluate.py fetch  [--songs N]            download audio + annotations into ./data (git-ignored)
  python evaluate.py run    [--songs N] [--vocals]  run the aligner (on the mix, and on Demucs vocals with --vocals)
  python evaluate.py report                         print the error distributions (and write results/report.json)

Run `pnpm exec tsx tools/aligner/line_level_baseline.ts` (from the repo root) between `fetch` and `report` to add the
app's own line-level heuristic as a source.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import time
import urllib.parse
import urllib.request
from pathlib import Path

import numpy as np

HERE = Path(__file__).parent
DATA = HERE / "data"
RESULTS = HERE / "results"
BASE = "https://huggingface.co/datasets/jamendolyrics/jamendolyrics/resolve/main"


def fetch_file(rel: str, dest: Path) -> None:
    if dest.exists() and dest.stat().st_size > 0:
        return
    dest.parent.mkdir(parents=True, exist_ok=True)
    url = f"{BASE}/{urllib.parse.quote(rel)}"
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "lyricscape-eval"}), timeout=120) as r:
        dest.write_bytes(r.read())


def english_names() -> list[str]:
    meta = DATA / "en_metadata.jsonl"
    fetch_file("subsets/en/metadata.jsonl", meta)
    names = []
    for line in meta.read_text(encoding="utf-8").splitlines():
        if line.strip():
            names.append(Path(json.loads(line)["file_name"]).stem)
    return sorted(names)


def song_files(name: str) -> dict[str, Path]:
    return {
        "mp3": DATA / "mp3" / f"{name}.mp3",
        "words_txt": DATA / "words" / f"{name}.words.txt",
        "words_csv": DATA / "words" / f"{name}.csv",
        "lines_csv": DATA / "lines" / f"{name}.csv",
    }


def cmd_fetch(n: int) -> None:
    for name in english_names()[:n]:
        f = song_files(name)
        fetch_file(f"subsets/en/mp3/{name}.mp3", f["mp3"])
        fetch_file(f"lyrics/{name}.words.txt", f["words_txt"])
        fetch_file(f"annotations/words/{name}.csv", f["words_csv"])
        fetch_file(f"annotations/lines/{name}.csv", f["lines_csv"])
        print("fetched", name)


def load_gt(name: str) -> dict:
    f = song_files(name)
    words = [w for w in f["words_txt"].read_text(encoding="utf-8").splitlines() if w != ""]
    with f["words_csv"].open(encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))
    if len(rows) != len(words):
        raise ValueError(f"{name}: {len(rows)} annotated words vs {len(words)} lyric words")
    starts = [float(r["word_start"]) for r in rows]
    ends = [float(r["word_end"]) for r in rows]
    line_first: list[int] = []
    new_line = True
    for i, r in enumerate(rows):
        if new_line:
            line_first.append(i)
        new_line = r["line_end"] not in ("nan", "", None)
    return {"words": words, "starts": starts, "ends": ends, "line_first": line_first}


def cmd_run(n: int, vocals: bool) -> None:
    from aligner import Aligner, load_audio, separate_vocals

    RESULTS.mkdir(exist_ok=True)
    al = Aligner()
    for name in english_names()[:n]:
        gt = load_gt(name)
        out = RESULTS / f"aligned_{name}.json"
        res: dict = json.loads(out.read_text()) if out.exists() else {"name": name, "n_words": len(gt["words"])}
        audio = load_audio(str(song_files(name)["mp3"]))
        res["duration_s"] = round(len(audio) / 16000, 1)
        conds = {"mix": lambda: audio}
        if vocals:
            conds["vocals"] = lambda: separate_vocals(str(song_files(name)["mp3"]))
        for cond, get in conds.items():
            if cond in res:
                continue
            t0 = time.time()
            try:
                sig = get()
                words = al.align(sig, gt["words"])
                res[cond] = {
                    "onsets": [None if w.start_ms is None else w.start_ms / 1000 for w in words],
                    "confidence": [w.confidence for w in words],
                    "seconds": round(time.time() - t0, 1),
                }
                print(f"{name} [{cond}] done in {res[cond]['seconds']}s")
            except Exception as e:  # keep going: a failed song is reported, not hidden
                res[cond] = {"error": str(e)}
                print(f"{name} [{cond}] FAILED: {e}")
        out.write_text(json.dumps(res))


# ---------------------------------------------------------------------------------------------------------------
# report
# ---------------------------------------------------------------------------------------------------------------
def dist(errs_ms: np.ndarray) -> dict:
    a = np.abs(errs_ms)
    if a.size == 0:
        return {"n": 0}
    return {
        "n": int(a.size),
        "median_ms": round(float(np.median(a))),
        "mean_ms": round(float(a.mean())),
        "p75_ms": round(float(np.percentile(a, 75))),
        "p90_ms": round(float(np.percentile(a, 90))),
        "p95_ms": round(float(np.percentile(a, 95))),
        "within_100ms_pct": round(float((a <= 100).mean() * 100), 1),
        "within_200ms_pct": round(float((a <= 200).mean() * 100), 1),
        "within_500ms_pct": round(float((a <= 500).mean() * 100), 1),
        "signed_median_ms": round(float(np.median(errs_ms))),
    }


def spearman(x: np.ndarray, y: np.ndarray) -> float:
    if len(x) < 3:
        return float("nan")
    rx = np.argsort(np.argsort(x))
    ry = np.argsort(np.argsort(y))
    return float(np.corrcoef(rx, ry)[0, 1])


def cmd_report() -> None:
    sources: dict[str, dict[str, list]] = {}  # source -> {"word": [...errors ms], "line": [...], "conf": [...], "per_song": {...}}
    names = []
    for p in sorted(RESULTS.glob("aligned_*.json")):
        res = json.loads(p.read_text())
        name = res["name"]
        names.append(name)
        gt = load_gt(name)
        g = np.array(gt["starts"])
        for cond in ("mix", "vocals"):
            if cond not in res or "onsets" not in res[cond]:
                continue
            pred = np.array([np.nan if o is None else o for o in res[cond]["onsets"]])
            err = (pred - g) * 1000
            s = sources.setdefault(f"aligned ({cond})", {"word": [], "line": [], "conf": [], "per_song": {}})
            ok = ~np.isnan(err)
            s["word"].extend(err[ok].tolist())
            s["conf"].extend(np.array(res[cond]["confidence"])[ok].tolist())
            lf = gt["line_first"]
            s["line"].extend(err[lf][ok[lf]].tolist())
            s["per_song"][name] = dist(err[ok])
    # The line-level heuristic is measured on EXACTLY the songs the aligner was run on, so the rows compare like with
    # like; the same variants over every downloaded song are listed after them.
    scored = set(names)
    for p in sorted(RESULTS.glob("heuristic_*.json")):
        res = json.loads(p.read_text())
        name = res["name"]
        gt = load_gt(name)
        g = np.array(gt["starts"])
        for variant, onsets in res["variants"].items():
            pred = np.array(onsets, dtype=float)
            err = (pred - g) * 1000
            for label, take in ((f"line-level source -> estimated words ({variant})", name in scored), (f"[all songs] line-level source -> estimated words ({variant})", True)):
                if not take:
                    continue
                s = sources.setdefault(label, {"word": [], "line": [], "conf": [], "per_song": {}})
                s["word"].extend(err.tolist())
                s["line"].extend(err[gt["line_first"]].tolist())
                s["per_song"][name] = dist(err)

    report: dict = {"songs": names, "sources": {}}
    print(f"songs: {len(names)}  ({', '.join(names)})\n")
    for src, s in sources.items():
        wd, ld = dist(np.array(s["word"])), dist(np.array(s["line"]))
        report["sources"][src] = {"word_onset": wd, "line_start": ld, "per_song": s["per_song"]}
        print(f"== {src}")
        print("   word onset :", wd)
        print("   line start :", ld)
        if s["conf"]:
            e = np.abs(np.array(s["word"]))
            c = np.array(s["conf"])
            report["sources"][src]["confidence_spearman_vs_error"] = round(spearman(c, -e), 3)
            bins = [(0, 0.2), (0.2, 0.35), (0.35, 0.5), (0.5, 0.7), (0.7, 1.01)]
            table = []
            for lo, hi in bins:
                m = (c >= lo) & (c < hi)
                if m.sum():
                    table.append({"confidence": f"{lo:.2f}-{min(hi, 1):.2f}", "n": int(m.sum()), "median_err_ms": round(float(np.median(e[m]))), "within_200ms_pct": round(float((e[m] <= 200).mean() * 100), 1)})
            report["sources"][src]["by_confidence"] = table
            for row in table:
                print("     conf", row)
            flagged = c < 0.35
            bad = e > 200
            if bad.sum():
                report["sources"][src]["flagging"] = {
                    "threshold": 0.35,
                    "flagged_pct_of_words": round(float(flagged.mean() * 100), 1),
                    "errors_over_200ms_that_were_flagged_pct": round(float((flagged & bad).sum() / bad.sum() * 100), 1),
                    "unflagged_words_within_200ms_pct": round(float((~bad & ~flagged).sum() / max(1, (~flagged).sum()) * 100), 1),
                }
                print("   flagging   :", report["sources"][src]["flagging"])
        print()
    RESULTS.mkdir(exist_ok=True)
    (RESULTS / "report.json").write_text(json.dumps(report, indent=2))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["fetch", "run", "report"])
    ap.add_argument("--songs", type=int, default=20)
    ap.add_argument("--vocals", action="store_true")
    a = ap.parse_args()
    {"fetch": lambda: cmd_fetch(a.songs), "run": lambda: cmd_run(a.songs, a.vocals), "report": cmd_report}[a.cmd]()
