/**
 * timeline.ts — the single source of truth shared by ANIMATION and SOUND.
 *
 * A composition declares its named moments and sound cues here. The scene reads
 * frames from the timeline to trigger motion; the sound engine reads the same
 * timeline (exported as JSON) to synthesise and place audio. Because both derive
 * from one object, a sound can never drift from the moment it scores, and no
 * sound exists without a visual event ("scores") — that is what removes
 * "random SFX dropped in afterwards".
 *
 * Pure TypeScript: no Remotion/React imports.
 */

import { hashString } from './random';
import {
  springTiming,
  type SpringLike,
  resolveSpring,
} from './spring';
import { progress, resolveEase, type EaseLike } from './easing';

export const CUE_KINDS = [
  'impact', // heavy landing / title slam: sub drop + transient + tail
  'thud', // small body hit: object settles on a surface
  'whoosh', // fast move / camera move: filtered-noise sweep
  'riser', // tension build ending at a moment (anchor: end)
  'sweep', // short tonal sweep: reveal, wipe
  'swell', // soft swell: scene breathing, light pass
  'click', // UI press
  'tick', // tiny UI/typing step
  'pop', // element appears / toggles on
  'snap', // crisp snap: hard cut, shape locks
  'type', // keystroke
  'blip', // UI value change (pitched)
  'chime', // success / resolve (pitched, tuned to key)
  'shimmer', // sparkle tail on reveals (pitched, tuned to key)
] as const;
export type CueKind = (typeof CUE_KINDS)[number];

export type Anchor = 'start' | 'peak' | 'end';

/** 'root' | 'third' | 'fifth' | 'octave' | note name like 'C#4' | frequency in Hz */
export type PitchSpec = string | number;

export interface CueInput {
  id: string;
  kind: CueKind;
  /** The visual frame this sound is bound to (integer). */
  frame: number;
  /** REQUIRED: the visual event this sound scores, in plain words. */
  scores: string;
  /** Length of the motion/sound span in seconds (whoosh/riser/swell/sweep). */
  dur?: number;
  /** 0..1. Map to the visual's scale/energy, not to taste. */
  intensity?: number;
  /** -1 (left) .. 1 (right). Match the visual's screen position. */
  pan?: number;
  pitch?: PitchSpec;
  /** Which point of the sound lands exactly on `frame`. */
  anchor?: Anchor;
  /** For whoosh/swell: loudness peak position inside `dur` (0..1). */
  peak?: number;
  /** 0 dark .. 1 bright. Map to visual brightness/size (small+bright, big+dark). */
  brightness?: number;
  /** Optional recorded sample (file name inside the samples folder). Replaces the synth recipe. */
  sample?: string;
  /** Extra gain for a sample, dB. */
  gainDb?: number;
}

export interface ResolvedCue {
  id: string;
  kind: CueKind;
  frame: number;
  t: number;
  scores: string;
  dur: number;
  intensity: number;
  pan: number;
  pitch: PitchSpec | null;
  anchor: Anchor;
  peak: number;
  brightness: number;
  seed: number;
  sample?: string;
  gainDb?: number;
}

const KIND_DEFAULTS: Record<
  CueKind,
  { anchor: Anchor; dur: number; intensity: number; brightness: number }
> = {
  impact: { anchor: 'start', dur: 1.4, intensity: 0.8, brightness: 0.35 },
  thud: { anchor: 'start', dur: 0.45, intensity: 0.6, brightness: 0.3 },
  whoosh: { anchor: 'peak', dur: 0.5, intensity: 0.6, brightness: 0.55 },
  riser: { anchor: 'end', dur: 2.0, intensity: 0.7, brightness: 0.6 },
  sweep: { anchor: 'peak', dur: 0.7, intensity: 0.5, brightness: 0.6 },
  swell: { anchor: 'peak', dur: 1.5, intensity: 0.4, brightness: 0.4 },
  click: { anchor: 'start', dur: 0.09, intensity: 0.55, brightness: 0.55 },
  tick: { anchor: 'start', dur: 0.05, intensity: 0.4, brightness: 0.7 },
  pop: { anchor: 'start', dur: 0.2, intensity: 0.55, brightness: 0.6 },
  snap: { anchor: 'start', dur: 0.12, intensity: 0.65, brightness: 0.7 },
  type: { anchor: 'start', dur: 0.06, intensity: 0.35, brightness: 0.6 },
  blip: { anchor: 'start', dur: 0.16, intensity: 0.45, brightness: 0.65 },
  chime: { anchor: 'start', dur: 1.3, intensity: 0.55, brightness: 0.7 },
  shimmer: { anchor: 'start', dur: 1.6, intensity: 0.4, brightness: 0.8 },
};

