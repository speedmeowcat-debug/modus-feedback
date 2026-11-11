/**
 * layout.ts — safe areas and type-size rules, as numbers QA can check.
 *
 * The margins below are authored heuristics (common broadcast / social practice),
 * NOT platform specifications. Verify against the destination platform when it
 * matters, and override via `custom`.
 */

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export type SafePreset = 'landscape' | 'square' | 'vertical' | 'custom';

export interface SafeAreas {
  /** nothing important may leave this rectangle */
  action: Rect;
  /** all text must stay inside this rectangle */
  title: Rect;
}

const inset = (w: number, h: number, l: number, t: number, r: number, b: number): Rect => ({
  left: w * l,
  top: h * t,
  right: w * (1 - r),
  bottom: h * (1 - b),
});

export function safeAreas(
  width: number,
  height: number,
  preset: SafePreset = width > height ? 'landscape' : width === height ? 'square' : 'vertical',
  custom?: { action: Rect; title: Rect },
): SafeAreas {
  if (preset === 'custom') {
    if (!custom) throw new Error("safeAreas('custom') needs the custom argument");
    return custom;
  }
  switch (preset) {
    case 'landscape':
      return {
        action: inset(width, height, 0.035, 0.05, 0.035, 0.05),
        title: inset(width, height, 0.07, 0.09, 0.07, 0.09),
      };
    case 'square':
      return {
        action: inset(width, height, 0.04, 0.04, 0.04, 0.04),
        title: inset(width, height, 0.08, 0.08, 0.08, 0.08),
      };
    case 'vertical':
      // leaves room for typical short-video UI: caption/CTA zone at the bottom,
      // action rail at the right, header at the top.
      return {
        action: inset(width, height, 0.04, 0.05, 0.04, 0.1),
        title: inset(width, height, 0.08, 0.1, 0.14, 0.22),
      };
  }
}

/** Smallest legible text height (px) for a frame height, for body-size text. */
export const minFontPx = (height: number): number => Math.round(height * 0.026);

/**
 * Minimum time (s) a text block must be fully visible and still, so it can be read.
 * Authored heuristic: 0.3 s per word + 0.35 s — short slogans, not paragraphs.
 */
export const minDwellSeconds = (words: number): number => 0.3 * words + 0.35;

/** Scale a design authored at 1080p-height to any frame height. */
export const scaleToHeight = (px: number, height: number): number => (px * height) / 1080;
