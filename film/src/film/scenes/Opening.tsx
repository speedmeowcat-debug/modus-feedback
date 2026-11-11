// Сцены 1–2: разрозненные сообщения → единая система. Тёмная сцена, 2.5D-камера, перевод фокуса.

import { At, C, Stage, camTrack, cam0, clamp, dof, ev, lerp, mix, out, qa, sp } from "../lib";
import {
  P_CAM_END,
  P_CAM_START,
  P_FOCUS,
  P_MSG,
  P_PHRASE,
  P_SWARM,
  S_ALIGN,
  S_ALIGN_STAGGER,
  S_CAM_END,
  S_EXIT,
  S_LIGHT,
  S_SUB,
  S_TITLE,
} from "../timeline";
import { MY_ROWS, TicketRowView } from "../ui/app";
import { PRODUCT_CAM_START, appToScreen, LIST_ROW_CENTER } from "./Product";

function Message({ text, who, light, big = true }: { text: string; who?: string; light: number; big?: boolean }) {
  return (
    <div
      style={{
        padding: big ? "22px 30px" : "16px 22px",
        borderRadius: 16,
        background: mix(C.nightCard, C.surface, light),
        border: `1px solid ${mix(C.nightLine, C.line, light)}`,
        color: mix(C.nightText, C.ink, light),
        whiteSpace: "nowrap",
        boxShadow: "0 20px 50px rgb(0 0 0 / 0.35)",
      }}
    >
      {who && <p style={{ fontSize: 20, color: mix(C.nightMuted, C.muted, light), marginBottom: 6 }}>{who}</p>}
      <p style={{ fontSize: big ? 38 : 28, fontWeight: 500, letterSpacing: "-0.005em" }}>{text}</p>
    </div>
  );
}

/** Положение строк списка в кадре в конце сцены 2: совпадает со строками интерфейса в начале сцены 3. */
const LIST_X = 470;
const LIST_Y0 = -150;
const LIST_GAP = 98;

