// Сцены 7–8: модульная структура продукта и планируемые интеграции → финальный титр.

import { At, C, Stage, camTrack, cam0, ev, lerp, out, qa, sp } from "../lib";
import { E_CORE, E_LABEL, E_MODULES, E_MODULE_STAGGER, E_PLANNED, F_HOLD, F_MARK, F_OUT, F_SLOGAN, F_TITLE } from "../timeline";

// Модули, которые реально есть в MVP (см. docs/ARCHITECTURE.md).
const MODULES = ["Обращения", "Маршрутизация", "Статусы и сроки", "История", "Уведомления", "Аналитика", "Роли и настройки"];
const PLANNED = ["Битрикс24", "1С УТ"];
const RX = 470;
const RY = 250;
const CX = -170; // центр композиции сдвинут влево, справа — планируемые интеграции

const modulePos = (i: number) => {
  const a = -Math.PI / 2 + (i / MODULES.length) * Math.PI * 2;
  return { x: CX + Math.cos(a) * RX, y: Math.sin(a) * RY, a };
};

function Chip({ text, planned }: { text: string; planned?: boolean }) {
  return (
    <div
      style={{
        padding: "14px 22px",
        borderRadius: 12,
        background: planned ? "transparent" : C.nightCard,
        border: `1.5px ${planned ? "dashed" : "solid"} ${planned ? "#4b524f" : C.nightLine}`,
        color: planned ? C.nightMuted : C.nightText,
        fontSize: 26,
        fontWeight: 500,
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </div>
  );
}

export function Closing({ f, finalOnly = false, noTitle = false }: { f: number; finalOnly?: boolean; noTitle?: boolean }) {
  if (f < 3150) return null;
  const leave = ev(f, F_OUT, 34, "emphasizedIn"); // всё уходит из кадра
  const cam = camTrack(f, { ...cam0, s: 1.25, z: 0 }, [
    { at: 3160, dur: 80, to: { s: 1 }, e: "outCubic" },
    { at: 3240, dur: 200, to: { s: 1.05 }, e: "linear" },
  ]);
  const coreIn = sp(f, E_CORE, "smooth");
  const lines = ev(f, E_MODULES - 6, 60, "inOutCubic");

  // финал
  const tIn = sp(f, F_TITLE, "heavy");
  const sIn = sp(f, F_SLOGAN, "smooth");
  const mIn = sp(f, F_MARK, "smooth");
  const drift = 1 + Math.max(0, f - F_HOLD) * 0.00012; // медленный дрейф в финальном удержании

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {!finalOnly && f < F_OUT + 40 && (
        <div style={{ position: "absolute", inset: 0, opacity: ev(f, 3176, 16) }}>
          <Stage cam={cam} perspective={2000}>
            <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible", opacity: 1 - leave }} width={1} height={1}>
              {MODULES.map((m, i) => {
                const p = modulePos(i);
                return <line key={m} x1={CX} y1={0} x2={lerp(CX, p.x, lines)} y2={lerp(0, p.y, lines)} stroke={C.nightLine} strokeWidth={1.5} />;
              })}
              {PLANNED.map((m, i) => {
                const y = i === 0 ? -120 : 120;
                const pl = ev(f, E_PLANNED, 40);
                return <line key={m} x1={CX + 170} y1={0} x2={lerp(CX + 170, 540, pl)} y2={lerp(0, y, pl)} stroke="#3a403d" strokeWidth={1.5} strokeDasharray="7 7" />;
              })}
            </svg>
            {MODULES.map((m, i) => {
              const p = modulePos(i);
              const a = sp(f, E_MODULES + i * E_MODULE_STAGGER, "snappy");
              const fly = leave * 900;
              return (
                <At key={m} x={lerp(CX, p.x, a) + Math.cos(p.a) * fly} y={lerp(0, p.y, a) + Math.sin(p.a) * fly} o={a * (1 - leave)} s={0.85 + 0.15 * a}>
                  <Chip text={m} />
                </At>
              );
            })}
            <At x={CX} y={0} s={(0.9 + 0.1 * coreIn) * (1 - leave * 0.4)} o={coreIn * (1 - leave)}>
              <div className="flex items-center gap-4 rounded-[18px] px-8 py-6" style={{ background: C.accent, boxShadow: "0 0 0 1px rgb(255 255 255 / 0.08), 0 30px 80px rgb(0 0 0 / 0.45)" }}>
                <span className="flex size-14 items-center justify-center rounded-[12px] bg-white text-[30px] font-semibold" style={{ color: C.accent }}>
                  М
                </span>
                <span className="leading-tight text-white">
                  <span className="block text-[34px] font-semibold">Modus Feedback</span>
                  <span className="block text-[22px] text-white/70">Работающий MVP</span>
                </span>
              </div>
            </At>
            {PLANNED.map((m, i) => (
              <At key={m} x={560 + leave * 700} y={i === 0 ? -120 : 120} o={sp(f, E_PLANNED + i * 8, "smooth") * (1 - leave)}>
                <Chip text={m} planned />
              </At>
            ))}
            <At x={560 + leave * 700} y={-230} o={sp(f, E_LABEL, "smooth") * (1 - leave)}>
              <p {...(f > E_LABEL + 20 && f < F_OUT ? qa("planned", 2) : {})} style={{ fontSize: 30, color: C.nightMuted, whiteSpace: "nowrap" }}>
                Планируемые интеграции
              </p>
            </At>
          </Stage>
        </div>
      )}

      {/* финальный титр */}
      {f >= F_TITLE - 2 && !noTitle && (
        <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ transform: `scale(${drift})` }}>
          <div style={{ clipPath: "inset(-20px -600px 0 -600px)", paddingBottom: 6, whiteSpace: "nowrap" }}>
            <h1
              {...(f > F_TITLE + 20 ? qa("final-title", 2) : {})}
              style={{
                fontSize: 128,
                lineHeight: 1,
                fontWeight: 600,
                color: "#fff",
                letterSpacing: `${lerp(0.12, 0.01, tIn)}em`,
                transform: `translateY(${(1 - tIn) * 105}%)`,
              }}
            >
              MODUS FEEDBACK
            </h1>
          </div>
          <div style={{ height: 3, width: 120 * sp(f, F_TITLE + 14, "smooth"), background: "#5fae94", marginTop: 36 }} />
          <p
            {...(f > F_SLOGAN + 10 ? qa("slogan", 4) : {})}
            style={{ marginTop: 30, fontSize: 48, color: C.nightText, opacity: sIn, transform: `translateY(${(1 - sIn) * 18}px)` }}
          >
            От обращения — к решению
          </p>
          <div className="absolute flex items-center gap-3" style={{ bottom: 150, opacity: mIn, transform: `translateY(${(1 - mIn) * 12}px)` }}>
            <span className="flex size-10 items-center justify-center rounded-[9px] text-[20px] font-semibold text-white" style={{ background: C.accent }}>
              М
            </span>
            <span {...(f > F_MARK + 10 ? qa("mark", 5) : {})} style={{ fontSize: 28, color: C.nightMuted }}>
              Хакатон ГК «Модус Трейд» · 2026
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export const closingDark = (f: number) => ev(f, 3176, 60, "inOutCubic");
export { out };
