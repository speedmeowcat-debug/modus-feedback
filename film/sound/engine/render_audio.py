"""render_audio.py — timeline.json -> audio.wav (+ stems + report).

    python3 tools/render_audio.py path/to/timeline.json --out out/dir [--name audio]

Pipeline
  1. render every cue with its recipe, place it so `anchor` lands on the cue frame
  2. render the tempo/key-locked music bed from the same file
  3. duck the music under strong cues (cue-driven side-chain, not a compressor guess)
  4. sum, fade, normalise to the target loudness (BS.1770) under a true-peak ceiling
  5. write master + float stems + a JSON report (levels, placements, warnings)
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
from scipy.io import wavfile

from . import dsp
from .dsp import SR
from .music import render_music
from .sfx import Ctx, render_cue

DEFAULT_MIX = {
    "targetLufs": -14.0,
    "truePeakDb": -1.5,
    "musicDb": -8.0,
    "sfxDb": 0.0,
    "duck": {"depthDb": 5.0, "attackMs": 8.0, "releaseMs": 280.0},
    "fadeIn": 0.0,
    "fadeOut": 0.25,
}

DUCK_KINDS = {"impact", "thud", "snap", "chime"}


def _duck_curve(n: int, triggers: list[tuple[int, float]], depth_db: float,
                attack_ms: float, release_ms: float) -> np.ndarray:
    """Per-sample music gain (linear). Each trigger digs a dip scaled by its intensity."""
    dip = np.zeros(n)  # in dB (positive = reduction)
    atk = max(1, int(SR * attack_ms / 1000.0))
    rel_tau = SR * release_ms / 1000.0
    for s, inten in triggers:
        depth = depth_db * inten
        a0 = max(0, s - atk)  # start dipping slightly BEFORE the hit so the hit is clean
        ramp = np.linspace(0, depth, s - a0 + 1) if s > a0 else np.array([depth])
        end = min(n, s + int(rel_tau * 6))
        tail = depth * np.exp(-np.arange(0, end - s) / rel_tau)
        seg = np.concatenate([ramp[:-1], tail]) if len(ramp) > 1 else tail
        dip[a0:a0 + len(seg)] = np.maximum(dip[a0:a0 + len(seg)], seg[: n - a0])
    return 10.0 ** (-dip / 20.0)


def _to_pcm16(x: np.ndarray, seed: int = 1) -> np.ndarray:
    rng = np.random.default_rng(seed)
    tpdf = (rng.random(x.shape) - rng.random(x.shape)) / 32768.0
    return np.clip(np.round((x + tpdf) * 32767.0), -32768, 32767).astype(np.int16)


def finalize(master: np.ndarray, target_lufs: float, tp_db: float) -> tuple[np.ndarray, dict]:
    """Normalise loudness under a true-peak ceiling (iterative)."""
    warns: list[str] = []
    pre = master.copy()
    lufs0 = dsp.integrated_lufs(pre)
    if lufs0 <= -69.0:
        warns.append("master is (near) silent; loudness normalisation skipped")
        return pre, {"warnings": warns, "gain_db": 0.0}

    def post(g_db: float) -> tuple[float, np.ndarray]:
        y_ = dsp.limiter(pre * dsp.db2lin(g_db), tp_db - 0.3)
        return dsp.integrated_lufs(y_), y_

    # secant search on the gain that reaches the target AFTER limiting
    g0 = target_lufs - lufs0
    l0, y0 = post(g0)
    g1 = g0 + (target_lufs - l0)
    l1, y1 = post(g1)
    best = (abs(l0 - target_lufs), g0, y0, l0)
    if abs(l1 - target_lufs) < best[0]:
        best = (abs(l1 - target_lufs), g1, y1, l1)
    for _ in range(8):
        if best[0] < 0.15:
            break
        slope = (l1 - l0) / (g1 - g0) if abs(g1 - g0) > 1e-6 else 1.0
        slope = float(np.clip(slope, 0.15, 1.0))
        g2 = g1 + (target_lufs - l1) / slope
        g0, l0 = g1, l1
        g1 = g2
        l1, y1 = post(g1)
        if abs(l1 - target_lufs) < best[0]:
            best = (abs(l1 - target_lufs), g1, y1, l1)
    _, g_total, y, lufs_final = best

    tp = dsp.true_peak_db(y)
    guard = 0
    while tp > tp_db and guard < 6:
        # true peaks sit BETWEEN samples: lower the *sample* ceiling by the excess
        sample_peak = dsp.lin2db(float(np.max(np.abs(y))))
        y = dsp.limiter(y, sample_peak - (tp - tp_db) - 0.05)
        tp = dsp.true_peak_db(y)
        guard += 1

    reduction = dsp.lin2db(float(np.max(np.abs(pre * dsp.db2lin(g_total))))) - dsp.lin2db(float(np.max(np.abs(y))))
    if abs(lufs_final - target_lufs) > 0.5:
        warns.append(f"could not reach {target_lufs} LUFS (got {lufs_final:.1f}) under the {tp_db} dBTP ceiling: "
                     f"crest factor too high — lower SFX peak intensities or raise musicDb")
    if reduction > 6.0:
        warns.append(f"limiter is taking {reduction:.1f} dB off the peaks — expect audible pumping; "
                     f"reduce impact/thud intensity or shorten their tails")
    if g_total > 24:
        warns.append(f"normalisation gain {g_total:.1f} dB is very large — check levels")
    return y, {"warnings": warns, "gain_db": g_total, "peak_reduction_db": reduction}


def render(timeline: dict, out_dir: Path, name: str = "audio") -> dict:
    spec = timeline["spec"]
    fps, dur_f = int(spec["fps"]), int(spec["durationInFrames"])
    if SR % fps != 0:
        raise ValueError(f"fps {fps} does not divide {SR}; use 24/25/30/48/50/60")
    n = dur_f * (SR // fps)
    music_spec = timeline.get("music")
    mix_cfg = {**DEFAULT_MIX, **(timeline.get("mix") or {})}
    mix_cfg["duck"] = {**DEFAULT_MIX["duck"], **((timeline.get("mix") or {}).get("duck") or {})}
    ctx = Ctx(music_spec["key"], music_spec["mode"]) if music_spec else Ctx()
    warnings: list[str] = []

    # --- SFX bus
    sfx = np.zeros((n + 3 * SR, 2))
    placements = []
    triggers: list[tuple[int, float]] = []
    for cue in timeline["cues"]:
        v = render_cue(cue, ctx)
        expected = int(round(cue["t"] * SR))
        start = expected - v.anchor
        cropped = dsp.place(sfx, v.audio, start)
        if cropped:
            warnings.append(f"cue {cue['id']}: {cropped / SR * 1000:.0f} ms of pre-roll cropped "
                            f"(cue too close to t=0 for its anchor)")
        placements.append({
            "id": cue["id"], "kind": cue["kind"], "frame": cue["frame"],
            "expected_sample": expected, "start_sample": start, "anchor_sample": v.anchor,
            "length_samples": len(v.audio), "cropped_samples": cropped,
            "scores": cue["scores"],
        })
        if cue["kind"] in DUCK_KINDS and cue["intensity"] >= 0.5:
            triggers.append((expected, float(cue["intensity"])))
    sfx = dsp.highpass(sfx[:n], 25.0, 2)

    # --- music bus
    if music_spec:
        m = render_music(music_spec, fps, dur_f)
        music = m["audio"]
        music_meta = {"bpm": m["bpm"], "beats": len(m["beats"]), "kicks": len(m["kicks"]),
                      "key": music_spec["key"], "mode": music_spec["mode"]}
    else:
        music, music_meta = np.zeros((n, 2)), None
    if music_meta:
        music = dsp.peak_norm(music, 0.8)
    duck_cfg = mix_cfg["duck"]
    duck = _duck_curve(n, triggers, duck_cfg["depthDb"], duck_cfg["attackMs"], duck_cfg["releaseMs"])
    music_post = music * duck[:, None] * dsp.db2lin(mix_cfg["musicDb"])

    sfx_post = sfx * dsp.db2lin(mix_cfg["sfxDb"])
    master = music_post + sfx_post
    master = dsp.fade(master, mix_cfg["fadeIn"], mix_cfg["fadeOut"])
    master_n, fin = finalize(master, mix_cfg["targetLufs"], mix_cfg["truePeakDb"])
    warnings += fin["warnings"]
    g = dsp.db2lin(fin["gain_db"])

    out_dir.mkdir(parents=True, exist_ok=True)
    wavfile.write(out_dir / f"{name}.wav", SR, _to_pcm16(master_n))
    # stems use the same overall gain so levels are comparable; float to keep precision
    wavfile.write(out_dir / f"{name}.sfx.wav", SR, (sfx_post * g).astype(np.float32))
    wavfile.write(out_dir / f"{name}.music.wav", SR, (music_post * g).astype(np.float32))

    report = {
        "version": 1,
        "timeline": spec["id"],
        "sample_rate": SR,
        "fps": fps,
        "duration_s": n / SR,
        "loudness": {
            "target_lufs": mix_cfg["targetLufs"],
            "integrated_lufs": round(dsp.integrated_lufs(master_n), 2),
            "true_peak_dbtp": round(dsp.true_peak_db(master_n), 2),
            "true_peak_ceiling_dbtp": mix_cfg["truePeakDb"],
            "sample_peak_db": round(dsp.lin2db(float(np.max(np.abs(master_n)))), 2),
            "normalisation_gain_db": round(fin["gain_db"], 2),
            "limiter_peak_reduction_db": round(fin.get("peak_reduction_db", 0.0), 2),
        },
        "music": music_meta,
        "mix": mix_cfg,
        "ducking_triggers": len(triggers),
        "cues": placements,
        "warnings": warnings,
    }
    (out_dir / f"{name}.report.json").write_text(json.dumps(report, indent=2))
    return report


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("timeline", type=Path)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--name", default="audio")
    a = ap.parse_args()
    tl = json.loads(a.timeline.read_text())
    rep = render(tl, a.out, a.name)
    L = rep["loudness"]
    print(f"{a.name}: {rep['duration_s']:.2f}s  {L['integrated_lufs']} LUFS (target {L['target_lufs']})  "
          f"TP {L['true_peak_dbtp']} dBTP (ceiling {L['true_peak_ceiling_dbtp']})  "
          f"cues={len(rep['cues'])}")
    for w in rep["warnings"]:
        print("  WARNING:", w)


if __name__ == "__main__":
    main()
