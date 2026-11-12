/**
 * 90-секундная версия: 1920x1080, 60 fps, 5400 кадров. Единственный источник времени.
 *
 * Монтаж (новые кадры ← кадры 60-секундного ролика):
 *   0–720      COLD   новая кинетическая типографика
 *   720–3420   ← 0–2700     проблема, решение, создание, рассмотрение, аналитика
 *   3420–4020  ROLES  новая сцена «Каждый видит своё»
 *   4020–4740  ← 2700–3420  ценность, развитие
 *   4740–5220  RECAP  новая цепочка «обращение → маршрут → решение → аналитика»
 *   5220–5400  ← 3420–3600  финальный титр (только титр)
 *
 * Звук: события старого ролика переносятся сюда по той же карте монтажа (кадр выводится из
 * движения, как и раньше), синтез заменён записанными SFX из избранного KantTools.
 * Музыка 120 BPM, такт = 120 кадров; все границы сцен стоят на тактовых чертах или половинах.
 */
import { createTimeline, type CueKind } from "../core";
import { T as T60 } from "../film/timeline";

export const FPS = 60;
export const W = 1920;
export const H = 1080;
export const DURATION = 5400;

export const T = createTimeline({
  id: "modus-feedback-film-90",
  fps: FPS,
  width: W,
  height: H,
  durationInFrames: DURATION,
  music: {
    bpm: 120,
    key: "D",
    mode: "major",
    startFrame: 0,
    bars: 45,
    progression: [
      6, 6, 4, 4, 5, 5, // холодное открытие
      6, 4, 5, 1, 5, 6, 4, 1, 5, 6, 4, 5, 1, 5, 6, 4, 5, 1, // проблема → аналитика
      6, 4, 1, 5, 6, // роли
      4, 5, 1, 6, 4, 5, // ценность, развитие
      1, 5, 6, 4, // итог
      1, 1, 1, 1, 1, 1, // хвост
    ].slice(0, 45),
    layers: { pad: 0.85, bass: 0.6, arp: 0.5, kick: 0.5, hat: 0.34, clap: 0.22, pulse: 0.4 },
    arc: [
      { bar: 0, energy: 0.3 },
      { bar: 2, energy: 0.6 },
      { bar: 4, energy: 0.8 },
      { bar: 5.5, energy: 0.2 },
      { bar: 6, energy: 0.3 },
      { bar: 9, energy: 0.55 },
      { bar: 12, energy: 0.72 },
      { bar: 18, energy: 0.85 },
      { bar: 28, energy: 0.8 },
      { bar: 33, energy: 0.95 },
      { bar: 39, energy: 1.0 },
      { bar: 43, energy: 0.45 },
      { bar: 45, energy: 0.3 },
    ],
    seed: 11,
  },
  mix: { targetLufs: -14, truePeakDb: -1.5, musicDb: -10, fadeIn: 0.02, fadeOut: 0.8 },
});

// ---------------------------------------------------------------- монтаж
export type Seg = { from: number; to: number; src: number; finalOnly?: boolean; noTitle?: boolean } | { from: number; to: number; scene: "cold" | "roles" | "recap" };
export const SEGS: Seg[] = [
  { from: 0, to: 720, scene: "cold" },
  { from: 720, to: 3420, src: 0 },
  { from: 3420, to: 4020, scene: "roles" },
  { from: 4020, to: 4750, src: 2730, noTitle: true }, // вход в «Ценность», когда аналитика уже ушла; выход — штатный разлёт элементов до конца
  { from: 4750, to: 5220, scene: "recap" },
  { from: 5220, to: 5400, src: 3420, finalOnly: true },
];
/** Кадр 60-секундного ролика → кадр этой версии (null, если кадр не попал в монтаж). */
export function remap(srcF: number): number | null {
  for (const s of SEGS) if ("src" in s && srcF >= s.src && srcF < s.src + (s.to - s.from)) return s.from + (srcF - s.src);
  return null;
}
for (const s of SEGS) if (s.from > 0) T.cut(`seam-${s.from}`, s.from);

// ---------------------------------------------------------------- COLD (0–720)
export const CO_TYPE = 24;
export const CO_TYPE_TEXT = "Где моё обращение?";
export const CO_TYPE_CPF = 2.4;
export const CO_TYPE_OUT = 104;
export const CO_WORDS = [
  { w: "ПОЧТА", at: 120 },
  { w: "ЧАТЫ", at: 150 },
  { w: "ЗВОНКИ", at: 180 },
  { w: "КОРИДОР", at: 210 },
] as const;
export const CO_WALL = 240;
export const CO_LOST = 300;
export const CO_REDACT = 348;
export const CO_DROP = 408;
export const CO_DOT = 492;
export const CO_LINE = 520;
export const CO_PIVOT = 548;
export const CO_WIPE = 648;
export const CO_WIPE_DUR = 56;
T.hold("cold-pivot-read", CO_PIVOT + 20, CO_WIPE);