export function Opening({ f }: { f: number }) {
  if (f > 812) return null;

  // ---- камера: медленный отъезд (сцена 1), затем пролёт вперёд сквозь сообщения (сцена 2)
  const cam = camTrack(f, { ...cam0, z: 420 }, [
    { at: P_CAM_START, dur: P_CAM_END - P_CAM_START, to: { z: -560, x: 40 }, e: "inOutSine" },
    { at: S_ALIGN, dur: S_CAM_END - S_ALIGN, to: { z: 0, x: 0 }, e: "inOutCubic" },
  ]);
  // медленный наезд, пока на экране название (затухает к передаче кадра в интерфейс)
  cam.z += Math.max(0, Math.min(f, S_EXIT) - S_CAM_END) * 0.22 * (1 - ev(f, S_EXIT, 40));

  // ---- перевод фокуса: на последнее появившееся сообщение, в конце — снова на первое
  let focus = 0;
  P_MSG.forEach((m, i) => {
    if (i > 0) focus = lerp(focus, m.z, ev(f, m.at - 6, 30));
  });
  focus = lerp(focus, 0, ev(f, P_FOCUS - 20, 40));
  focus = lerp(focus, 0, ev(f, S_ALIGN, 40));

  const dim = ev(f, P_FOCUS, 40) * (1 - ev(f, S_ALIGN, 30)); // остальные уходят в тень
  const align = (i: number) => sp(f, S_ALIGN + i * S_ALIGN_STAGGER, "smooth");
  const light = ev(f, S_LIGHT, 46, "inOutQuart");
  const toRow = ev(f, S_EXIT, 72, "inOutCubic"); // строки списка встают на места строк интерфейса

  // Цели строк: сначала колонка справа от заголовка, затем — строки окна приложения.
  const rowTarget = (i: number) => {
    const list = { x: LIST_X, y: LIST_Y0 + i * LIST_GAP };
    const app = appToScreen(PRODUCT_CAM_START, LIST_ROW_CENTER(i));
    return { x: lerp(list.x, app.x, toRow), y: lerp(list.y, app.y, toRow) };
  };

  const titleIn = sp(f, S_TITLE, "heavy");
  const subIn = sp(f, S_SUB, "smooth");
  const titleOut = out(f, S_EXIT, 40);

  return (
    <>
      <Stage cam={cam} perspective={1800}>
        {/* фоновые сообщения: в сцене 2 камера пролетает мимо них */}
        {P_SWARM.map((m, i) => {
          const a = sp(f, m.at, "snappy");
          const fly = ev(f, S_ALIGN + i * 4, 110, "inCubic");
          const z = lerp(m.z, 1500, fly);
          const zEff = z + cam.z;
          return (
            <At key={m.text} x={m.x * (1 + fly * 0.6)} y={m.y * (1 + fly * 0.6)} z={z} o={a * (1 - dim * 0.75) * (1 - ev(f, S_ALIGN + 60, 40))} s={0.94 + 0.06 * a} blur={dof(zEff - cam.z, focus, 0.009, 12)}>
              <Message text={m.text} light={0} big={false} />
            </At>
          );
        })}
        {/* основные сообщения: в сцене 2 становятся строками списка */}
        {P_MSG.map((m, i) => {
          const a = sp(f, m.at, "snappy");
          const p = align(i);
          const tgt = rowTarget(i);
          const x = lerp(m.x, tgt.x, p);
          const y = lerp(m.y, tgt.y, p) + (1 - a) * 18;
          const z = lerp(m.z, 0, p);
          const ry = lerp(0, -14, p) * (1 - toRow);
          const rowW = lerp(720, 1160, toRow);
          const rowH = lerp(96, 66, toRow);
          const isFirst = i === 0;
          const o = a * (isFirst ? 1 : 1 - dim * 0.7) * (1 - ev(f, 784, 16));
          return (
            <At key={m.text} x={x} y={y} z={z} ry={ry} s={0.95 + 0.05 * a} o={o} blur={dof(z, focus, 0.009, 10) * (1 - p)}>
              {p < 0.02 ? (
                <div {...(f > m.at + 10 && f < S_ALIGN ? qa(`msg-${i}`, m.text.split(" ").length) : {})}>
                  <Message text={m.text} who={m.who} light={0} />
                </div>
              ) : (
                // строка: тёмная карточка сообщения светлеет и становится строкой интерфейса
                <div
                  style={{
                    width: lerp(560, rowW, Math.min(1, p * 1.2)),
                    height: rowH,
                    borderRadius: lerp(16, 0, toRow),
                    background: mix(C.nightCard, C.surface, light),
                    border: `1px solid ${mix(isFirst ? C.accent : C.nightLine, C.line, light)}`,
                    boxShadow: `0 ${20 * (1 - toRow)}px 50px rgb(0 0 0 / ${0.35 * (1 - light)})`,
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  <div className="absolute inset-0 flex items-center gap-4 px-7" style={{ opacity: 1 - ev(light, 0, 0.5) }}>
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: isFirst ? "#5fae94" : C.nightMuted }} />
                    <span style={{ fontSize: 30, fontWeight: 500, color: C.nightText, whiteSpace: "nowrap" }}>{m.text}</span>
                  </div>
                  <div className="absolute inset-0" style={{ opacity: ev(light, 0.5, 0.5), width: 1160 }}>
                    <TicketRowView r={MY_ROWS[i]!} />
                  </div>
                </div>
              )}
            </At>
          );
        })}
      </Stage>

      {/* «Каждое обращение важно» — в плоскости экрана, поверх сцены */}
      {f >= P_PHRASE && f < S_ALIGN + 30 && (
        <div className="absolute inset-x-0 flex justify-center" style={{ top: 830 }}>
          <p
            {...(f > P_PHRASE + 20 && f < S_ALIGN ? qa("phrase", 3) : {})}
            style={{
              fontSize: 62,
              fontWeight: 600,
              letterSpacing: "-0.015em",
              color: C.nightText,
              opacity: sp(f, P_PHRASE, "smooth") * out(f, S_ALIGN - 8, 30),
              transform: `translateY(${(1 - sp(f, P_PHRASE, "smooth")) * 26 - ev(f, S_ALIGN - 8, 30) * 20}px)`,
            }}
          >
            Каждое обращение важно
          </p>
        </div>
      )}

      {/* Название и подзаголовок сцены 2 */}
      {f >= S_TITLE - 4 && titleOut > 0.001 && (
        <div className="absolute" style={{ left: 150, top: 330, opacity: titleOut, transform: `translateY(${-(1 - titleOut) * 50}px)` }}>
          <div style={{ clipPath: "inset(-20px -600px 0 -20px)", paddingBottom: 6, whiteSpace: "nowrap" }}>
            <h1
              {...(f > S_TITLE + 20 && f < S_EXIT ? qa("title", 2) : {})}
              style={{
                fontSize: 124,
                lineHeight: 1.0,
                fontWeight: 600,
                letterSpacing: `${lerp(0.08, -0.01, titleIn)}em`,
                color: "#fff",
                transform: `translateY(${(1 - titleIn) * 110}%)`,
              }}
            >
              MODUS
              <br />
              FEEDBACK
            </h1>
          </div>
          <div style={{ width: lerp(0, 120, sp(f, S_TITLE + 16, "smooth")), height: 3, background: "#5fae94", marginTop: 34 }} />
          <p
            {...(f > S_SUB + 10 && f < S_EXIT ? qa("subtitle", 5) : {})}
            style={{ marginTop: 28, fontSize: 40, color: C.nightMuted, maxWidth: 640, lineHeight: 1.25, opacity: subIn, transform: `translateY(${(1 - subIn) * 20}px)` }}
          >
            Единая система обратной связи сотрудников
          </p>
        </div>
      )}
    </>
  );
}

export const openingBg = (f: number) => clamp(ev(f, S_LIGHT, 46, "inOutQuart"));