export type Mode = 'minor' | 'major' | 'dorian' | 'lydian' | 'phrygian' | 'mixolydian';

export interface MusicSpec {
  bpm: number;
  /** pitch class: 'A', 'C#', 'Eb' ... */
  key: string;
  mode: Mode;
  /** frame at which bar 1 beat 1 sounds (default 0) */
  startFrame?: number;
  bars: number;
  /** scale degrees (1-based), one per bar, cycled */
  progression: number[];
  /** layer gains 0..1; missing/0 = layer off */
  layers: {
    pad?: number;
    bass?: number;
    arp?: number;
    kick?: number;
    hat?: number;
    clap?: number;
    pulse?: number;
  };
  /** piecewise-constant energy multiplier per bar index (0-based) — the arrangement */
  arc?: Array<{ bar: number; energy: number }>;
  swing?: number;
  seed?: number;
}

export interface MixSpec {
  /** integrated loudness target (LUFS). Social/web default -14. */
  targetLufs?: number;
  /** ceiling in dBTP */
  truePeakDb?: number;
  /** music bus trim before ducking (dB) */
  musicDb?: number;
  /** sfx bus trim (dB) */
  sfxDb?: number;
  duck?: { depthDb: number; attackMs: number; releaseMs: number };
  /** fade the master in/out (seconds) */
  fadeIn?: number;
  fadeOut?: number;
}

export interface TimelineSpec {
  id: string;
  fps: number;
  width: number;
  height: number;
  durationInFrames: number;
  music?: MusicSpec;
  mix?: MixSpec;
}

export interface TimelineExport {
  version: 1;
  spec: Omit<TimelineSpec, 'music' | 'mix'>;
  music: MusicSpec | null;
  mix: MixSpec | null;
  /** frames per beat (may be fractional) or null without music */
  beatFrames: number | null;
  events: Record<string, number>;
  cues: ResolvedCue[];
  /** declared intentional holds [from,to] frames — QA ignores "no motion" inside */
  holds: Array<{ id: string; from: number; to: number }>;
  /** declared hard cuts — QA ignores the expected frame-difference spike */
  cuts: Array<{ id: string; frame: number }>;
}

const NOTE_PC: Record<string, number> = {
  C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6,
  G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11,
};

/** Validate a key name early (throws), so typos fail in TS not in Python. */
export function assertKey(key: string): void {
  if (!(key in NOTE_PC)) throw new Error(`Unknown key "${key}"`);
}

/** BPMs for which one beat is a whole number of frames (beat grid == frame grid). */
export function frameLockedBpms(
  fps: number,
  min = 70,
  max = 170,
): Array<{ bpm: number; beatFrames: number; roundBpm: boolean }> {
  const out: Array<{ bpm: number; beatFrames: number; roundBpm: boolean }> = [];
  for (let k = 1; k <= 400; k++) {
    const bpm = (60 * fps) / k;
    if (bpm >= min && bpm <= max) {
      out.push({ bpm, beatFrames: k, roundBpm: Math.abs(bpm - Math.round(bpm)) < 1e-9 });
    }
  }
  return out.sort((a, b) => a.bpm - b.bpm);
}

