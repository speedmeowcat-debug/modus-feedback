"""analyze.py — verify that sound events land on their cue frames, and plot an overview.

Two independent checks per cue, combined into one end-to-end error:
  A. isolated voice : is the audible event (transient onset / envelope peak) at `anchor`?
  B. mixed stem     : is that voice actually positioned at (cue time - anchor) in the stem?
error_ms = audible_offset_in_voice + placement_offset_in_stem   (0 = perfect)

Tolerance: half a video frame (the best any frame-locked edit can promise).
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from scipy import signal
from scipy.io import wavfile

from . import dsp
from .dsp import SR
from .sfx import Ctx, render_cue


def _mono(x: np.ndarray) -> np.ndarray:
    return x.mean(axis=1) if x.ndim == 2 else x


def _env(x: np.ndarray, win_ms: float) -> np.ndarray:
    w = max(1, int(SR * win_ms / 1000.0))
    return np.convolve(np.abs(x), np.ones(w) / w, mode="same")


def audible_offset(voice: np.ndarray, anchor: int, anchor_kind: str) -> tuple[float, str]:
    """Offset (ms) between where the audible event really is and `anchor` (+ = later)."""
    m = dsp.highpass(_mono(voice), 120.0, 2)  # sub-bass pitch drops must not mask the transient
    if anchor_kind == "start":
        e = _env(m, 1.0)
        head = e[: int(0.15 * SR)]
        thr = 0.10 * float(head.max())
        onset = int(np.argmax(head >= thr))
        return (onset - anchor) / SR * 1000.0, "onset"
    if anchor_kind == "end":
        # a riser stops dead at its anchor: find the falling edge, not a smoothed maximum
        e = _env(m, 5.0)
        above = np.nonzero(e >= 0.5 * float(e.max()))[0]
        return (int(above[-1]) - anchor) / SR * 1000.0, "edge"
    e = _env(m, 25.0)
    pk = int(np.argmax(e))
    return (pk - anchor) / SR * 1000.0, "peak"


def placement_offset(stem: np.ndarray, voice: np.ndarray, start_sample: int, anchor: int,
                     anchor_kind: str) -> float:
    """Offset (ms) of the voice inside the stem vs where it was supposed to start.
    Template = the part of the voice that carries energy: its head for 'start' anchors,
    a window around the anchor otherwise (soft-onset sounds have an ambiguous head)."""
    if anchor_kind == "start":
        w0, w1 = 0, min(len(voice), int(0.06 * SR))  # short head: dense cue trains must not leak into the template
    else:
        w0, w1 = max(0, anchor - int(0.15 * SR)), min(len(voice), anchor + int(0.15 * SR))
    tmpl = dsp.highpass(_mono(voice)[w0:w1], 120.0, 2)
    pad = int(0.07 * SR)  # +-2 frames: enough to expose a misplacement, too small to reach a repeat of the same sound
    expect = start_sample + w0  # where the template should sit in the stem
    seg_lo = max(0, expect - pad)
    seg = dsp.highpass(_mono(stem)[seg_lo: expect + (w1 - w0) + pad], 120.0, 2)
    if len(seg) < len(tmpl) or float(np.max(np.abs(tmpl))) < 1e-9:
        return float("nan")
    corr = signal.fftconvolve(seg, tmpl[::-1], mode="valid")
    # normalised: a louder neighbour (rising-intensity trains) must not win over the true position
    energy = np.sqrt(np.maximum(np.convolve(seg ** 2, np.ones(len(tmpl)), mode="valid"), 1e-18))
    score = corr / energy
    # identical sounds repeat (same pitch, a few frames apart): among near-best matches prefer
    # the one nearest to the expected position, so a repeat cannot masquerade as a displacement
    cand = np.nonzero(score >= 0.92 * float(score.max()))[0]
    k = int(cand[np.argmin(np.abs(cand - (expect - seg_lo)))])
    return (seg_lo + k - expect) / SR * 1000.0


def verify(timeline: dict, out_dir: Path, name: str = "audio", tol_frames: float = 0.5) -> dict:
    spec = timeline["spec"]
    fps = spec["fps"]
    tol_ms = 1000.0 / fps * tol_frames
    report = json.loads((out_dir / f"{name}.report.json").read_text())
    stem = wavfile.read(out_dir / f"{name}.sfx.wav")[1].astype(np.float64)
    mus = timeline.get("music")
    ctx = Ctx(mus["key"], mus["mode"]) if mus else Ctx()
    by_id = {p["id"]: p for p in report["cues"]}
    rows = []
    for cue in timeline["cues"]:
        p = by_id[cue["id"]]
        v = render_cue(cue, ctx)
        a_ms, what = audible_offset(v.audio, v.anchor, cue["anchor"])
        s_ms = (placement_offset(stem, v.audio, p["start_sample"], v.anchor, cue["anchor"])
                if p["cropped_samples"] == 0 else float("nan"))
        total = a_ms + (0.0 if np.isnan(s_ms) else s_ms)
        tol = tol_ms if what in ("onset", "edge") else max(tol_ms, 25.0)  # smoothed peaks are broader than edges
        rows.append({
            "id": cue["id"], "kind": cue["kind"], "frame": cue["frame"], "anchor": cue["anchor"],
            "measured": what, "voice_offset_ms": round(a_ms, 2),
            "placement_offset_ms": None if np.isnan(s_ms) else round(s_ms, 3),
            "error_ms": round(total, 2), "tolerance_ms": round(tol, 1),
            "pass": bool(abs(total) <= tol),
        })
    ok = all(r["pass"] for r in rows)
    out = {"tolerance_frames": tol_frames, "all_pass": ok, "cues": rows}
    (out_dir / f"{name}.sync.json").write_text(json.dumps(out, indent=2))
    return out


def plot_overview(timeline: dict, out_dir: Path, name: str, png: Path,
                  visual_activity: list[float] | None = None) -> None:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    fps = timeline["spec"]["fps"]
    sr, x = wavfile.read(out_dir / f"{name}.wav")
    m = x.astype(np.float64).mean(axis=1) / 32768.0
    dur = len(m) / sr
    rows = 3 if visual_activity is not None else 2
    fig, axes = plt.subplots(rows, 1, figsize=(14, 2.6 * rows + 1), sharex=True)
    i = 0
    if visual_activity is not None:
        ax = axes[i]
        i += 1
        ax.plot(np.arange(len(visual_activity)) / fps, visual_activity, lw=1.0, color="#2a6")
        ax.set_ylabel("visual\nactivity")
    ax = axes[i]
    i += 1
    t = np.arange(len(m)) / sr
    step = max(1, len(m) // 6000)
    ax.fill_between(t[::step], -np.abs(m[::step]), np.abs(m[::step]), color="#335", lw=0)
    ax.set_ylabel("master")
    ax = axes[i]
    f, tt_, S = signal.spectrogram(m, sr, nperseg=2048, noverlap=1536)
    ax.pcolormesh(tt_, f, 10 * np.log10(S + 1e-12), shading="auto", vmin=-110, vmax=-40, cmap="magma")
    ax.set_yscale("symlog", linthresh=200)
    ax.set_ylim(30, 16000)
    ax.set_ylabel("Hz")
    ax.set_xlabel("seconds")
    for a in axes:
        for c in timeline["cues"]:
            a.axvline(c["frame"] / fps, color="#fff" if a is axes[-1] else "#c33", lw=0.6, alpha=0.8)
    for c in timeline["cues"]:
        axes[0].text(c["frame"] / fps, axes[0].get_ylim()[1], c["kind"], rotation=90, va="top",
                     ha="right", fontsize=6, color="#c33")
    axes[0].set_title(f"{timeline['spec']['id']} — cue markers over master  ({dur:.1f}s)")
    fig.tight_layout()
    fig.savefig(png, dpi=110)
    plt.close(fig)
