/**
 * spring.ts — closed-form damped-spring step response.
 *
 * Why closed-form: it is stateless (value = f(time)), so any frame can be
 * rendered independently — required for Remotion's parallel rendering and for
 * deterministic sound sync (we can ask *when* a spring first arrives or peaks).
 *
 * NOTE: parameter names (mass / stiffness / damping) match Remotion's spring(),
 * but values are NOT bit-identical to Remotion's numerical simulation. Differences
 * are visually negligible; do not mix the two on the same property.
 */

export interface SpringConfig {
  mass: number;
  stiffness: number;
  damping: number;
}

/** Damping ratio ζ. <1 overshoots, =1 critically damped, >1 sluggish. */
export const dampingRatio = (c: SpringConfig): number =>
  c.damping / (2 * Math.sqrt(c.stiffness * c.mass));

/** Natural frequency ω0 in rad/s. */
export const naturalFrequency = (c: SpringConfig): number =>
  Math.sqrt(c.stiffness / c.mass);

/**
 * Presets chosen by *behaviour*. ζ is noted so the intent is checkable.
 * Default to crisp/smooth for UI & editorial work; use poppy sparingly.
 */
export const springs = {
  /** ζ≈0.93 — fast, almost no overshoot. UI state changes. */
  crisp: { mass: 1, stiffness: 260, damping: 30 },
  /** ζ≈0.88 — fast with a hair of overshoot. Cards, chips, toggles. */
  snappy: { mass: 1, stiffness: 220, damping: 26 },
  /** ζ=1.0 — critically damped. Camera, large layout moves, editorial type. */
  smooth: { mass: 1, stiffness: 120, damping: 22 },
  /** ζ≈1.03 — slow settle. Backgrounds, parallax layers. */
  gentle: { mass: 1, stiffness: 60, damping: 16 },
  /** ζ≈0.62 — visible overshoot (~8%). Rare accent: logo pop, success check. */
  poppy: { mass: 1, stiffness: 260, damping: 20 },
  /** ζ≈1.1 — heavy object landing without bounce. Impact words, platforms. */
  heavy: { mass: 2, stiffness: 200, damping: 44 },
} as const satisfies Record<string, SpringConfig>;

export type SpringName = keyof typeof springs;
export type SpringLike = SpringConfig | SpringName;

export const resolveSpring = (s: SpringLike | undefined): SpringConfig =>
  s === undefined ? springs.smooth : typeof s === 'string' ? springs[s] : s;

/** Unit step response x(t): 0 -> 1. t in seconds. Returns 0 for t<=0. */
export function springAt(tSec: number, cfg: SpringConfig): number {
  if (tSec <= 0) return 0;
  const w0 = naturalFrequency(cfg);
  const z = dampingRatio(cfg);
  if (z < 1 - 1e-6) {
    const wd = w0 * Math.sqrt(1 - z * z);
    const decay = Math.exp(-z * w0 * tSec);
    return 1 - decay * (Math.cos(wd * tSec) + ((z * w0) / wd) * Math.sin(wd * tSec));
  }
  if (z <= 1 + 1e-6) {
    return 1 - Math.exp(-w0 * tSec) * (1 + w0 * tSec);
  }
  const root = Math.sqrt(z * z - 1);
  const s1 = -w0 * (z - root);
  const s2 = -w0 * (z + root);
  return 1 - (s2 * Math.exp(s1 * tSec) - s1 * Math.exp(s2 * tSec)) / (s2 - s1);
}

/** Spring progress for a frame. `delay` in frames. */
export function spring01(
  frame: number,
  fps: number,
  s?: SpringLike,
  delay = 0,
): number {
  return springAt((frame - delay) / fps, resolveSpring(s));
}

/** Convenience: from -> to. */
export function springFromTo(
  frame: number,
  fps: number,
  from: number,
  to: number,
  s?: SpringLike,
  delay = 0,
): number {
  return from + (to - from) * spring01(frame, fps, s, delay);
}

/** dx/dt in 1/s (numeric central difference). */
export function springVelocity(tSec: number, cfg: SpringConfig): number {
  const h = 1 / 2000;
  return (springAt(tSec + h, cfg) - springAt(tSec - h, cfg)) / (2 * h);
}

export interface SpringTiming {
  /** first time (s) the value reaches `arrive` of the way (default 0.98) */
  arrival: number;
  /** time of the first peak (underdamped) — equals arrival when no overshoot */
  peakTime: number;
  /** max value reached (1 + overshoot) */
  peakValue: number;
  /** time (s) after which |x-1| stays below `eps` */
  settle: number;
  /** time (s) of maximum |velocity| — where a "whoosh" should peak */
  peakVelocityTime: number;
}

/** Numeric timing facts about a spring; used to place sound cues on motion. */
export function springTiming(
  cfg: SpringConfig,
  opts: { arrive?: number; eps?: number } = {},
): SpringTiming {
  const arrive = opts.arrive ?? 0.98;
  const eps = opts.eps ?? 0.01;
  const dt = 1 / 1000;
  const horizon = 12;
  let arrival = -1;
  let peakTime = 0;
  let peakValue = 0;
  let settle = 0;
  let peakVel = 0;
  let peakVelTime = 0;
  for (let t = 0; t <= horizon; t += dt) {
    const x = springAt(t, cfg);
    if (arrival < 0 && x >= arrive) arrival = t;
    if (x > peakValue) {
      peakValue = x;
      peakTime = t;
    }
    if (Math.abs(x - 1) > eps) settle = t;
    const v = Math.abs(springVelocity(t, cfg));
    if (v > peakVel) {
      peakVel = v;
      peakVelTime = t;
    }
  }
  return {
    arrival: arrival < 0 ? horizon : arrival,
    peakTime,
    peakValue,
    settle,
    peakVelocityTime: peakVelTime,
  };
}

/**
 * springTrack — value of a property driven by a *sequence of target changes*,
 * each one launching its own spring from the previous target. Step responses
 * superpose linearly, so overlapping changes blend naturally (the technique used
 * by good UI-morph work: retargeting mid-flight never "snaps").
 */
export interface TrackStep {
  /** frame at which the target changes */
  at: number;
  to: number;
  spring?: SpringLike;
}
export function springTrack(
  frame: number,
  fps: number,
  from: number,
  steps: readonly TrackStep[],
  defaultSpring?: SpringLike,
): number {
  let value = from;
  let prev = from;
  for (const step of steps) {
    const delta = step.to - prev;
    value += delta * springAt((frame - step.at) / fps, resolveSpring(step.spring ?? defaultSpring));
    prev = step.to;
  }
  return value;
}
