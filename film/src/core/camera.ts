/**
 * camera.ts — 2D camera path (pan / zoom / roll) from keyframes, plus subtle
 * deterministic drift. The CameraRig component applies the result as a transform.
 */

import { resolveEase, clamp, invLerp, lerp, type EaseLike } from './easing';
import { noise1 } from './random';

export interface CamKey {
  frame: number;
  /** world-space point at the centre of the screen */
  x: number;
  y: number;
  /** 1 = native scale */
  zoom: number;
  /** degrees */
  roll?: number;
  /** easing of the segment that ENDS at this key */
  ease?: EaseLike;
}

export interface CamState {
  x: number;
  y: number;
  zoom: number;
  roll: number;
}

export function cameraAt(frame: number, keys: readonly CamKey[]): CamState {
  const first = keys[0];
  const last = keys[keys.length - 1];
  if (first === undefined || last === undefined) return { x: 0, y: 0, zoom: 1, roll: 0 };
  const st = (k: CamKey): CamState => ({ x: k.x, y: k.y, zoom: k.zoom, roll: k.roll ?? 0 });
  if (frame <= first.frame) return st(first);
  if (frame >= last.frame) return st(last);
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1];
    const b = keys[i];
    if (a === undefined || b === undefined) continue;
    if (frame <= b.frame) {
      const t = resolveEase(b.ease ?? 'inOutCubic')(clamp(invLerp(a.frame, b.frame, frame)));
      // zoom interpolates in log space so a zoom-in and zoom-out feel symmetric
      const zoom = Math.exp(lerp(Math.log(a.zoom), Math.log(b.zoom), t));
      return {
        x: lerp(a.x, b.x, t),
        y: lerp(a.y, b.y, t),
        zoom,
        roll: lerp(a.roll ?? 0, b.roll ?? 0, t),
      };
    }
  }
  return st(last);
}

/**
 * Low-frequency drift so a locked-off shot does not feel dead. `amp` is in
 * world px; keep it under ~0.4% of the frame width. Not a shake.
 */
export function drift(frame: number, fps: number, amp: number, seed = 1): { x: number; y: number } {
  const t = frame / fps;
  return {
    x: noise1(t * 0.35, seed) * amp,
    y: noise1(t * 0.31 + 17, seed + 1) * amp,
  };
}
