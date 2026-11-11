// Сцена 6: ПРОЗРАЧНОСТЬ → КОНТРОЛЬ → РЕЗУЛЬТАТ. Одна полоса мира, камера непрерывно едет вдоль неё.

import type { ReactNode } from "react";
import { Card } from "@/components/ui";
import { At, C, Stage, camTrack, cam0, ev, lerp, out, qa, sp, type CamKey } from "../lib";
import { A_OUT, I_GROUPS, I_MOVE_DUR, W_ASSIGN, W_DONE, W_REVIEW, W_STEPPER, W_WORK } from "../timeline";
import { ControlCard, HistoryCard, OverdueRow, ResultCard, Stepper, type HistItem } from "../ui/workflow";

const GAP = 1900; // расстояние между понятиями в мире
const CAPTIONS = ["Статус и история каждого обращения", "Ответственный и срок всегда известны", "Итог зафиксирован и измерим"];

// История в собранном виде: все события уже произошли (кадры событий в прошлом).
const HIST: HistItem[] = [
  { at: W_STEPPER, title: "Обращение создано", meta: "Сотрудник закупок · 11 нояб. 10:42", tone: "system" },
  { at: W_ASSIGN, title: "Назначен ответственный: Руководитель закупок", meta: "Система · По правилу маршрутизации (категория)", tone: "system" },
  { at: W_REVIEW, title: "Статус: Новое → На рассмотрении", meta: "Руководитель закупок · 11 нояб. 11:05", tone: "status" },
  { at: W_WORK, title: "Статус: На рассмотрении → В работе", meta: "Руководитель закупок · 12 нояб. 09:30", tone: "status" },
  { at: W_DONE, title: "Статус: В работе → Реализовано", meta: "Руководитель закупок · 18 нояб. 15:20", tone: "status" },
];

function Kpi({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <Card className="p-5" style={{ width: 300 }}>
      <p className="text-sm text-muted">{label}</p>
      <p className="num mt-1 text-[34px] leading-none font-semibold tracking-[-0.01em]">{value}</p>
      <p className="mt-2 text-sm text-muted">{note}</p>
    </Card>
  );
}

function Word({ i, f }: { i: number; f: number }) {
  const g = I_GROUPS[i]!;
  const a = sp(f, g.at + (i === 0 ? 14 : 4), "heavy");
  const cap = sp(f, g.at + 26, "smooth");
  const leave = i < 2 ? ev(f, g.move, I_MOVE_DUR) : 0;
  const readable = f > g.at + 30 && f < g.move;
  return (
    <div style={{ width: 820 }}>
      <div style={{ clipPath: "inset(-20px -400px 0 -20px)", paddingBottom: 4, whiteSpace: "nowrap" }}>
        <h2
          {...(readable ? qa(`word-${i}`, 1) : {})}
          style={{
            fontSize: 84,
            lineHeight: 1,
            fontWeight: 600,
            letterSpacing: `${lerp(0.09, 0.015, a)}em`,
            color: C.ink,
            transform: `translateY(${(1 - a) * 105}%)`,
          }}
        >
          {g.word}
        </h2>
      </div>
      <div style={{ height: 3, width: 96 * a, background: C.accent, marginTop: 30, opacity: 1 - leave }} />
      <p
        {...(readable ? qa(`caption-${i}`, CAPTIONS[i]!.split(" ").length) : {})}
        style={{ marginTop: 26, fontSize: 36, color: C.muted, opacity: cap * (1 - leave), transform: `translateY(${(1 - cap) * 16}px)` }}
      >
        {CAPTIONS[i]}
      </p>
    </div>
  );
}

function Group({ i, f, children }: { i: number; f: number; children: ReactNode }) {
  const g = I_GROUPS[i]!;
  const uiIn = sp(f, g.at + 18, "smooth");
  return (
    <>
      <At x={i * GAP - 810} y={-150} origin="topleft">
        <Word i={i} f={f} />
      </At>
      <At x={i * GAP + 440} y={0} z={(1 - uiIn) * -120} o={uiIn} s={1.28}>
        {children}
      </At>
    </>
  );
}

export function Impact({ f }: { f: number }) {
  if (f < A_OUT + 20 || f > 3240) return null;
  const keys: CamKey[] = [
    { at: A_OUT + 20, dur: 70, to: { x: 0, s: 1.0, ry: 0, rx: 0 }, e: "outCubic" },
    { at: I_GROUPS[0].move, dur: I_MOVE_DUR, to: { x: GAP }, e: "inOutCubic" },
    { at: I_GROUPS[1].move, dur: I_MOVE_DUR, to: { x: 2 * GAP }, e: "inOutCubic" },
    { at: 3172, dur: 60, to: { s: 0.7, z: -200 }, e: "inCubic" },
  ];
  // Вход: камера приезжает из движения предыдущей сцены (слева и с поворотом).
  const cam = camTrack(f, { ...cam0, x: -520, s: 0.9, ry: -9, rx: 3 }, keys);
  const o = ev(f, A_OUT + 30, 40) * out(f, 3166, 30);
  const drift = (f - I_GROUPS[0].at) * 0.12; // медленный дрейф внутри удержаний

  return (
    <div style={{ position: "absolute", inset: 0, opacity: o }}>
      <Stage cam={{ ...cam, x: cam.x + drift }} perspective={2200}>
        <Group i={0} f={f}>
          <div className="flex flex-col items-start gap-6">
            <Card className="px-8 pt-6 pb-2">
              <Stepper stage={3} width={560} />
            </Card>
            <HistoryCard items={HIST} f={f + 10000} width={640} />
          </div>
        </Group>
        <Group i={1} f={f}>
          <div className="flex flex-col items-start gap-6">
            <ControlCard width={600} />
            <OverdueRow id="A-001" text="В заявках на приобретение оборудования…" status="new" />
            <OverdueRow id="A-002" text="При общении с поставщиками полезно…" status="in_review" />
          </div>
        </Group>
        <Group i={2} f={f}>
          <div className="flex flex-col items-start gap-6">
            <ResultCard width={640} />
            <div className="flex gap-5">
              <Kpi label="Реализовано" value="3" note="включая A-021" />
              <Kpi label="Рассмотрение завершено" value="24%" note="5 из 21 обращения" />
            </div>
          </div>
        </Group>
      </Stage>
    </div>
  );
}
