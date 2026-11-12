// Холодное открытие (0–12 с): вопрос → четыре канала → стена вопросов → «Обращения теряются» → точка → поворот.

import { C, clamp, ev, lerp, mix, out, qa, sp } from "../film/lib";
import { P_MSG, P_SWARM } from "../film/timeline";
import {
  CO_DOT, CO_DROP, CO_LINE, CO_LOST, CO_PIVOT, CO_REDACT, CO_TYPE, CO_TYPE_CPF, CO_TYPE_OUT, CO_TYPE_TEXT, CO_WALL, CO_WIPE, CO_WIPE_DUR, CO_WORDS, H, W,
} from "./timeline90";

export const ACC_N = "#5fbf9a"; // акцент приложения, осветлённый для тёмного фона
const DANGER_N = "#e0634a";

// Темы стены — из демонстрационного датасета и сцены «Проблема».
const WALL_TEXT = [...P_MSG.map((m) => m.text), ...P_SWARM.map((m) => m.text)];
const rowText = (i: number) => {
  const parts: string[] = [];
  for (let k = 0; k < 6; k++) parts.push(WALL_TEXT[(i * 3 + k * 5) % WALL_TEXT.length]!);
  return parts.join("   ·   ");
};

function Typing({ f }: { f: number }) {
  if (f > CO_TYPE_OUT + 24) return null;
  const n = clamp(Math.floor((f - CO_TYPE) / CO_TYPE_CPF), 0, CO_TYPE_TEXT.length);
  const done = n >= CO_TYPE_TEXT.length;
  const caretOn = !done || Math.floor(f / 16) % 2 === 0;
  const leave = ev(f, CO_TYPE_OUT, 18, "emphasizedIn");
  return (
    <div
      style={{
        position: "absolute", left: 0, right: 0, top: H / 2 - 60, textAlign: "center",
        transform: `translateY(${-leave * 160}px)`, opacity: 1 - leave, filter: leave > 0.02 ? `blur(${leave * 14}px)` : undefined,
      }}
    >
      <span {...(done ? qa("co-question", 3) : {})} style={{ fontSize: 96, fontWeight: 600, letterSpacing: "-0.02em", color: C.nightText }}>
        {CO_TYPE_TEXT.slice(0, n)}
      </span>
      <span style={{ display: "inline-block", width: 8, height: 96, marginLeft: 10, verticalAlign: "-12px", background: ACC_N, opacity: caretOn && f >= CO_TYPE - 10 ? 1 : 0 }} />
    </div>
  );
}

function Slams({ f }: { f: number }) {
  if (f < CO_WORDS[0].at || f >= CO_WALL) return null;
  let k = 0;
  CO_WORDS.forEach((w, i) => { if (f >= w.at) k = i; });
  const w = CO_WORDS[k]!;
  const a = sp(f, w.at - 2, "snappy");
  const inv = k % 2 === 1;
  const zoom = 1 + (f - w.at) * 0.0016;
  return (
    <div style={{ position: "absolute", inset: 0, background: inv ? C.page : C.night, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 120, top: 120, fontSize: 30, fontWeight: 600, letterSpacing: "0.2em", color: inv ? C.accent : ACC_N }}>
        {String(k + 1).padStart(2, "0")} / 04
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: H / 2 - 170, height: 340, overflow: "hidden", textAlign: "center" }}>
        <div
          {...qa(`co-slam-${k}`, 1)}
          style={{
            fontSize: 300, lineHeight: "340px", fontWeight: 800, letterSpacing: `${lerp(0.06, -0.035, a)}em`,
            color: inv ? C.ink : C.nightText,
            transform: `translateY(${(1 - a) * 100}%) scale(${zoom * lerp(1.18, 1, a)})`,
          }}
        >
          {w.w}
        </div>
      </div>
      <div style={{ position: "absolute", left: 120, right: 120, bottom: 140, height: 4, background: inv ? C.line : C.nightLine }}>
        <div style={{ width: `${((k + clamp((f - w.at) / 30)) / 4) * 100}%`, height: 4, background: inv ? C.accent : ACC_N }} />
      </div>
    </div>
  );
}

