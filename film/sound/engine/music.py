"""music.py — tempo- and key-locked procedural music bed.

The music spec comes from the SAME timeline file as the animation, so beats land
on frame boundaries (when the bpm is frame-locked) and every SFX is tuned to the
same key. This module renders a stereo bed plus the beat/kick grids (used for
ducking and for verifying sync).
"""
from __future__ import annotations

import numpy as np

from . import dsp
from .dsp import SR, secs, tt

# default per-layer balance before the user's layer gain (0..1)
_BAL = {"pad": 0.45, "bass": 0.8, "arp": 0.5, "kick": 0.95, "hat": 0.3, "clap": 0.5, "pulse": 0.4}


def _energy(arc: list[dict] | None, bar: int) -> float:
    if not arc:
        return 1.0
    e = arc[0]["energy"]
    for a in sorted(arc, key=lambda a: a["bar"]):
        if a["bar"] <= bar:
            e = a["energy"]
    return float(e)


# ----------------------------------------------------------------------------- voices

def _pad_chord(freqs: list[float], n: int, fc: float, seed: int) -> np.ndarray:
    rng = dsp.rng_from(seed, "pad")
    out = np.zeros((n, 2))
    for f in freqs:
        for cents, pan in ((-7.0, -0.55), (0.0, 0.0), (7.0, 0.55)):
            fr = f * 2 ** (cents / 1200.0)
            v = dsp.saw_additive(fr, n, max_harm=16, phase0=float(rng.uniform(0, 2 * np.pi)))
            out += dsp.pan_stereo(v, pan) * 0.22
    out = dsp.lowpass(out, fc, 2)
    env = dsp.adsr(n, 0.35, 0.25, 0.8, 0.6)
    return out * env[:, None]


def _bass_note(f: float, n: int) -> np.ndarray:
    t = tt(n)
    sine = np.sin(2 * np.pi * f * t)
    saw = dsp.lowpass(dsp.saw_additive(f, n, max_harm=10), 520, 2)
    env = dsp.attack_decay(n, 0.004, 0.28) * dsp.fade(np.ones(n), 0, 0.02)
    return np.tanh((sine * 0.8 + saw * 0.35) * env * 1.4)


def _pluck(f: float, n: int) -> np.ndarray:
    t = tt(n)
    out = np.zeros(n)
    for h in range(1, 8):
        fr = f * h
        if fr > SR * 0.45:
            break
        out += np.sin(2 * np.pi * fr * t) * np.exp(-t / (0.18 / (h ** 0.8))) / h
    return out * dsp.fade(np.ones(n), 0.001, 0.02) * 0.9


def _kick(rng: np.random.Generator) -> np.ndarray:
    n = secs(0.3)
    t = tt(n)
    f = 48.0 + 120.0 * np.exp(-t / 0.05)
    body = np.sin(dsp.sine_phase(f)) * dsp.attack_decay(n, 0.001, 0.13)
    click = np.pad(dsp.highpass(dsp.white(secs(0.006), rng), 2000) * dsp.exp_decay(secs(0.006), 0.002),
                   (0, n - secs(0.006))) * 0.25
    return np.tanh((body + click) * 1.5)


def _hat(rng: np.random.Generator, open_: bool = False) -> np.ndarray:
    n = secs(0.18 if open_ else 0.06)
    return dsp.highpass(dsp.white(n, rng), 7000) * dsp.exp_decay(n, 0.07 if open_ else 0.018)


def _clap(rng: np.random.Generator) -> np.ndarray:
    n = secs(0.3)
    out = np.zeros(n)
    for off in (0.0, 0.009, 0.018):
        burst = dsp.bandpass(dsp.white(secs(0.04), rng), 1200, 3600) * dsp.exp_decay(secs(0.04), 0.012)
        dsp.place(out, burst, secs(off))
    tail = dsp.bandpass(dsp.white(n, rng), 1000, 3000) * dsp.exp_decay(n, 0.09) * 0.35
    return out + np.pad(tail, (secs(0.018), 0))[:n]


# ----------------------------------------------------------------------------- render

