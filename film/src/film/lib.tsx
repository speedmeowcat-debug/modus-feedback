// Общий язык движения ролика: пружины, плавности, 2.5D-камера, глубина резкости, курсор.
// Всё — чистые функции номера кадра (кадр может быть дробным при motion blur).

import type { CSSProperties, ReactNode } from "react";
import { clamp, ease, lerp, progress, spring01, type EaseLike, type SpringLike } from "../core";
import { FPS } from "./timeline";

export { clamp, ease, lerp };

/** Пружина 0→1, стартующая на кадре `at`. */
export const sp = (f: number, at: number, s: SpringLike = "smooth") => spring01(f, FPS, s, at);
/** Плавное 0→1 на отрезке [at, at+dur]. */
export const ev = (f: number, at: number, dur: number, e: EaseLike = "inOutCubic") => progress(f, at, dur, e);
/** Выход: 1→0. */
export const out = (f: number, at: number, dur: number, e: EaseLike = "emphasizedIn") => 1 - progress(f, at, dur, e);

/** Цвета приложения (src/app/globals.css) в виде чисел, чтобы их можно было смешивать покадрово. */
export const C = {
  page: "#f6f5f2",
  surface: "#ffffff",
  sunken: "#f0eeea",
  ink: "#1b1d1c",
  muted: "#5c6360",
  faint: "#878d8a",
  line: "#e3e1db",
  lineStrong: "#cbc8c0",
  accent: "#1f5a4a",
  accentSoft: "#e6efeb",
  accentInk: "#174639",
  danger: "#a4301d",
  dangerSoft: "#f9ebe7",
  warn: "#875600",
  warnSoft: "#faf0d9",
  // Тёмная сцена: тот же зелёно-серый оттенок, что у цвета текста приложения.
  night: "#0d0f0e",
  nightCard: "#181b1a",
  nightLine: "#2a2e2c",
  nightText: "#e8ebe9",
  nightMuted: "#8b928f",
} as const;

