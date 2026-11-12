"""sfx.py — procedural SFX recipes driven by cue parameters.

Each recipe is a pure function of (cue, context). The only "randomness" is a
generator seeded from the cue id, so the same cue always renders the same sound
and variation between repeated cues (e.g. typing) is repeatable.

Mapping rules (see sound/sound-design.md):
  intensity  -> level (dB curve) AND hardness (more intensity = more transient energy)
  brightness -> spectral centre (small/light things bright, large/heavy things dark)
  dur        -> the MOTION's duration; spans (whoosh/riser/sweep/swell) are built to fit it
  anchor     -> which instant of the sound lands exactly on the cue frame
  pitch      -> tuned to the music key when the cue is tonal
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from pathlib import Path

from . import dsp
from .dsp import SR, secs, tt


@dataclass
class Ctx:
    key: str = "A"
    mode: str = "minor"


@dataclass
class Voice:
    audio: np.ndarray  # (n, 2)
    anchor: int  # sample index inside `audio` that must land on the cue time


# ----------------------------------------------------------------------------- helpers

def resolve_pitch(pitch, ctx: Ctx, degree: int, octave: int,
                  lo: float | None = None, hi: float | None = None) -> float:
    """cue.pitch -> Hz. Accepts None, Hz, note name, 'root|third|fifth|seventh|octave', 'degree:N'."""
    if pitch is None:
        hz = dsp.scale_hz(ctx.key, ctx.mode, degree, octave)
    elif isinstance(pitch, (int, float)):
        hz = float(pitch)
    else:
        p = str(pitch).strip()
        named = {"root": 1, "second": 2, "third": 3, "fourth": 4, "fifth": 5,
                 "sixth": 6, "seventh": 7, "octave": 8}
        if p in named:
            hz = dsp.scale_hz(ctx.key, ctx.mode, named[p], octave)
        elif p.startswith("degree:"):
            hz = dsp.scale_hz(ctx.key, ctx.mode, int(p.split(":")[1]), octave)
        else:
            hz = dsp.note_to_hz(p)
    if lo is not None and hi is not None:
        hz = dsp.fold_into_range(hz, lo, hi)
    return hz


def _amp(intensity: float) -> float:
    """intensity 0..1 -> linear gain on a dB curve (1.0 -> 0 dB, 0.5 -> -12 dB, 0 -> -24 dB)."""
    return dsp.db2lin(-24.0 * (1.0 - float(np.clip(intensity, 0, 1))))


def _fit(x: np.ndarray, n: int) -> np.ndarray:
    if len(x) >= n:
        return x[:n]
    return np.pad(x, ((0, n - len(x)),) + ((0, 0),) * (x.ndim - 1))


def _finish(stereo: np.ndarray, intensity: float, fade_in_ms: float = 1.0,
            fade_out_ms: float = 8.0) -> np.ndarray:
    stereo = dsp.to_stereo(stereo)
    stereo = dsp.peak_norm(stereo, 0.9) * _amp(intensity)
    return dsp.fade(stereo, fade_in_ms / 1000.0, fade_out_ms / 1000.0)


def _balance(stereo: np.ndarray, pan: float) -> np.ndarray:
    """Apply pan to an already-stereo (wide) signal."""
    a = (pan + 1.0) * np.pi / 4.0
    g = np.array([np.cos(a), np.sin(a)]) * np.sqrt(2.0)
    return stereo * g[None, :]


def _bell_env(n: int, peak_pos: float, n_main: int) -> np.ndarray:
    """Raised-cosine bell over n_main samples peaking at peak_pos (0..1); zero after."""
    x = np.arange(n) / max(n_main, 1)
    p = float(np.clip(peak_pos, 0.05, 0.95))
    env = np.zeros(n)
    rise = x <= p
    fall = (x > p) & (x <= 1.0)
    env[rise] = 0.5 - 0.5 * np.cos(np.pi * x[rise] / p)
    env[fall] = 0.5 + 0.5 * np.cos(np.pi * (x[fall] - p) / (1.0 - p))
    return env


# ----------------------------------------------------------------------------- recipes

def impact(c: dict, ctx: Ctx) -> Voice:
    rng = dsp.rng_from(c["seed"], "impact")
    i, b = c["intensity"], c["brightness"]
    n = secs(max(c["dur"], 0.9))
    f_end = resolve_pitch(c["pitch"], ctx, 1, 1, lo=38.0, hi=76.0)
    f_start = f_end * (2.0 + 1.3 * i)
    t = tt(n)
    f = f_end + (f_start - f_end) * np.exp(-t / 0.045)
    sub = np.sin(dsp.sine_phase(f)) * dsp.attack_decay(n, 0.002, 0.30 * (0.7 + 0.6 * i))
    body = dsp.lowpass(dsp.white(secs(0.14), rng), 260 + 900 * b) * dsp.exp_decay(secs(0.14), 0.035)
    click = dsp.highpass(dsp.white(secs(0.012), rng), 1800) * dsp.exp_decay(secs(0.012), 0.0035)
    mono = 0.9 * sub + 0.55 * _fit(body, n) + (0.12 + 0.35 * b) * _fit(click, n)
    mono = np.tanh(mono * 1.6) / np.tanh(1.6)  # soft saturation: audible on small speakers
    st = dsp.pan_stereo(mono, c["pan"])
    ir = dsp.reverb_ir(0.6 + 0.9 * (1.0 - b), rng, damping_hz=4500)
    out = dsp.apply_reverb(st, ir, wet=0.5)
    return Voice(_finish(out, i, 0.2, 25.0), 0)


def thud(c: dict, ctx: Ctx) -> Voice:
    rng = dsp.rng_from(c["seed"], "thud")
    i, b = c["intensity"], c["brightness"]
    n = secs(max(c["dur"], 0.4))
    f_end = resolve_pitch(c["pitch"], ctx, 1, 2, lo=62.0, hi=124.0)
    t = tt(n)
    f = f_end + (f_end * 1.1) * np.exp(-t / 0.03)
    sub = np.sin(dsp.sine_phase(f)) * dsp.attack_decay(n, 0.001, 0.11)
    nb = secs(0.05)
    body = _fit(dsp.lowpass(dsp.white(nb, rng), 500 + 900 * b) * dsp.exp_decay(nb, 0.015), n)
    mono = np.tanh((sub + 0.6 * body) * 1.3)
    out = dsp.apply_reverb(dsp.pan_stereo(mono, c["pan"]), dsp.reverb_ir(0.18, rng), wet=0.25)
    return Voice(_finish(out, i, 0.2, 15.0), 0)


def whoosh(c: dict, ctx: Ctx) -> Voice:
    i, b, dur, peak = c["intensity"], c["brightness"], c["dur"], c["peak"]
    n_main = secs(dur)
    n = n_main + secs(0.2 + 0.5 * dur)
    x = np.arange(n) / max(n_main, 1)
    p = float(np.clip(peak, 0.1, 0.9))
    fa, fb = 250.0 * 2 ** (1.5 * b), 1800.0 * 2 ** (2.2 * b)
    logf = np.where(
        x <= p,
        np.log(fa) + (np.log(fb) - np.log(fa)) * (x / p) ** 1.2,
        np.log(fb) + (np.log(fb * 0.7) - np.log(fb)) * np.clip((x - p) / max(1 - p, 1e-3), 0, 1),
    )
    fc = np.exp(logf)
    tau_fall = max(0.05, (1 - p) * dur * 0.5 + 0.06)
    env = np.where(x <= p, (np.clip(x / p, 0, 1)) ** 1.8,
                   np.exp(-(x - p) * dur / tau_fall))
    ch = []
    for side in ("L", "R"):
        rng = dsp.rng_from(c["seed"], "whoosh" + side)
        ch.append(dsp.swept_noise(n, fc, 1.0, rng))
    noise = np.stack(ch, axis=1) * env[:, None]
    rng = dsp.rng_from(c["seed"], "whoosh-body")
    body = dsp.lowpass(dsp.white(n, rng), 220) * (env ** 1.5) * (0.5 * (1.0 - b))
    st = _balance(noise / (np.max(np.abs(noise)) + 1e-9) + body[:, None] * 0.6, c["pan"])
    return Voice(_finish(st, i, 3.0, 12.0), secs(p * dur))


def riser(c: dict, ctx: Ctx) -> Voice:
    i, dur = c["intensity"], c["dur"]
    n_main = secs(dur)
    n = n_main + secs(0.45)
    x = np.linspace(0.0, 1.0, n_main)
    fc = 300.0 * (9000.0 / 300.0) ** (x ** 1.4)
    chs = []
    for side in ("L", "R"):
        rng = dsp.rng_from(c["seed"], "riser" + side)
        chs.append(dsp.swept_noise(n_main, fc, 0.9, rng))
    noise = np.stack(chs, axis=1) * (x ** 2.2)[:, None]
    f0 = resolve_pitch(c["pitch"], ctx, 1, 3, lo=110.0, hi=220.0)
    freq = f0 * 2.0 ** (2.0 * x ** 1.3)
    ph = dsp.sine_phase(freq)
    tone = (np.sin(ph) + 0.5 * np.sin(2 * ph) + 0.33 * np.sin(3 * ph)) * (x ** 2.5) * 0.45
    lfo = dsp.sine_phase(4.0 + 20.0 * x)
    trem = 1.0 - 0.35 * x * (0.5 + 0.5 * np.sin(lfo))
    stereo = noise * trem[:, None] * 0.9 + tone[:, None] * 0.7
    stereo = _balance(stereo, c["pan"])
    stereo = dsp.fade(stereo, 0.01, 0.008)  # cut cleanly at the anchor
    stereo = np.vstack([stereo, np.zeros((n - n_main, 2))])
    rng = dsp.rng_from(c["seed"], "riser-room")
    out = dsp.apply_reverb(stereo, dsp.reverb_ir(0.5, rng), wet=0.2)[:n]
    # the reverb tail must not become the loudest part: check the SMOOTHED envelope
    # (a single random noise sample can sit a few ms early on a nearly flat envelope)
    # window >= one tremolo period at the top rate (24 Hz = 42 ms), or a trough can mimic an early peak
    sm = np.convolve(np.abs(out).max(axis=1), np.ones(secs(0.05)) / secs(0.05), mode="same")
    peak_i = int(np.argmax(sm))
    assert abs(peak_i - n_main) < SR * 0.04, f"riser envelope peak at {peak_i} vs anchor {n_main}"
    return Voice(_finish(out, i, 5.0, 20.0), n_main)


def sweep(c: dict, ctx: Ctx) -> Voice:
    i, b, dur, peak = c["intensity"], c["brightness"], c["dur"], c["peak"]
    n_main = secs(dur)
    n = n_main + secs(0.35)
    x = np.arange(n) / max(n_main, 1)
    p = float(np.clip(peak, 0.1, 0.9))
    f1 = resolve_pitch(c["pitch"], ctx, 5, 5, lo=440.0, hi=1760.0)
    f0 = f1 / 2.2
    s = np.clip(x / p, 0, 1)
    s = s * s * (3 - 2 * s)
    f = f0 * (f1 / f0) ** s
    f = np.where(x > p, f1 * (0.92 ** np.clip((x - p) / max(1 - p, 1e-3), 0, 1)), f)
    ph = dsp.sine_phase(f)
    env = _bell_env(n, p, n_main)
    tone = (np.sin(ph) + 0.28 * np.sin(2 * ph)) * env
    rng = dsp.rng_from(c["seed"], "sweep")
    shim = dsp.bandpass(dsp.white(n, rng), 4000, 9500) * env * (0.08 + 0.12 * b)
    st = dsp.pan_stereo(tone + shim, c["pan"])
    out = dsp.apply_reverb(st, dsp.reverb_ir(0.7, rng), wet=0.12)
    return Voice(_finish(out, i, 3.0, 40.0), secs(p * dur))


def swell(c: dict, ctx: Ctx) -> Voice:
    i, b, dur, peak = c["intensity"], c["brightness"], c["dur"], c["peak"]
    n_main = secs(dur)
    n = n_main + secs(0.5)
    x = np.arange(n) / max(n_main, 1)
    p = float(np.clip(peak, 0.15, 0.85))
    env = _bell_env(n, p, n_main) ** 1.3
    up = np.clip(x / p, 0, 1)
    fc = 250.0 * (1400.0 * 2 ** b / 250.0) ** np.sin(np.pi * np.clip(x, 0, 1) * 0.5) * \
        np.where(x > p, 1.0 - 0.45 * np.clip((x - p) / max(1 - p, 1e-3), 0, 1), 1.0)
    fc = np.maximum(fc, 120.0)
    chs = [dsp.swept_noise(n, fc, 1.2, dsp.rng_from(c["seed"], "swell" + s)) for s in ("L", "R")]
    noise = np.stack(chs, axis=1) * env[:, None]
    r, fifth = resolve_pitch("root", ctx, 1, 3, lo=110, hi=220), resolve_pitch("fifth", ctx, 5, 3, lo=165, hi=330)
    tone = (np.sin(2 * np.pi * r * tt(n)) + 0.7 * np.sin(2 * np.pi * fifth * tt(n))) * env * 0.5
    st = _balance(noise / (np.max(np.abs(noise)) + 1e-9) * 0.8 + tone[:, None], c["pan"])
    return Voice(_finish(st, i, 20.0, 60.0), secs(p * dur))


def click(c: dict, ctx: Ctx) -> Voice:
    rng = dsp.rng_from(c["seed"], "click")
    i, b = c["intensity"], c["brightness"]
    n = secs(max(c["dur"], 0.09))
    f = resolve_pitch(c["pitch"], ctx, 1, 6) if c["pitch"] is not None else 1400.0 + 1000.0 * b
    t = tt(n)
    tone = np.sin(2 * np.pi * f * t) * dsp.exp_decay(n, 0.012)
    noise = _fit(dsp.bandpass(dsp.white(secs(0.03), rng), 2500, 7000) * dsp.exp_decay(secs(0.03), 0.0035), n)
    body = np.sin(2 * np.pi * 180.0 * t) * dsp.exp_decay(n, 0.02) * 0.35
    mono = 0.6 * tone + 0.5 * noise + body
    return Voice(_finish(dsp.pan_stereo(mono, c["pan"]), i, 0.1, 6.0), 0)


def tick(c: dict, ctx: Ctx) -> Voice:
    rng = dsp.rng_from(c["seed"], "tick")
    i, b = c["intensity"], c["brightness"]
    n = secs(max(c["dur"], 0.06))
    t = tt(n)
    noise = _fit(dsp.highpass(dsp.white(secs(0.02), rng), 3500) * dsp.exp_decay(secs(0.02), 0.005), n)
    tone = np.sin(2 * np.pi * (2600 + 1200 * b) * t) * dsp.exp_decay(n, 0.004)
    return Voice(_finish(dsp.pan_stereo(0.8 * noise + 0.4 * tone, c["pan"]), i, 0.05, 4.0), 0)


def pop(c: dict, ctx: Ctx) -> Voice:
    rng = dsp.rng_from(c["seed"], "pop")
    i, b = c["intensity"], c["brightness"]
    n = secs(max(c["dur"], 0.22))
    f = resolve_pitch(c["pitch"], ctx, 5, 5, lo=500.0, hi=1000.0)
    t = tt(n)
    fg = f * (0.75 + 0.25 * (1 - np.exp(-t / 0.012)))
    ph = dsp.sine_phase(fg)
    tone = (np.sin(ph) + 0.2 * np.sin(2 * ph)) * dsp.attack_decay(n, 0.002, 0.055)
    nz = _fit(dsp.bandpass(dsp.white(secs(0.02), rng), 1500, 5000) * dsp.exp_decay(secs(0.02), 0.006), n)
    return Voice(_finish(dsp.pan_stereo(tone + 0.15 * nz, c["pan"]), i, 0.1, 10.0), 0)


def snap(c: dict, ctx: Ctx) -> Voice:
    rng = dsp.rng_from(c["seed"], "snap")
    i, b = c["intensity"], c["brightness"]
    n = secs(max(c["dur"], 0.14))
    t = tt(n)
    noise = _fit(dsp.bandpass(dsp.white(secs(0.08), rng), 1500, 6000) * dsp.exp_decay(secs(0.08), 0.018), n)
    res = np.sin(2 * np.pi * (900 + 300 * b) * t) * dsp.exp_decay(n, 0.012) * 0.35
    tr = _fit(dsp.highpass(dsp.white(secs(0.006), rng), 3000) * dsp.exp_decay(secs(0.006), 0.002), n) * 0.5
    return Voice(_finish(dsp.pan_stereo(noise + res + tr, c["pan"]), i, 0.05, 10.0), 0)


def type_(c: dict, ctx: Ctx) -> Voice:
    rng = dsp.rng_from(c["seed"], "type")
    i = c["intensity"]
    n = secs(max(c["dur"], 0.06))
    t = tt(n)
    f_body = 170.0 + rng.uniform(-18, 18)
    noise = _fit(dsp.lowpass(dsp.white(secs(0.03), rng), 2800) * dsp.exp_decay(secs(0.03), 0.008), n)
    body = np.sin(2 * np.pi * f_body * t) * dsp.exp_decay(n, 0.014)
    lvl = 1.0 + rng.uniform(-0.12, 0.12)
    return Voice(_finish(dsp.pan_stereo((noise * 0.9 + body * 0.6) * lvl, c["pan"]), i, 0.05, 5.0), 0)


def blip(c: dict, ctx: Ctx) -> Voice:
    rng = dsp.rng_from(c["seed"], "blip")
    i, b = c["intensity"], c["brightness"]
    n = secs(max(c["dur"], 0.16))
    f = resolve_pitch(c["pitch"], ctx, 5, 5, lo=500.0, hi=1000.0)
    t = tt(n)
    tri = 2 * np.abs(2 * ((f * t) % 1.0) - 1.0) - 1.0
    tone = (0.7 * tri + 0.4 * np.sin(2 * np.pi * f * t)) * dsp.attack_decay(n, 0.001, 0.06)
    ck = _fit(dsp.highpass(dsp.white(secs(0.01), rng), 2500) * dsp.exp_decay(secs(0.01), 0.003), n) * 0.25
    return Voice(_finish(dsp.pan_stereo(tone + ck, c["pan"]), i, 0.1, 15.0), 0)


_BELL_RATIOS = (1.0, 2.0, 2.76, 5.4, 8.93)
_BELL_AMPS = (1.0, 0.5, 0.35, 0.18, 0.1)
_BELL_TAUS = (1.0, 0.6, 0.42, 0.24, 0.14)


def _bell(f0: float, n: int, tau: float, detune_cents: float = 0.0) -> np.ndarray:
    t = tt(n)
    out = np.zeros(n)
    k = 2.0 ** (detune_cents / 1200.0)
    for r, a, tf in zip(_BELL_RATIOS, _BELL_AMPS, _BELL_TAUS):
        fr = f0 * r * k
        if fr > SR * 0.45:
            continue
        out += a * np.sin(2 * np.pi * fr * t) * dsp.attack_decay(n, 0.001, tau * tf)
    return out


def chime(c: dict, ctx: Ctx) -> Voice:
    rng = dsp.rng_from(c["seed"], "chime")
    i, dur = c["intensity"], c["dur"]
    n = secs(dur + 0.4)
    f0 = resolve_pitch(c["pitch"], ctx, 3, 5, lo=520.0, hi=1100.0)
    st = np.stack([_bell(f0, n, dur * 0.55, -1.5), _bell(f0, n, dur * 0.55, 1.5)], axis=1)
    st = _balance(st, c["pan"])
    out = dsp.apply_reverb(st, dsp.reverb_ir(1.2, rng), wet=0.4)
    return Voice(_finish(out, i, 0.5, 80.0), 0)


def shimmer(c: dict, ctx: Ctx) -> Voice:
    rng = dsp.rng_from(c["seed"], "shimmer")
    i, b, dur = c["intensity"], c["brightness"], c["dur"]
    n = secs(dur + 0.6)
    k = 5 + int(round(3 * b))
    degrees = [1, 2, 3, 5, 6, 8, 9, 10]
    onsets = np.sort(rng.uniform(0.0, 0.22, k))
    onsets[0] = 0.0  # first note lands exactly on the cue
    acc = np.zeros((n, 2))
    for j, on in enumerate(onsets):
        deg = degrees[min(j + int(rng.integers(0, 2)), len(degrees) - 1)]
        f0 = dsp.scale_hz(ctx.key, ctx.mode, deg, 6)
        f0 = dsp.fold_into_range(f0, 1100.0, 2300.0)
        nn = secs(rng.uniform(0.45, 0.8))
        note = _bell(f0, nn, 0.35, 0.0) * (0.85 ** j)
        pan = float(np.clip(c["pan"] + rng.uniform(-0.6, 0.6), -1, 1))
        dsp.place(acc, dsp.pan_stereo(note, pan), secs(on))
    out = dsp.apply_reverb(acc, dsp.reverb_ir(1.5, rng), wet=0.5)
    return Voice(_finish(out, i, 0.3, 100.0), 0)


RECIPES = {
    "impact": impact, "thud": thud, "whoosh": whoosh, "riser": riser, "sweep": sweep,
    "swell": swell, "click": click, "tick": tick, "pop": pop, "snap": snap,
    "type": type_, "blip": blip, "chime": chime, "shimmer": shimmer,
}


import os as _os
SAMPLE_DIR: "Path | None" = Path(_os.environ["SFX_SAMPLES"]) if _os.environ.get("SFX_SAMPLES") else None
SAMPLE_TRIM_DB = -7.0  # общий запас для записанных сэмплов (они нормализованы к -1 dBFS)
_SAMPLE_CACHE: dict = {}


def _load_sample(name: str) -> np.ndarray:
    from scipy.io import wavfile
    if name not in _SAMPLE_CACHE:
        if SAMPLE_DIR is None:
            raise ValueError("cue uses a sample but no --samples folder was given")
        sr, a = wavfile.read(str(SAMPLE_DIR / name))
        if sr != SR:
            raise ValueError(f"sample {name}: {sr} Hz, expected {SR}")
        if a.dtype.kind == "i":
            a = a.astype(np.float64) / float(np.iinfo(a.dtype).max)
        a = a.astype(np.float64)
        if a.ndim == 1:
            a = np.stack([a, a], axis=1)
        _SAMPLE_CACHE[name] = a[:, :2]
    return _SAMPLE_CACHE[name]


def sample_voice(cue: dict) -> Voice:
    """Recorded sample: gain from intensity (+gainDb), constant-power pan, anchor at onset or loudness peak."""
    a = _load_sample(cue["sample"]).copy()
    g = float(cue["intensity"]) * 10 ** ((float(cue.get("gainDb", 0.0)) + SAMPLE_TRIM_DB) / 20.0)
    pan = float(cue["pan"])
    ang = (pan + 1.0) * np.pi / 4.0
    a[:, 0] *= g * np.cos(ang) * np.sqrt(2)
    a[:, 1] *= g * np.sin(ang) * np.sqrt(2)
    # Точка привязки — тем же детектором, которым её проверяет verify_sync (analyze.audible_offset).
    from . import dsp as _dsp
    m = _dsp.highpass(a.mean(axis=1), 120.0, 2)
    def env(ms):
        w = max(1, int(SR * ms / 1000.0))
        return np.convolve(np.abs(m), np.ones(w) / w, mode="same")
    if cue["anchor"] == "peak":
        anchor = int(np.argmax(env(25.0)))
    elif cue["anchor"] == "end":
        e = env(5.0)
        anchor = int(np.nonzero(e >= 0.5 * float(e.max()))[0][-1])
    else:
        e = env(1.0)
        on = int(np.argmax(e >= 0.10 * float(e.max())))
        cut = max(0, on - int(0.004 * SR))  # убрать тихий хвост до атаки
        a, e = a[cut:], e[cut:]
        head = e[: int(0.15 * SR)]
        anchor = int(np.argmax(head >= 0.10 * float(head.max())))
    return Voice(a, min(anchor, len(a) - 1))


def render_cue(cue: dict, ctx: Ctx) -> Voice:
    if cue.get("sample"):
        return sample_voice(cue)
    try:
        recipe = RECIPES[cue["kind"]]
    except KeyError as e:
        raise ValueError(f"no recipe for cue kind {cue['kind']!r}") from e
    v = recipe(cue, ctx)
    assert v.audio.ndim == 2 and v.audio.shape[1] == 2, cue["id"]
    assert 0 <= v.anchor < len(v.audio), f"{cue['id']}: anchor {v.anchor} outside {len(v.audio)}"
    return v
