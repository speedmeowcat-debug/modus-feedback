"""dsp.py — small, dependency-light DSP toolbox (numpy + scipy only).

Everything is deterministic: pass an explicit numpy Generator (see `rng_from`).
Audio buffers are float64 arrays, mono shape (n,) or stereo shape (n, 2).
"""
from __future__ import annotations

import re

import numpy as np
from scipy import signal
from scipy.ndimage import minimum_filter1d, uniform_filter1d

SR = 48000  # all frame rates used by the Skill (24/25/30/48/50/60) divide 48000 evenly

# ----------------------------------------------------------------------------- pitch

_PC = {"C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5, "F#": 6,
       "Gb": 6, "G": 7, "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11}

SCALES = {
    "minor": [0, 2, 3, 5, 7, 8, 10],
    "major": [0, 2, 4, 5, 7, 9, 11],
    "dorian": [0, 2, 3, 5, 7, 9, 10],
    "lydian": [0, 2, 4, 6, 7, 9, 11],
    "phrygian": [0, 1, 3, 5, 7, 8, 10],
    "mixolydian": [0, 2, 4, 5, 7, 9, 10],
}


def midi_to_hz(m: float) -> float:
    return 440.0 * 2.0 ** ((m - 69.0) / 12.0)


def note_to_midi(name: str) -> int:
    m = re.fullmatch(r"([A-Ga-g][#b]?)(-?\d+)", name.strip())
    if not m:
        raise ValueError(f"bad note name {name!r}")
    pc = m.group(1)[0].upper() + m.group(1)[1:]
    if pc not in _PC:
        raise ValueError(f"bad pitch class in {name!r}")
    return 12 * (int(m.group(2)) + 1) + _PC[pc]


def note_to_hz(name: str) -> float:
    return midi_to_hz(note_to_midi(name))


def scale_midi(key: str, mode: str, degree: int, octave: int) -> int:
    """MIDI note of a 1-based scale `degree` (can exceed 7 / be < 1) at `octave`
    (octave refers to the tonic's octave: degree 1 -> tonic at that octave)."""
    steps = SCALES[mode]
    idx = degree - 1
    octs, step = divmod(idx, 7)
    return 12 * (octave + 1) + _PC[key] + steps[step] + 12 * octs


def scale_hz(key: str, mode: str, degree: int, octave: int) -> float:
    return midi_to_hz(scale_midi(key, mode, degree, octave))


def chord_midis(key: str, mode: str, degree: int, octave: int, seventh: bool = True) -> list[int]:
    """Diatonic chord stacked in thirds on a scale degree (triad, optionally + 7th)."""
    offs = [0, 2, 4] + ([6] if seventh else [])
    return [scale_midi(key, mode, degree + o, octave) for o in offs]


def fold_into_range(hz: float, lo: float, hi: float) -> float:
    """Octave-shift `hz` into [lo, hi) (hi should be >= 2*lo)."""
    while hz < lo:
        hz *= 2.0
    while hz >= hi:
        hz /= 2.0
    return hz


# ----------------------------------------------------------------------------- basics

def rng_from(seed: int, salt: str = "") -> np.random.Generator:
    h = (seed * 2654435761 + sum(ord(c) * (i + 1) for i, c in enumerate(salt))) % (2**32)
    return np.random.default_rng(h)


def db2lin(db: float) -> float:
    return 10.0 ** (db / 20.0)


def lin2db(x: float) -> float:
    return 20.0 * np.log10(max(x, 1e-12))


def tt(n: int) -> np.ndarray:
    return np.arange(n) / SR


def secs(s: float) -> int:
    return int(round(s * SR))


def exp_decay(n: int, tau: float) -> np.ndarray:
    return np.exp(-tt(n) / max(tau, 1e-6))


def attack_decay(n: int, attack: float, tau: float) -> np.ndarray:
    """Linear-ish attack (cosine, click-free) then exponential decay."""
    env = exp_decay(n, tau)
    na = min(n, max(1, secs(attack)))
    env[:na] *= 0.5 - 0.5 * np.cos(np.pi * np.arange(na) / na)
    return env


def adsr(n: int, a: float, d: float, s: float, r: float) -> np.ndarray:
    """ADSR where the note-off happens `r` seconds before the end of the buffer."""
    na, nd, nr = secs(a), secs(d), secs(r)
    nr = min(nr, n)
    ns = max(0, n - na - nd - nr)
    env = np.concatenate([
        np.linspace(0, 1, max(na, 1), endpoint=False),
        np.linspace(1, s, max(nd, 1), endpoint=False),
        np.full(ns, s),
        np.linspace(s, 0, max(nr, 1)),
    ])
    if len(env) < n:
        env = np.pad(env, (0, n - len(env)))
    return env[:n]


def fade(x: np.ndarray, fade_in: float = 0.0, fade_out: float = 0.0) -> np.ndarray:
    y = x.copy()
    n = len(y)
    ni, no = min(secs(fade_in), n), min(secs(fade_out), n)
    if ni:
        ramp = 0.5 - 0.5 * np.cos(np.pi * np.arange(ni) / ni)
        y[:ni] *= ramp[:, None] if y.ndim == 2 else ramp
    if no:
        ramp = 0.5 + 0.5 * np.cos(np.pi * np.arange(no) / no)
        y[n - no:] *= ramp[:, None] if y.ndim == 2 else ramp
    return y


def white(n: int, rng: np.random.Generator) -> np.ndarray:
    return rng.standard_normal(n)


def pink(n: int, rng: np.random.Generator) -> np.ndarray:
    """1/f noise by spectral shaping."""
    spec = np.fft.rfft(rng.standard_normal(n))
    f = np.arange(len(spec), dtype=float)
    f[0] = 1.0
    spec /= np.sqrt(f)
    out = np.fft.irfft(spec, n)
    return out / (np.max(np.abs(out)) + 1e-12)


def _sos(kind: str, fc, order: int):
    return signal.butter(order, fc, btype=kind, fs=SR, output="sos")


def lowpass(x, fc: float, order: int = 2):
    return signal.sosfilt(_sos("low", min(fc, SR * 0.45), order), x, axis=0)


def highpass(x, fc: float, order: int = 2):
    return signal.sosfilt(_sos("high", max(fc, 5.0), order), x, axis=0)


def bandpass(x, lo: float, hi: float, order: int = 2):
    return signal.sosfilt(_sos("band", [max(lo, 5.0), min(hi, SR * 0.45)], order), x, axis=0)


def peak_norm(x: np.ndarray, peak: float = 1.0) -> np.ndarray:
    m = float(np.max(np.abs(x)))
    return x if m < 1e-12 else x * (peak / m)


def pan_stereo(mono: np.ndarray, pan: float) -> np.ndarray:
    """Constant-power pan, pan in [-1, 1]."""
    a = (pan + 1.0) * np.pi / 4.0
    return np.stack([mono * np.cos(a), mono * np.sin(a)], axis=1)


def to_stereo(x: np.ndarray) -> np.ndarray:
    return x if x.ndim == 2 else np.stack([x, x], axis=1)


def sine_phase(freq_curve: np.ndarray) -> np.ndarray:
    return 2.0 * np.pi * np.cumsum(freq_curve) / SR


def saw_additive(freq: float, n: int, max_harm: int = 40, phase0: float = 0.0) -> np.ndarray:
    """Band-limited saw by additive synthesis (alias-free for fixed pitch)."""
    t = tt(n)
    k = int(min(max_harm, (SR * 0.45) // max(freq, 1.0)))
    out = np.zeros(n)
    for h in range(1, max(k, 1) + 1):
        out += np.sin(2 * np.pi * freq * h * t + phase0 * h) / h
    return out * (2.0 / np.pi)


def swept_noise(n: int, fc_curve: np.ndarray, bw_octaves: float, rng: np.random.Generator,
                nperseg: int = 1024) -> np.ndarray:
    """White noise filtered by a band whose centre follows `fc_curve` (Hz, length n).
    STFT masking: smooth, click-free, deterministic."""
    x = white(n, rng)
    f, t_, Z = signal.stft(x, fs=SR, nperseg=nperseg, noverlap=nperseg * 3 // 4, boundary="zeros")
    centers = np.interp(t_ * SR, np.arange(n), fc_curve)
    f_safe = np.maximum(f, 20.0)[:, None]
    mask = np.exp(-0.5 * (np.log2(f_safe / centers[None, :]) / max(bw_octaves, 0.05)) ** 2)
    _, y = signal.istft(Z * mask, fs=SR, nperseg=nperseg, noverlap=nperseg * 3 // 4,
                        boundary=True)
    y = y[:n] if len(y) >= n else np.pad(y, (0, n - len(y)))
    return y


# ----------------------------------------------------------------------------- space

def reverb_ir(rt60: float, rng: np.random.Generator, predelay: float = 0.012,
              damping_hz: float = 6500.0, width: float = 1.0) -> np.ndarray:
    """Synthetic stereo room: exponentially decaying, progressively darker noise."""
    n = secs(rt60 * 1.15 + predelay)
    t = tt(n)
    env = 10.0 ** (-3.0 * t / rt60)  # -60 dB at rt60
    env[: secs(predelay)] = 0.0
    chans = []
    for _ in range(2):
        noise = rng.standard_normal(n) * env
        # darken over time: crossfade between bright and dark versions
        dark = lowpass(noise, damping_hz * 0.35, 2)
        mix = np.clip(t / rt60, 0, 1)
        ch = noise * (1 - mix) + dark * mix
        chans.append(lowpass(ch, damping_hz, 2))
    ir = np.stack(chans, axis=1)
    if width < 1.0:
        mid = ir.mean(axis=1, keepdims=True)
        ir = mid + (ir - mid) * width
    return ir / (np.sqrt(np.sum(ir ** 2)) + 1e-12)


def apply_reverb(x: np.ndarray, ir: np.ndarray, wet: float) -> np.ndarray:
    """x stereo (n,2) -> stereo with tail appended; dry path preserved at unity.
    The IR has unit energy, so `wet` is an AMPLITUDE ratio: wet-path energy ~= wet^2 x dry
    energy for noise-like input (0.25 ~ -12 dB, 0.5 ~ -6 dB). Impulsive sounds show a
    much lower wet PEAK than dry — by design, the dry transient stays on the cue frame."""
    x = to_stereo(x)
    n_out = len(x) + len(ir) - 1
    out = np.zeros((n_out, 2))
    out[: len(x)] += x
    for ch in range(2):
        out[:, ch] += wet * signal.fftconvolve(x[:, ch], ir[:, ch])
    return out


def place(buf: np.ndarray, snd: np.ndarray, start: int, gain: float = 1.0) -> int:
    """Add `snd` into `buf` at sample `start` (may be negative = head cropped).
    Returns number of samples cropped from the head."""
    cropped = 0
    if snd.ndim == 1 and buf.ndim == 2:
        snd = snd[:, None]  # mono onto a stereo bus: same signal in both channels
    if start < 0:
        cropped = -start
        snd = snd[cropped:]
        start = 0
    if len(snd) == 0 or start >= len(buf):
        return cropped
    end = min(len(buf), start + len(snd))
    buf[start:end] += snd[: end - start] * gain
    return cropped


# ----------------------------------------------------------------------------- loudness (ITU-R BS.1770-4)

# K-weighting biquads for 48 kHz (from the standard)
_K1_B = np.array([1.53512485958697, -2.69169618940638, 1.19839281085285])
_K1_A = np.array([1.0, -1.69065929318241, 0.73248077421585])
_K2_B = np.array([1.0, -2.0, 1.0])
_K2_A = np.array([1.0, -1.99004745483398, 0.99007225036621])


def integrated_lufs(x: np.ndarray) -> float:
    """Integrated loudness (LUFS) with absolute (-70) and relative (-10 LU) gating."""
    x = to_stereo(x)
    y = signal.lfilter(_K2_B, _K2_A, signal.lfilter(_K1_B, _K1_A, x, axis=0), axis=0)
    block, hop = int(0.4 * SR), int(0.1 * SR)
    if len(y) < block:
        pad = np.zeros((block - len(y), 2))
        y = np.vstack([y, pad])
    nblocks = 1 + (len(y) - block) // hop
    z = np.empty(nblocks)
    for i in range(nblocks):
        seg = y[i * hop: i * hop + block]
        z[i] = np.sum(np.mean(seg ** 2, axis=0))  # channel weights 1.0 for L/R
    lk = -0.691 + 10 * np.log10(np.maximum(z, 1e-12))
    abs_idx = lk > -70.0
    if not np.any(abs_idx):
        return -70.0
    rel_thr = -0.691 + 10 * np.log10(np.mean(z[abs_idx])) - 10.0
    gate = abs_idx & (lk > rel_thr)
    if not np.any(gate):
        return -70.0
    return float(-0.691 + 10 * np.log10(np.mean(z[gate])))


def true_peak_db(x: np.ndarray, oversample: int = 4) -> float:
    x = to_stereo(x)
    up = signal.resample_poly(x, oversample, 1, axis=0)
    return lin2db(float(np.max(np.abs(up))))


def limiter(x: np.ndarray, ceiling_db: float, lookahead_ms: float = 3.0,
            release_ms: float = 90.0) -> np.ndarray:
    """Lookahead peak limiter. Gain reduction ramps in *before* each peak."""
    x = to_stereo(x)
    ceil = db2lin(ceiling_db)
    peak = np.max(np.abs(x), axis=1)
    need = np.minimum(1.0, ceil / np.maximum(peak, 1e-12))
    la = max(1, int(SR * lookahead_ms / 1000.0))
    g = minimum_filter1d(need, size=2 * la + 1, mode="nearest")
    g = uniform_filter1d(g, size=la, mode="nearest")  # attack ramp
    # release: one-pole smoothing that can only rise slowly
    rel = np.exp(-1.0 / (SR * release_ms / 1000.0))
    out = np.empty_like(g)
    cur = 1.0
    for i, v in enumerate(g):  # sequential by nature
        cur = v if v < cur else rel * cur + (1 - rel) * v
        out[i] = cur
    out = np.minimum(out, g)  # never exceed what the lookahead demanded
    return x * out[:, None]
