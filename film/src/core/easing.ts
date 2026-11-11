/**
 * easing.ts — pure easing + interpolation helpers (no Remotion / React imports).
 * Everything here is a deterministic function of its inputs, so it renders
 * identically in Remotion, in the QA harness, and in unit tests.
 */

export type EasingFn = (t: number) => number;

export const clamp = (v: number, lo = 0, hi = 1): number =>
  Math.min(hi, Math.max(lo, v));

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const invLerp = (a: number, b: number, v: number): number =>
  a === b ? 0 : (v - a) / (b - a);

/** CSS-style cubic-bezier(x1, y1, x2, y2). Newton-Raphson with bisection fallback. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): EasingFn {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;

  const sampleX = (t: number): number => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number): number => ((ay * t + by) * t + cy) * t;
  const sampleDX = (t: number): number => (3 * ax * t + 2 * bx) * t + cx;

  const solveX = (x: number): number => {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const err = sampleX(t) - x;
      if (Math.abs(err) < 1e-7) return t;
      const d = sampleDX(t);
      if (Math.abs(d) < 1e-7) break;
      t -= err / d;
    }
    let lo = 0;
    let hi = 1;
    t = x;
    for (let i = 0; i < 40; i++) {
      const err = sampleX(t) - x;
      if (Math.abs(err) < 1e-7) return t;
      if (err > 0) hi = t;
      else lo = t;
      t = (lo + hi) / 2;
    }
    return t;
  };

  return (x: number): number => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    return sampleY(solveX(x));
  };
}

const outBack = (overshoot = 1.70158): EasingFn => (t) => {
  const c3 = overshoot + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + overshoot * Math.pow(t - 1, 2);
};

/**
 * Named easing tokens. Pick by *intent*, not by name aesthetics:
 *  - enter  -> decelerating (outX): element arrives and settles
 *  - exit   -> accelerating (inX): element leaves, does not linger
 *  - move   -> inOutX: element travels between two resting states
 */
export const ease = {
  linear: (t: number) => t,
  standard: cubicBezier(0.4, 0, 0.2, 1),
  emphasized: cubicBezier(0.2, 0, 0, 1),
  emphasizedIn: cubicBezier(0.3, 0, 0.8, 0.15),
  snapOut: cubicBezier(0.16, 1, 0.3, 1),
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  inCubic: (t: number) => t * t * t,
  inOutCubic: (t: number) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  outQuart: (t: number) => 1 - Math.pow(1 - t, 4),
  inQuart: (t: number) => t * t * t * t,
  inOutQuart: (t: number) =>
    t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2,
  outExpo: (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inExpo: (t: number) => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
  inOutExpo: (t: number) =>
    t <= 0
      ? 0
      : t >= 1
        ? 1
        : t < 0.5
          ? Math.pow(2, 20 * t - 10) / 2
          : (2 - Math.pow(2, -20 * t + 10)) / 2,
  inOutSine: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,
  outBack: outBack(),
  outBackSoft: outBack(0.9),
} as const satisfies Record<string, EasingFn>;

export type EaseName = keyof typeof ease;
export type EaseLike = EasingFn | EaseName;

export const resolveEase = (e: EaseLike | undefined): EasingFn =>
  e === undefined ? ease.linear : typeof e === 'function' ? e : ease[e];

/**
 * remap(v, [a,b], [c,d], ease) — like Remotion's interpolate() for one segment,
 * clamped on both sides by default.
 */
export function remap(
  v: number,
  inRange: readonly [number, number],
  outRange: readonly [number, number],
  e?: EaseLike,
  clampOutput = true,
): number {
  let t = invLerp(inRange[0], inRange[1], v);
  if (clampOutput) t = clamp(t);
  return lerp(outRange[0], outRange[1], resolveEase(e)(t));
}

/** Progress 0..1 of `frame` inside [start, start + dur], eased and clamped. */
export function progress(
  frame: number,
  start: number,
  dur: number,
  e?: EaseLike,
): number {
  if (dur <= 0) return frame >= start ? 1 : 0;
  return resolveEase(e)(clamp((frame - start) / dur));
}

/** Multi-segment keyframe interpolation. keys must be sorted by `at` (frames). */
export interface Key {
  at: number;
  v: number;
  /** easing of the segment that ENDS at this key */
  ease?: EaseLike;
}
export function keyframes(frame: number, keys: readonly Key[]): number {
  if (keys.length === 0) return 0;
  const first = keys[0];
  const last = keys[keys.length - 1];
  if (first === undefined || last === undefined) return 0;
  if (frame <= first.at) return first.v;
  if (frame >= last.at) return last.v;
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1];
    const b = keys[i];
    if (a === undefined || b === undefined) continue;
    if (frame <= b.at) {
      const t = clamp(invLerp(a.at, b.at, frame));
      return lerp(a.v, b.v, resolveEase(b.ease)(t));
    }
  }
  return last.v;
}

/** Delay for item i of n. 'center' fans outward from the middle, 'edges' inward. */
export function staggerDelay(
  i: number,
  n: number,
  step: number,
  mode: 'forward' | 'reverse' | 'center' | 'edges' = 'forward',
): number {
  switch (mode) {
    case 'reverse':
      return (n - 1 - i) * step;
    case 'center':
      return Math.abs(i - (n - 1) / 2) * step;
    case 'edges': {
      const mid = (n - 1) / 2;
      return (mid - Math.abs(i - mid)) * step;
    }
    default:
      return i * step;
  }
}