function Wall({ f }: { f: number }) {
  if (f < CO_WALL || f > CO_DROP + 70) return null;
  const inA = ev(f, CO_WALL, 30, "outCubic");
  const drop = ev(f, CO_DROP, 60, "inCubic");
  const lost = sp(f, CO_LOST, "heavy");
  const under = ev(f, CO_LOST + 8, 26, "outCubic");
  const rows = 11;
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", opacity: 1 - drop, filter: drop > 0.01 ? `saturate(${1 - drop}) blur(${drop * 10}px)` : undefined }}>
      <div style={{ position: "absolute", inset: 0, perspective: 1400 }}>
        <div
          style={{
            position: "absolute", left: -600, top: -160, width: W + 1200, height: H + 320, transformStyle: "preserve-3d",
            transform: `translateY(${drop * 700}px) translateZ(${lerp(-500, 60, inA) + (f - CO_WALL) * 1.2}px) rotateX(${lerp(48, 30, inA)}deg) rotateZ(-7deg)`,
          }}
        >
          {Array.from({ length: rows }, (_, i) => {
            const dir = i % 2 === 0 ? -1 : 1;
            const speed = 3.2 + (i % 4) * 0.9;
            const x = dir * ((f - CO_WALL) * speed) - 900 + (i * 137) % 400;
            const redact = i % 3 === 1 ? ev(f, CO_REDACT + (i % 9) * 3, 14, "outCubic") : 0;
            return (
              <div key={i} style={{ position: "absolute", top: i * 128, left: x, whiteSpace: "nowrap", fontSize: 50, fontWeight: 500, color: i % 4 === 0 ? C.nightText : C.nightMuted, opacity: lerp(0.25, 0.75, ((i * 7) % 5) / 4) }}>
                {rowText(i)}
                {redact > 0 && <div style={{ position: "absolute", left: 0, top: 6, height: 52, width: `${redact * 100}%`, background: "#000", borderRight: `3px solid ${DANGER_N}` }} />}
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at center, rgba(13,15,14,${0.92 * lost}) 0%, rgba(13,15,14,${0.6 * lost}) 38%, rgba(13,15,14,0) 70%)` }} />
      {f >= CO_LOST && (
        <div style={{ position: "absolute", left: 0, right: 0, top: H / 2 - 90, textAlign: "center", transform: `translateY(${drop * 420}px)` }}>
          <div style={{ overflow: "hidden", height: 150 }}>
            <div {...qa("co-lost", 2)} style={{ fontSize: 124, lineHeight: "150px", fontWeight: 700, letterSpacing: "-0.025em", color: C.nightText, transform: `translateY(${(1 - lost) * 100}%)` }}>
              Обращения теряются.
            </div>
          </div>
          <div style={{ margin: "18px auto 0", height: 6, width: 620 * under, background: DANGER_N }} />
        </div>
      )}
    </div>
  );
}

function Pivot({ f }: { f: number }) {
  if (f < CO_DOT) return null;
  const dot = sp(f, CO_DOT, "snappy");
  const line = ev(f, CO_LINE, 44, "inOutCubic");
  const txt = sp(f, CO_PIVOT, "smooth");
  const wipe = ev(f, CO_WIPE, CO_WIPE_DUR, "inOutCubic");
  const lineW = lerp(18, 980, line);
  const bandH = lerp(6, H * 1.2, ev(f, CO_WIPE, CO_WIPE_DUR * 0.55, "inCubic"));
  const bandY = lerp(0, -H * 1.3, ev(f, CO_WIPE + CO_WIPE_DUR * 0.45, CO_WIPE_DUR * 0.55, "inCubic"));
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: H / 2 - 160, textAlign: "center", opacity: txt * out(f, CO_WIPE, 18), transform: `translateY(${(1 - txt) * 40}px)` }}>
        <span {...(f > CO_PIVOT + 20 && f < CO_WIPE ? qa("co-pivot", 3) : {})} style={{ fontSize: 88, fontWeight: 600, letterSpacing: "-0.02em", color: C.nightText }}>
          Пора навести порядок.
        </span>
      </div>
      <div
        style={{
          position: "absolute", left: W / 2 - lerp(lineW, W * 1.1, wipe) / 2, top: H / 2 + 20 - bandH / 2 + bandY,
          width: lerp(lineW, W * 1.1, wipe), height: f < CO_WIPE ? lerp(18, 6, line) : bandH,
          borderRadius: line < 0.05 && f < CO_WIPE ? 999 : 3,
          background: mix(ACC_N, "#ffffff", 0.15 * wipe),
          transform: `scale(${f < CO_LINE ? dot : 1})`,
          boxShadow: `0 0 ${40 + 60 * line}px rgba(95,191,154,${0.35 + 0.25 * line})`,
        }}
      />
    </div>
  );
}

export function ColdOpen({ f }: { f: number }) {
  return (
    <div style={{ position: "absolute", inset: 0, background: C.night, overflow: "hidden" }}>
      <Typing f={f} />
      <Slams f={f} />
      <Wall f={f} />
      <Pivot f={f} />
    </div>
  );
}
