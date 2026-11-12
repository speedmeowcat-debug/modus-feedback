// Итог (8 с). Слова лежат в мире в один ряд, камера непрерывно едет вдоль них (без исчезаний),
// затем слова съезжаются в цепочку, A-021 проходит путь, всё сворачивается в точку → финальный титр.

import { C, clamp, ev, lerp, mix, qa, sp } from "../film/lib";
import { ACC_N } from "./ColdOpen";
import { H, W, X_CHAIN, X_COLLAPSE, X_FLASH, X_GAP, X_MOVES, X_STEPS, X_TOKEN, X_TOKEN_DUR } from "./timeline90";

const NODE_X = [-660, -220, 220, 660];

/** Положение камеры вдоль ряда слов. */
function camX(f: number) {
  let x = -1500; // первое слово въезжает справа, пока элементы предыдущей сцены разлетаются
  X_MOVES.forEach((m, i) => {
    const p = ev(f, m.start, m.dur, i === 0 ? "outCubic" : "inOutCubic");
    const from = i === 0 ? -1500 : (i - 1) * X_GAP;
    x += (i * X_GAP - from) * p;
  });
  return x;
}

export function Recap({ f }: { f: number }) {
  const chain = ev(f, X_CHAIN, 50, "inOutCubic");
  const collapse = ev(f, X_COLLAPSE, X_FLASH - X_COLLAPSE, "inCubic");
  const flash = clamp(1 - Math.abs(f - (X_FLASH + 6)) / 10);
  const lineDraw = ev(f, X_CHAIN + 24, 40, "inOutCubic");
  const tok = ev(f, X_TOKEN, X_TOKEN_DUR, "inOutCubic");
  const tokX = lerp(NODE_X[0]!, NODE_X[3]!, tok);
  const cx = camX(f);
  const s = lerp(1, 0.02, collapse);
  const settled = chain >= 1 && f < X_COLLAPSE;

  return (
    <div style={{ position: "absolute", inset: 0, background: C.night, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: W / 2, top: H / 2, transform: `scale(${s})` }}>
        {/* линия и узлы цепочки */}
        {chain > 0 && (
          <div style={{ opacity: chain }}>
            <div style={{ position: "absolute", left: NODE_X[0], top: -116, width: (NODE_X[3]! - NODE_X[0]!) * lineDraw, height: 3, background: C.nightLine }} />
            <div style={{ position: "absolute", left: NODE_X[0], top: -116, width: Math.max(0, tokX - NODE_X[0]!), height: 3, background: ACC_N, boxShadow: `0 0 18px ${ACC_N}` }} />
            {X_STEPS.map((_, i) => {
              const reached = f >= X_TOKEN && tokX >= NODE_X[i]! - 1;
              const ping = reached ? ev(f, X_TOKEN + Math.round((i / 3) * X_TOKEN_DUR), 30, "outCubic") : 0;
              const nodeIn = sp(f, X_CHAIN + 24 + i * 8, "snappy");
              return (
                <div key={i}>
                  <div style={{ position: "absolute", left: NODE_X[i]! - 12, top: -128, width: 24, height: 24, borderRadius: 999, background: reached ? ACC_N : C.night, border: `3px solid ${reached ? ACC_N : C.nightLine}`, transform: `scale(${nodeIn})` }} />
                  {ping > 0 && ping < 1 && (
                    <div style={{ position: "absolute", left: NODE_X[i]! - 12 - ping * 30, top: -128 - ping * 30, width: 24 + ping * 60, height: 24 + ping * 60, borderRadius: 999, border: `2px solid ${ACC_N}`, opacity: 1 - ping }} />
                  )}
                </div>
              );
            })}
            {f >= X_TOKEN - 10 && (
              <div style={{ position: "absolute", left: tokX, top: -116, transform: `translate(-50%, -50%) scale(${sp(f, X_TOKEN - 10, "snappy")})`, padding: "10px 18px", borderRadius: 12, background: ACC_N, color: C.night, fontSize: 26, fontWeight: 700, whiteSpace: "nowrap", boxShadow: `0 0 30px rgba(95,191,154,0.6)` }}>
                A-021
              </div>
            )}
          </div>
        )}

        {/* слова: одни и те же элементы на всём протяжении сцены */}
        {X_STEPS.map((st, i) => {
          const screenX = i * X_GAP - cx;
          const x = lerp(screenX, NODE_X[i]!, chain);
          const size = lerp(200, 60, chain);
          const centred = clamp(1 - Math.abs(screenX) / 1500);
          const reached = f >= X_TOKEN && tokX >= NODE_X[i]! - 1;
          const color = chain > 0 ? mix(C.nightText, reached ? C.nightText : mix(C.nightMuted, C.nightText, 0.4), chain) : C.nightText;
          const o = chain > 0 ? lerp(lerp(0.25, 1, centred), 1, chain) : lerp(0.18, 1, centred);
          const note = sp(f, X_CHAIN + 34 + i * 8, "smooth");
          if (Math.abs(x) > 2600) return null;
          return (
            <div key={i} style={{ position: "absolute", left: x, top: lerp(0, -60, chain), transform: "translate(-50%, -50%)", textAlign: "center", whiteSpace: "nowrap", opacity: o }}>
              <div style={{ fontSize: lerp(30, 0.01, chain), height: lerp(44, 0, chain), overflow: "hidden", fontWeight: 600, letterSpacing: "0.2em", color: ACC_N }}>{String(i + 1).padStart(2, "0")}</div>
              <div {...((chain === 0 && centred > 0.95) || settled ? qa(`x-word-${i}`, 1) : {})} style={{ fontSize: size, lineHeight: 1.12, fontWeight: 800, letterSpacing: `${lerp(-0.03, -0.02, chain)}em`, color }}>
                {st.w}
              </div>
              {chain > 0 && (
                <div {...(settled ? qa(`x-note-${i}`, st.note.split(" ").length) : {})} style={{ marginTop: 10, fontSize: 28, color: C.nightMuted, opacity: note, transform: `translateY(${(1 - note) * 12}px)` }}>
                  {st.note}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", inset: 0, background: "#fff", opacity: flash * 0.9, pointerEvents: "none" }} />
    </div>
  );
}