// ---------------------------------------------------------------- ROLES (3420–4020)
export const R0 = 3420;
export const R_TITLE = R0 + 8;
export const R_SUB = R0 + 40;
export const R_CARDS = R0 + 64;
export const R_CARD_STAGGER = 9;
export const R_FOCUS = [R0 + 160, R0 + 250, R0 + 340, R0 + 430] as const;
export const R_ROWS_DELAY = 14;
export const R_ROW_STAGGER = 5;
export const R_OUT = R0 + 528;
export const ROLES = [
  { name: "Сотрудник", scope: "Свои обращения", rows: 1 },
  { name: "Ответственный", scope: "Свои и назначенные ему", rows: 2 },
  { name: "Руководитель", scope: "Обращения подразделения", rows: 4 },
  { name: "Администратор", scope: "Всё, правила и настройки", rows: 6 },
] as const;

// ---------------------------------------------------------------- RECAP (4740–5220)
export const X0 = 4740;
export const X_STEPS = [
  { w: "ОБРАЩЕНИЕ", note: "Номер присвоен сразу", at: X0 + 12 },
  { w: "МАРШРУТ", note: "Ответственный по правилам", at: X0 + 72 },
  { w: "РЕШЕНИЕ", note: "Итог зафиксирован", at: X0 + 132 },
  { w: "АНАЛИТИКА", note: "Видно, что повторяется", at: X0 + 192 },
] as const;
/** Камера едет вдоль слов: слово i лежит в мире на x = i * X_GAP. Ход камеры к слову i: [start, start + X_MOVE]. */
export const X_GAP = 1700;
export const X_MOVE = 38;
export const X_MOVES = [
  { start: 4746, dur: 40 },
  ...[1, 2, 3].map((i) => ({ start: 4806 + (i - 1) * 62, dur: X_MOVE })),
] as const;
export const X_CHAIN = X0 + 252; // отъезд: все четыре шага в одну линию
export const X_TOKEN = X0 + 300; // карточка A-021 едет по линии
export const X_TOKEN_DUR = 120;
export const X_COLLAPSE = X0 + 436;
export const X_FLASH = X0 + 470;

/** Окна быстрого движения новых сцен (motion blur). Старые окна переносятся через remap. */
export const BLUR90: Array<readonly [number, number]> = [
  [CO_WORDS[0].at - 2, CO_WALL + 30],
  [CO_DROP, CO_DROP + 60],
  [CO_WIPE, CO_WIPE + CO_WIPE_DUR],
  [R_CARDS, R_CARDS + 60],
  [R_OUT, 4020],
  [X_CHAIN, X_CHAIN + 50],
  [4746, 4786],
  [4806, 4844],
  [4868, 4906],
  [4930, 4968],
  [X_COLLAPSE, X_FLASH + 10],
];

// ---------------------------------------------------------------- звук: сэмплы
const S = {
  click: ["15-pop-button-scale-transform-ui-9.wav", "07-pop-button-scale-transform-ui.wav", "09-pop-button-scale-transform-ui-28.wav"],
  type: ["14-type-one-1.wav", "19-type-one-2.wav", "06-censor-type-one-3.wav"],
  tick: ["09-pop-button-scale-transform-ui-28.wav", "07-pop-button-scale-transform-ui.wav"],
  pop: ["15-pop-button-scale-transform-ui-9.wav", "07-pop-button-scale-transform-ui.wav", "02-select-gratonal-gleam-4.wav"],
  blip: ["05-select-button-gratonal-shimmer-6.wav", "18-button-select-ui-14.wav"],
  chime: ["26-odobreno-6.wav", "27-odobreno-2.wav", "28-odobreno-10.wav"],
  shimmer: ["04-text-button-gratonal-shimmer-pad-11.wav"],
  whoosh: ["20-deep-mini-whoosh-7.wav", "21-deep-mini-whoosh-8.wav"],
  sweep: ["03-texter-texture-grainy-3.wav"],
  snap: ["29-camera-1.wav"],
} as Partial<Record<CueKind, string[]>>;
const GAIN: Partial<Record<CueKind, number>> = { click: -3, type: -6, tick: -4, pop: -3, blip: -3, chime: -2, shimmer: -6, whoosh: -1, sweep: -6, snap: -3 };

