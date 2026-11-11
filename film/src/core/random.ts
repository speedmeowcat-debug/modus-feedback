/** Deterministic randomness. Never use Math.random() in a composition. */

/** FNV-1a 32-bit hash of a string -> unsigned int. Used to seed per-cue / per-item RNGs. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 PRNG: returns a function producing floats in [0,1). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smooth 1D value noise in roughly [-1, 1], deterministic in (x, seed). */
export function noise1(x: number, seed = 0): number {
  const i = Math.floor(x);
  const f = x - i;
  const r = (n: number) => rng(hashString(`${seed}:${n}`))() * 2 - 1;
  const u = f * f * (3 - 2 * f);
  return r(i) * (1 - u) + r(i + 1) * u;
}