def render_music(spec: dict, fps: int, duration_frames: int) -> dict:
    n_total = int(round(duration_frames * SR / fps))
    bpm = float(spec["bpm"])
    key, mode = spec["key"], spec["mode"]
    seed = int(spec.get("seed", 7))
    layers = {k: float(v) for k, v in (spec.get("layers") or {}).items() if v}
    arc = spec.get("arc")
    swing = float(spec.get("swing", 0.0))
    prog = spec["progression"]
    start = int(round(spec.get("startFrame", 0) * SR / fps))
    bl = 60.0 / bpm * SR  # samples per beat (float)
    bar_len = bl * 4
    n_bars = int(spec["bars"])
    rng = dsp.rng_from(seed, "music")

    buses = {k: np.zeros((n_total + SR, 2)) for k in layers}
    kicks: list[int] = []
    beats: list[int] = []
    cache: dict = {}

    def at(beat: float) -> int:
        return start + int(round(beat * bl))

    for bar in range(n_bars):
        e = _energy(arc, bar)
        deg = prog[bar % len(prog)]
        b0 = bar * 4
        if at(b0) >= n_total:
            break
        for k in range(4):
            beats.append(at(b0 + k))

        if "pad" in layers and e > 0.05:
            ch = dsp.chord_midis(key, mode, deg, 3, seventh=True)
            freqs = [dsp.midi_to_hz(m) for m in ch]
            fc = 700 + 1800 * e
            ck = ("pad", deg, round(fc))
            if ck not in cache:
                cache[ck] = _pad_chord(freqs, int(bar_len + secs(0.7)), fc, seed + deg)
            dsp.place(buses["pad"], cache[ck], at(b0), layers["pad"] * _BAL["pad"] * (0.6 + 0.4 * e))

        if "bass" in layers and e >= 0.3:
            f = dsp.midi_to_hz(dsp.scale_midi(key, mode, deg, 1) + (12 if dsp.scale_midi(key, mode, deg, 1) < 33 else 0))
            pos = [0, 1.5, 2, 3.5] if e >= 0.6 else [0, 2]
            for p in pos:
                nlen = secs(0.45)
                ck = ("bass", round(f, 2))
                if ck not in cache:
                    cache[ck] = _bass_note(f, nlen)
                dsp.place(buses["bass"], cache[ck], at(b0 + p), layers["bass"] * _BAL["bass"])

        if "arp" in layers and e >= 0.35:
            tones = [dsp.scale_midi(key, mode, deg + o, 3) for o in (0, 2, 4, 6)]
            seq = [tones[0], tones[1], tones[2], tones[3] , tones[2] + 0, tones[1]]
            seq = seq + [m + 12 for m in seq[:2]]
            step = 0.25 if e >= 0.7 else 0.5
            steps = int(4 / step)
            for s_i in range(steps):
                m = seq[s_i % len(seq)] + (12 if (s_i // len(seq)) % 2 else 0)
                f = dsp.midi_to_hz(m)
                ck = ("pluck", round(f, 2))
                if ck not in cache:
                    cache[ck] = _pluck(f, secs(0.4))
                pan = -0.35 if s_i % 2 == 0 else 0.35
                dsp.place(buses["arp"], dsp.pan_stereo(cache[ck], pan), at(b0 + s_i * step),
                          layers["arp"] * _BAL["arp"] * (0.7 + 0.3 * e))

        if "kick" in layers and e >= 0.45:
            pos = [0, 1, 2, 3] if e >= 0.7 else [0, 2]
            for p in pos:
                if "kick" not in cache:
                    cache["kick"] = _kick(rng)
                dsp.place(buses["kick"], dsp.to_stereo(cache["kick"]), at(b0 + p), layers["kick"] * _BAL["kick"])
                kicks.append(at(b0 + p))

        if "hat" in layers and e >= 0.5:
            for p in (0.5, 1.5, 2.5, 3.5):
                if "hat" not in cache:
                    cache["hat"] = _hat(rng)
                dsp.place(buses["hat"], dsp.pan_stereo(cache["hat"], 0.25),
                          at(b0 + p + swing * 0.12), layers["hat"] * _BAL["hat"] * (0.6 + 0.4 * e))
            if e >= 0.85:
                if "ohat" not in cache:
                    cache["ohat"] = _hat(rng, True)
                dsp.place(buses["hat"], dsp.pan_stereo(cache["ohat"], -0.2), at(b0 + 3.5),
                          layers["hat"] * _BAL["hat"] * 0.7)

        if "clap" in layers and e >= 0.6:
            for p in (1, 3):
                if "clap" not in cache:
                    cache["clap"] = _clap(rng)
                dsp.place(buses["clap"], dsp.to_stereo(cache["clap"]), at(b0 + p), layers["clap"] * _BAL["clap"])

        if "pulse" in layers and e >= 0.6:
            ch = dsp.chord_midis(key, mode, deg, 3, seventh=False)
            for p in (0.5, 2.5):
                ck = ("stab", deg)
                if ck not in cache:
                    nlen = secs(0.22)
                    v = sum(dsp.saw_additive(dsp.midi_to_hz(m), nlen, max_harm=12) for m in ch) / 3.0
                    cache[ck] = dsp.lowpass(v, 1800, 2) * dsp.attack_decay(nlen, 0.002, 0.08)
                dsp.place(buses["pulse"], dsp.pan_stereo(cache[ck], 0.15), at(b0 + p),
                          layers["pulse"] * _BAL["pulse"])

    # arp ping-pong echo: dotted eighth
    if "arp" in buses:
        d = int(bl * 0.75)
        a = buses["arp"]
        echo = np.zeros_like(a)
        echo[d:, 0] += a[:-d, 1] * 0.35
        echo[d:, 1] += a[:-d, 0] * 0.35
        echo[2 * d:, 0] += a[:-2 * d, 0] * 0.18
        echo[2 * d:, 1] += a[:-2 * d, 1] * 0.18
        buses["arp"] = a + echo

    mix = np.zeros((n_total + SR, 2))
    for b in buses.values():
        mix += b
    mix = mix[:n_total]
    return {"audio": mix, "kicks": [k for k in kicks if k < n_total],
            "beats": [b for b in beats if b < n_total], "bpm": bpm}