// 1) События 60-секундного ролика по карте монтажа.
const counters: Record<string, number> = {};
for (const c of T60.export().cues) {
  const f = remap(c.frame);
  if (f === null) continue;
  if (c.id === "riser-align" || c.id === "sweep-route") continue; // лишние по просмотру: шум поверх собственных движений сцены
  const pool = S[c.kind];
  const n = (counters[c.kind] = (counters[c.kind] ?? -1) + 1);
  const big = c.kind === "whoosh" && c.intensity >= 0.45;
  T.cue({
    id: c.id,
    kind: c.kind,
    frame: f,
    scores: c.scores,
    dur: c.dur,
    intensity: c.intensity,
    pan: c.pan,
    pitch: c.pitch ?? undefined,
    anchor: c.anchor,
    peak: c.peak,
    brightness: c.brightness,
    ...(pool ? { sample: big ? "32-energy-whoosh-2.wav" : pool[n % pool.length]!, gainDb: GAIN[c.kind] ?? 0 } : {}),
  });
}

// 2) COLD
T.cue({ id: "co-bed", kind: "swell", frame: 0, anchor: "start", dur: 8, scores: "тёмное открытие, напряжение до «Обращения теряются»", sample: "22-musical-downlifters-3.wav", intensity: 0.5, gainDb: -6 });
for (let i = 0, n = 0; i < CO_TYPE_TEXT.length; i += 2, n++) {
  if (CO_TYPE_TEXT[i] === " ") continue;
  T.cue({ id: `co-type-${n}`, kind: "type", frame: CO_TYPE + Math.ceil(i * CO_TYPE_CPF), scores: "печатается «Где моё обращение?»", sample: S.type![n % 2]!, intensity: 0.5 + (n % 3) * 0.06, gainDb: -4, pan: -0.2 + (i / CO_TYPE_TEXT.length) * 0.4 });
}
T.cue({ id: "co-type-out", kind: "whoosh", frame: T.easePeakVelocityFrame(CO_TYPE_OUT, CO_TYPE_OUT + 16, "emphasizedIn"), scores: "вопрос уходит вверх", sample: "20-deep-mini-whoosh-7.wav", intensity: 0.45 });
CO_WORDS.forEach((w, i) =>
  T.cue({ id: `co-word-${i}`, kind: "snap", frame: w.at - 2, scores: `слово ${w.w} врезается в кадр`, sample: ["08-pop-button-scale-transform-ui-3.wav", "15-pop-button-scale-transform-ui-9.wav", "07-pop-button-scale-transform-ui.wav", "29-camera-1.wav"][i]!, intensity: 0.7 + i * 0.07, pan: [-0.3, 0.3, -0.15, 0.15][i]! }),
);
T.cue({ id: "co-wall", kind: "sweep", frame: CO_WALL + 4, anchor: "start", scores: "стена из вопросов заполняет кадр", sample: "03-texter-texture-grainy-3.wav", intensity: 0.5, gainDb: -2 });
T.cue({ id: "co-lost", kind: "thud", frame: T.springArrivalFrame(CO_LOST, "heavy", 0.7), scores: "заголовок «Обращения теряются»", intensity: 0.6 });
T.cue({ id: "co-lost-err", kind: "pop", frame: CO_LOST + 6, scores: "красная черта под заголовком", sample: "12-error-wrong-mistake-1.wav", intensity: 0.55, gainDb: -2 });
[0, 1, 2].forEach((i) =>
  T.cue({ id: `co-redact-${i}`, kind: "type", frame: CO_REDACT + i * 9, scores: `плашка цензуры ${i + 1} закрывает слово`, sample: "06-censor-type-one-3.wav", intensity: 0.55, pan: -0.4 + i * 0.4 }),
);
T.cue({ id: "co-line", kind: "sweep", frame: CO_LINE + 2, anchor: "start", scores: "точка растягивается в линию", sample: "01-ui-analysing-scan-5.wav", intensity: 0.4, gainDb: -6 });
T.cue({ id: "co-pivot", kind: "shimmer", frame: T.springArrivalFrame(CO_PIVOT, "smooth", 0.8), scores: "появляется «Пора навести порядок»", sample: "04-text-button-gratonal-shimmer-pad-11.wav", intensity: 0.5, gainDb: -3 });
T.cue({ id: "co-wipe", kind: "whoosh", frame: T.easePeakVelocityFrame(CO_WIPE, CO_WIPE + CO_WIPE_DUR, "inOutCubic"), scores: "линия стирает кадр, переход к первой сцене", sample: "32-energy-whoosh-2.wav", intensity: 0.65 });