export function createTimeline(spec: TimelineSpec) {
  if (!Number.isInteger(spec.fps) || spec.fps <= 0) throw new Error('fps must be a positive integer');
  if (!Number.isInteger(spec.durationInFrames) || spec.durationInFrames <= 0)
    throw new Error('durationInFrames must be a positive integer');
  if (spec.music) assertKey(spec.music.key);

  const fps = spec.fps;
  const startFrame = spec.music?.startFrame ?? 0;
  const beatFrames = spec.music ? (60 / spec.music.bpm) * fps : null;
  const events = new Map<string, number>();
  const cues: ResolvedCue[] = [];
  const holds: Array<{ id: string; from: number; to: number }> = [];
  const cuts: Array<{ id: string; frame: number }> = [];

  const checkFrame = (frame: number, what: string): number => {
    if (!Number.isInteger(frame)) throw new Error(`${what}: frame must be an integer, got ${frame}`);
    if (frame < 0 || frame > spec.durationInFrames)
      throw new Error(`${what}: frame ${frame} outside 0..${spec.durationInFrames}`);
    return frame;
  };

  const api = {
    spec,
    fps,
    beatFrames,
    /** true when a beat is a whole number of frames — recommended */
    beatsAreFrameLocked: beatFrames !== null && Math.abs(beatFrames - Math.round(beatFrames)) < 1e-9,

    sec: (frame: number): number => frame / fps,
    frame: (sec: number): number => Math.round(sec * fps),

    /** Frame of beat n (0-based, may be fractional e.g. 1.5 = the "and" of beat 2). */
    beat(n: number): number {
      if (beatFrames === null) throw new Error('beat(): timeline has no music spec');
      return Math.round(startFrame + n * beatFrames);
    },
    /** Frame of bar n (0-based, 4 beats per bar). */
    bar(n: number): number {
      return api.beat(n * 4);
    },

    /** Register a named moment the scene can read back with at(). */
    event(id: string, frame: number): number {
      checkFrame(frame, `event ${id}`);
      if (events.has(id)) throw new Error(`Duplicate event id "${id}"`);
      events.set(id, frame);
      return frame;
    },
    /** Read a named moment. */
    at(id: string): number {
      const f = events.get(id);
      if (f === undefined) throw new Error(`Unknown event "${id}"`);
      return f;
    },

    /** Register a sound cue bound to a visual frame. Returns the frame. */
    cue(input: CueInput): number {
      checkFrame(input.frame, `cue ${input.id}`);
      if (!input.scores || input.scores.trim().length < 3)
        throw new Error(`cue ${input.id}: "scores" must describe the visual event it scores`);
      if (!(CUE_KINDS as readonly string[]).includes(input.kind))
        throw new Error(`cue ${input.id}: unknown kind "${input.kind}"`);
      if (cues.some((c) => c.id === input.id)) throw new Error(`Duplicate cue id "${input.id}"`);
      const d = KIND_DEFAULTS[input.kind];
      const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
      cues.push({
        id: input.id,
        kind: input.kind,
        frame: input.frame,
        t: input.frame / fps,
        scores: input.scores,
        dur: input.dur ?? d.dur,
        intensity: clamp01(input.intensity ?? d.intensity),
        pan: Math.min(1, Math.max(-1, input.pan ?? 0)),
        pitch: input.pitch ?? null,
        anchor: input.anchor ?? d.anchor,
        peak: clamp01(input.peak ?? 0.6),
        brightness: clamp01(input.brightness ?? d.brightness),
        seed: hashString(input.id),
        ...(input.sample ? { sample: input.sample, gainDb: input.gainDb ?? 0 } : {}),
      });
      return input.frame;
    },

    /** Mark an intentional hold so QA does not flag "dead time" inside it. */
    hold(id: string, from: number, to: number): void {
      holds.push({ id, from: checkFrame(from, `hold ${id}`), to: checkFrame(to, `hold ${id}`) });
    },
    /** Mark a hard cut so QA expects (and does not flag) a frame-difference spike. */
    cut(id: string, frame: number): number {
      cuts.push({ id, frame: checkFrame(frame, `cut ${id}`) });
      return frame;
    },

    // ---- physics-aware frame helpers: bind sound to what the spring actually does ----
    /** frame at which a spring started at `startF` first reaches ~98% (the "landing") */
    springArrivalFrame(startF: number, s: SpringLike, arrive = 0.98): number {
      return startF + Math.round(springTiming(resolveSpring(s), { arrive }).arrival * fps);
    },
    /** frame of maximum velocity (where a whoosh should peak) */
    springPeakVelocityFrame(startF: number, s: SpringLike): number {
      return startF + Math.round(springTiming(resolveSpring(s)).peakVelocityTime * fps);
    },
    /** frames until the spring is visually settled (|x-1| < eps) */
    springSettleFrames(s: SpringLike, eps = 0.01): number {
      return Math.round(springTiming(resolveSpring(s), { eps }).settle * fps);
    },

    /**
     * frame of maximum velocity of an eased move from `startF` to `endF` — where a whoosh
     * for that move should peak (camera pushes, slides, wipes).
     */
    easePeakVelocityFrame(startF: number, endF: number, e: EaseLike): number {
      const fn = resolveEase(e);
      const n = endF - startF;
      if (n <= 0) return startF;
      let best = 0;
      let bestV = -1;
      for (let i = 0; i < n; i++) {
        const v = Math.abs(fn((i + 1) / n) - fn(i / n));
        if (v > bestV + 1e-12) {
          bestV = v;
          best = i;
        }
      }
      // velocity of interval [i, i+1] is centred at i + 0.5
      return startF + Math.round(best + 0.5);
    },

    /** eased progress of `frame` over [start, start+dur] */
    progress: (frame: number, start: number, dur: number, e?: EaseLike): number =>
      progress(frame, start, dur, e),

    export(): TimelineExport {
      const { music, mix, ...rest } = spec;
      return {
        version: 1,
        spec: rest,
        music: music ?? null,
        mix: mix ?? null,
        beatFrames,
        events: Object.fromEntries(events),
        cues: [...cues].sort((a, b) => a.frame - b.frame || a.id.localeCompare(b.id)),
        holds: [...holds],
        cuts: [...cuts],
      };
    },
  };
  return api;
}

export type Timeline = ReturnType<typeof createTimeline>;