const hex = (h: string): number[] =>
  h.startsWith("rgb") ? h.replace(/[^\d,]/g, "").split(",").slice(0, 3).map(Number) : [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
export function mix(a: string, b: string, t: number): string {
  const x = hex(a);
  const y = hex(b);
  const k = clamp(t);
  return `rgb(${x.map((v, i) => Math.round(lerp(v, y[i]!, k))).join(",")})`;
}

// ---------------------------------------------------------------- 2.5D-камера

export type Cam = { x: number; y: number; z: number; rx: number; ry: number; s: number };
export const cam0: Cam = { x: 0, y: 0, z: 0, rx: 0, ry: 0, s: 1 };

/** Ключевые положения камеры: каждое следующее приходит своей кривой, без скачков. */
export type CamKey = { at: number; dur: number; to: Partial<Cam>; e?: EaseLike };
/** Малое непрерывное движение камеры: удержания не превращаются в застывший кадр. */
export const breathe = (f: number, c: Cam, amp = 1): Cam => ({
  ...c,
  x: c.x + amp * 7 * Math.sin(f / 95),
  y: c.y + amp * 4 * Math.sin(f / 137 + 1.3),
  ry: c.ry + amp * 0.35 * Math.sin(f / 160 + 0.4),
});

export function camTrack(f: number, from: Cam, keys: readonly CamKey[]): Cam {
  const c = { ...from };
  let prev = { ...from };
  for (const k of keys) {
    const p = progress(f, k.at, k.dur, k.e ?? "inOutCubic");
    const target = { ...prev, ...k.to };
    for (const key of Object.keys(c) as (keyof Cam)[]) c[key] += (target[key] - prev[key]) * p;
    prev = target;
  }
  return c;
}

/**
 * Сцена с перспективой. Точка (cam.x, cam.y) мира попадает в центр кадра,
 * затем масштаб, поворот камеры и наезд по оси Z.
 */
export function Stage({
  cam,
  children,
  perspective = 1800,
  style,
}: {
  cam: Cam;
  children: ReactNode;
  perspective?: number;
  style?: CSSProperties;
}) {
  return (
    <div style={{ position: "absolute", inset: 0, perspective, overflow: "hidden", ...style }}>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: 0,
          height: 0,
          transformStyle: "preserve-3d",
          transform: `translateZ(${cam.z}px) rotateX(${cam.rx}deg) rotateY(${cam.ry}deg) scale(${cam.s}) translate(${-cam.x}px, ${-cam.y}px)`,
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** Объект в мире: (x, y) — центр, z — глубина. blur — размытие по глубине резкости. */
export function At({
  x = 0,
  y = 0,
  z = 0,
  rx = 0,
  ry = 0,
  s = 1,
  o = 1,
  blur = 0,
  origin = "center",
  children,
  style,
}: {
  x?: number;
  y?: number;
  z?: number;
  rx?: number;
  ry?: number;
  s?: number;
  o?: number;
  blur?: number;
  origin?: "center" | "topleft";
  children: ReactNode;
  style?: CSSProperties;
}) {
  if (o <= 0.001) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: "max-content",
        transformStyle: "preserve-3d",
        transform: `translate3d(${x}px, ${y}px, ${z}px) rotateX(${rx}deg) rotateY(${ry}deg) scale(${s})${
          origin === "center" ? " translate(-50%, -50%)" : ""
        }`,
        opacity: o,
        filter: blur > 0.15 ? `blur(${blur.toFixed(2)}px)` : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Глубина резкости: размытие растёт с расстоянием от плоскости фокуса. */
export const dof = (zEff: number, focus: number, k = 0.012, max = 14) => Math.min(max, Math.abs(zEff - focus) * k);

// ---------------------------------------------------------------- курсор

export type CursorKey = { at: number; x: number; y: number; dur?: number };
/** Курсор движется по ключам; клик — короткое нажатие и кольцо. */
export function cursorAt(f: number, keys: readonly CursorKey[]) {
  let x = keys[0]!.x;
  let y = keys[0]!.y;
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i]!;
    const p = progress(f, k.at - (k.dur ?? 40), k.dur ?? 40, "inOutCubic");
    x = lerp(x, k.x, p);
    y = lerp(y, k.y, p);
  }
  return { x, y };
}

export function Cursor({ x, y, f, clicks, o = 1, scale = 1 }: { x: number; y: number; f: number; clicks: number[]; o?: number; scale?: number }) {
  const press = Math.max(0, ...clicks.map((c) => (f >= c - 3 && f < c + 6 ? 1 - Math.abs(f - c) / 6 : 0)));
  const ring = clicks.map((c) => ({ p: ev(f, c, 26, "outCubic"), on: f >= c && f < c + 26 })).find((r) => r.on);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        opacity: o,
        transform: `scale(${scale * (1 - press * 0.12)})`,
        transformOrigin: "0 0",
        pointerEvents: "none",
        zIndex: 50,
      }}
    >
      {ring && (
        <div
          style={{
            position: "absolute",
            left: -22 * (0.4 + ring.p),
            top: -22 * (0.4 + ring.p),
            width: 44 * (0.4 + ring.p),
            height: 44 * (0.4 + ring.p),
            borderRadius: 999,
            border: `2px solid ${C.accent}`,
            opacity: 0.55 * (1 - ring.p),
          }}
        />
      )}
      <svg width="26" height="32" viewBox="0 0 26 32" style={{ filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.25))" }}>
        <path d="M2 2 L2 25 L8 19.5 L12.5 29 L16.5 27.2 L12.2 18 L20.5 18 Z" fill="#fff" stroke="#1b1d1c" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

/** Подпись для QA: размер, читаемость и безопасная зона проверяются по этим тегам. */
export const qa = (id: string, words: number) => ({ "data-qa": id, "data-qa-words": String(words) });