// 3) ROLES
T.cue({ id: "r-in", kind: "whoosh", frame: R0 + 6, scores: "переход к сцене ролей", sample: "21-deep-mini-whoosh-8.wav", intensity: 0.55 });
T.cue({ id: "r-title", kind: "impact", frame: T.springArrivalFrame(R_TITLE, "heavy", 0.7), scores: "заголовок «Каждый видит своё»", intensity: 0.55, brightness: 0.4 });
T.cue({ id: "r-sub", kind: "pop", frame: T.springArrivalFrame(R_SUB, "smooth", 0.8), scores: "подзаголовок о правах на сервере", sample: "02-select-gratonal-gleam-4.wav", intensity: 0.45, gainDb: -3 });
ROLES.forEach((r, i) => {
  T.cue({ id: `r-card-${i}`, kind: "pop", frame: T.springArrivalFrame(R_CARDS + i * R_CARD_STAGGER, "snappy", 0.85), scores: `карточка роли «${r.name}» встаёт в ряд`, sample: S.pop![i % 3]!, intensity: 0.45 + i * 0.04, pan: -0.6 + i * 0.4 });
  T.cue({ id: `r-focus-${i}`, kind: "blip", frame: R_FOCUS[i]!, scores: `камера выделяет роль «${r.name}»`, sample: "05-select-button-gratonal-shimmer-6.wav", intensity: 0.5, pan: -0.45 + i * 0.3 });
  for (let k = 0; k < r.rows; k++)
    T.cue({ id: `r-row-${i}-${k}`, kind: "tick", frame: T.springArrivalFrame(R_FOCUS[i]! + R_ROWS_DELAY + k * R_ROW_STAGGER, "snappy", 0.85), scores: `у роли «${r.name}» открывается строка ${k + 1}`, sample: "09-pop-button-scale-transform-ui-28.wav", intensity: 0.35 + k * 0.04, pan: -0.45 + i * 0.3, gainDb: -4 });
});
T.cue({ id: "r-out", kind: "whoosh", frame: T.easePeakVelocityFrame(R_OUT, 4020, "inCubic"), scores: "камера пролетает сквозь карточки к следующей сцене", sample: "32-energy-whoosh-2.wav", intensity: 0.6 });

// 4) RECAP
X_MOVES.forEach((m, i) => {
  T.cue({ id: `x-move-${i}`, kind: "whoosh", frame: T.easePeakVelocityFrame(m.start, m.start + m.dur, i === 0 ? "outCubic" : "inOutCubic"), scores: `камера едет к слову ${X_STEPS[i]!.w}`, sample: i % 2 ? "21-deep-mini-whoosh-8.wav" : "20-deep-mini-whoosh-7.wav", intensity: 0.42, gainDb: -2 });
  T.cue({ id: `x-word-${i}`, kind: "thud", frame: m.start + m.dur, scores: `камера останавливается на слове ${X_STEPS[i]!.w}`, intensity: 0.35 + i * 0.04 });
});
T.cue({ id: "x-chain", kind: "whoosh", frame: T.easePeakVelocityFrame(X_CHAIN, X_CHAIN + 50, "inOutCubic"), scores: "слова съезжаются в одну линию", sample: "20-deep-mini-whoosh-7.wav", intensity: 0.5 });
[0, 1, 2, 3].forEach((i) =>
  T.cue({ id: `x-node-${i}`, kind: i === 3 ? "chime" : "tick", frame: X_TOKEN + Math.round((i / 3) * X_TOKEN_DUR), scores: `карточка A-021 проходит шаг ${i + 1}`, sample: i === 3 ? "26-odobreno-6.wav" : "09-pop-button-scale-transform-ui-28.wav", intensity: i === 3 ? 0.45 : 0.35, pan: -0.6 + i * 0.4, gainDb: i === 3 ? -3 : -4 }),
);
T.cue({ id: "x-collapse", kind: "whoosh", frame: T.easePeakVelocityFrame(X_COLLAPSE, X_FLASH, "inCubic"), scores: "линия сворачивается в точку", sample: "21-deep-mini-whoosh-8.wav", intensity: 0.5 });
T.hold("final-hold", 5220 + 144, DURATION - 1);
