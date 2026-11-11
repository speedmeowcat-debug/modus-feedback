/**
 * Единственный источник времени ролика: монтаж, движение и звук читают эти константы.
 * 1920x1080, 60 fps, 3600 кадров (ровно 60 секунд).
 *
 * Музыка: 120 BPM = 30 кадров на долю, такт = 120 кадров (2 с). Первый такт начинается
 * на кадре 60, поэтому границы сцен 7, 13, 35, 45, 53 и 57 секунд совпадают с тактовыми чертами.
 * Каждый звук привязан к видимому событию (поле scores) и его кадр выведен из движения.
 */
import { createTimeline } from "../core";

export const FPS = 60;
export const W = 1920;
export const H = 1080;
export const DURATION = 3600;

export const T = createTimeline({
  id: "modus-feedback-film",
  fps: FPS,
  width: W,
  height: H,
  durationInFrames: DURATION,
  music: {
    bpm: 120,
    key: "D",
    mode: "major",
    startFrame: 60,
    bars: 30,
    // Проблема на минорных ступенях, решение разрешается в тонику.
    progression: [6, 4, 5, 1, 5, 6, 4, 1, 5, 6, 4, 5, 1, 5, 6, 4, 5, 1, 5, 6, 4, 5, 1, 6, 4, 5, 6, 4, 1, 1],
    layers: { pad: 0.85, bass: 0.55, arp: 0.45, kick: 0.42, hat: 0.3, clap: 0.18, pulse: 0.35 },
    arc: [
      { bar: 0, energy: 0.22 },
      { bar: 3, energy: 0.5 },
      { bar: 6, energy: 0.62 },
      { bar: 12, energy: 0.78 },
      { bar: 17, energy: 0.9 },
      { bar: 22, energy: 1.0 },
      { bar: 26, energy: 0.55 },
      { bar: 28, energy: 0.3 },
    ],
    seed: 7,
  },
  mix: { targetLufs: -14, truePeakDb: -1.5, musicDb: -9, fadeIn: 0.05, fadeOut: 0.6 },
});

// ---------------------------------------------------------------- сцены
export const SCENE = {
  problem: [0, 420],
  solution: [420, 780],
  create: [780, 1440],
  workflow: [1440, 2100],
  analytics: [2100, 2700],
  impact: [2700, 3180],
  evolve: [3180, 3420],
  final: [3420, 3600],
} as const;
for (const [id, [a]] of Object.entries(SCENE)) T.event(`scene-${id}`, a);

// ---------------------------------------------------------------- 1. Проблема (0–7 с)
export const P_MSG = [
  { at: 16, text: "Не работает оборудование", who: "Сотрудник проектирования", x: 0, y: 0, z: 0 },
  { at: 96, text: "Есть предложение по улучшению", who: "Менеджер по продажам", x: -470, y: -270, z: -260 },
  { at: 146, text: "К кому обратиться?", who: "Сотрудник бухгалтерии", x: 560, y: -190, z: -160 },
  { at: 190, text: "Когда будет ответ?", who: "Координатор проекта", x: -470, y: 280, z: -120 },
] as const;
// Фоновые сообщения: темы из демонстрационного датасета.
export const P_SWARM = [
  { at: 214, text: "Где актуальная версия инструкции?", x: 760, y: 300, z: -700 },
  { at: 224, text: "Кто проверяет приложение к договору?", x: -980, y: -40, z: -820 },
  { at: 234, text: "Заявку снова вернули на уточнение", x: 300, y: -470, z: -900 },
  { at: 244, text: "Нет срока ответа от смежных отделов", x: 380, y: -600, z: -760 },
  { at: 254, text: "Повторный ввод одних и тех же данных", x: 1040, y: -420, z: -1000 },
  { at: 264, text: "Предлагаю единый шаблон задачи", x: -1080, y: 420, z: -980 },
] as const;
export const P_CAM_START = 24;
export const P_CAM_END = 400;
export const P_PHRASE = 292;
export const P_FOCUS = 330; // остальные сообщения уходят в тень, первое остаётся точкой перехода

// ---------------------------------------------------------------- 2. Решение (7–13 с)
export const S_ALIGN = 424; // сообщения начинают собираться в структуру
export const S_ALIGN_STAGGER = 7;
export const S_CAM_END = 560;
export const S_TITLE = 548;
export const S_SUB = 590;
export const S_EXIT = 704; // заголовок уходит, фон светлеет, список становится интерфейсом
export const S_LIGHT = 712;

// ---------------------------------------------------------------- 3. Создание обращения (13–24 с)
export const C_APP_IN = 744; // интерфейс проявляется из списка
export const C_CURSOR_IN = 800;
export const C_CLICK_NEW = 860;
export const C_FORM = 870;
export const C_CLICK_TYPE = 944;
export const C_CLICK_CAT = 986;
export const C_MENU_PICK = 1022;
export const C_TITLE_TYPE = 1034;
export const C_TITLE_TEXT = "Счета поставщиков приходят без номера заявки";
export const C_TITLE_CPF = 1.5; // кадров на символ
export const C_DESC_TYPE = 1122;
export const C_DESC_TEXT =
  "Бухгалтерия передаёт нам счета поставщиков без номера внутренней заявки. Заявку приходится искать вручную, на каждый счёт уходит до 15 минут.";
export const C_DESC_CPF = 0.62;
export const C_CLICK_FILE = 1236;
export const C_FILE_IN = 1244;
export const C_CLICK_SUBMIT = 1282;
export const C_CREATED = 1312;
export const C_LIFT = 1396; // карточка обращения отделяется от интерфейса

export const typedChars = (f: number, start: number, cpf: number, total: number) =>
  Math.max(0, Math.min(total, Math.floor((f - start) / cpf)));
export const typingEnd = (start: number, cpf: number, total: number) => start + Math.ceil(total * cpf);

// ---------------------------------------------------------------- 4. Рассмотрение (24–35 с)
export const W_STEPPER = 1452;
export const W_ROUTE = 1500; // линия маршрутизации
export const W_ROUTE_DUR = 56;
export const W_RULE = 1520;
export const W_ASSIGN = 1562;
export const W_DUE = 1584;
export const W_REVIEW = 1640; // Новое -> На рассмотрении
export const W_WORK = 1730; // -> В работе
export const W_COMMENT = 1790;
export const W_DONE = 1860; // -> Реализовано
export const W_RESULT = 1872;
export const W_OUT = 2040;

// ---------------------------------------------------------------- 5. Контроль и аналитика (35–45 с)
export const A_LAND = 2172; // карточка встаёт в строку «Реализовано»
export const A_KPI = 2236;
export const A_KPI_STAGGER = 14;
export const A_KPI_DUR = 54;
export const A_BARS = 2316;
export const A_BARS_STAGGER = 12;
export const A_STATUS = 2236;
export const A_ACCENT1 = 2424; // доля завершённых
export const A_ACCENT2 = 2504; // повторяющаяся проблема
export const A_ACCENT3 = 2584; // просрочки
export const A_OUT = 2652;

// ---------------------------------------------------------------- 6. Ценность (45–53 с)
export const I_GROUPS = [
  { word: "ПРОЗРАЧНОСТЬ", at: 2700, move: 2852 },
  { word: "КОНТРОЛЬ", at: 2862, move: 3012 },
  { word: "РЕЗУЛЬТАТ", at: 3022, move: 3180 },
] as const;
export const I_MOVE_DUR = 40;

// ---------------------------------------------------------------- 7. Развитие (53–57 с)
export const E_CORE = 3178;
export const E_MODULES = 3224;
export const E_MODULE_STAGGER = 9;
export const E_PLANNED = 3316;
export const E_LABEL = 3332;

// ---------------------------------------------------------------- 8. Финал (57–60 с)
export const F_OUT = 3420;
export const F_TITLE = 3444;
export const F_SLOGAN = 3490;
export const F_MARK = 3520;
export const F_HOLD = 3564;

/** Окна быстрого движения: только в них включается многосэмпловый motion blur. */
export const BLUR_WINDOWS: ReadonlyArray<readonly [number, number]> = [
  [S_ALIGN, S_CAM_END],
  [S_EXIT, 800],
  [C_CLICK_NEW + 4, C_FORM + 70],
  [C_CREATED - 4, C_CREATED + 40],
  [C_LIFT, W_STEPPER + 40],
  [W_OUT, A_LAND + 20],
  [A_OUT, 2740],
  [I_GROUPS[0].move, I_GROUPS[0].move + I_MOVE_DUR],
  [I_GROUPS[1].move, I_GROUPS[1].move + I_MOVE_DUR],
  [3170, E_CORE + 30],
  [F_OUT, F_TITLE + 6],
];

// ---------------------------------------------------------------- звук
// 1. Проблема
P_MSG.forEach((m, i) =>
  T.cue({
    id: `pop-msg-${i}`,
    kind: i === 0 ? "thud" : "pop",
    frame: T.springArrivalFrame(m.at, "snappy", 0.85),
    scores: `сообщение «${m.text}» появляется`,
    intensity: 0.42 + i * 0.05,
    brightness: 0.45,
    pan: Math.max(-0.7, Math.min(0.7, m.x / 900)),
    pitch: (["root", "third", "fifth", "third"] as const)[i],
  }),
);
P_SWARM.forEach((m, i) =>
  T.cue({
    id: `tick-swarm-${i}`,
    kind: "tick",
    frame: T.springArrivalFrame(m.at, "snappy", 0.85),
    scores: "фоновое сообщение появляется в глубине кадра",
    intensity: 0.16 + i * 0.025,
    brightness: 0.4,
    pan: Math.max(-0.8, Math.min(0.8, m.x / 1100)),
  }),
);
T.cue({
  id: "swell-phrase",
  kind: "swell",
  dur: 1.4,
  peak: 0.5,
  frame: T.springArrivalFrame(P_PHRASE, "smooth", 0.6),
  scores: "появляется фраза «Каждое обращение важно»",
  intensity: 0.35,
  brightness: 0.35,
});
T.cue({
  id: "riser-align",
  kind: "riser",
  dur: 1.6,
  frame: S_ALIGN + 8,
  scores: "напряжение до момента, когда сообщения начинают собираться",
  intensity: 0.4,
});

// 2. Решение
T.cue({
  id: "whoosh-align",
  kind: "whoosh",
  dur: 1.1,
  peak: 0.45,
  frame: T.easePeakVelocityFrame(S_ALIGN, S_CAM_END, "inOutCubic"),
  scores: "камера проходит сквозь сообщения, они выстраиваются в список",
  intensity: 0.55,
  brightness: 0.45,
});
T.cue({
  id: "impact-title",
  kind: "impact",
  frame: T.springArrivalFrame(S_TITLE, "heavy", 0.7),
  scores: "заголовок MODUS FEEDBACK встаёт на место",
  intensity: 0.6,
  brightness: 0.35,
  pan: -0.35,
});
T.cue({
  id: "pop-sub",
  kind: "pop",
  frame: T.springArrivalFrame(S_SUB, "smooth", 0.8),
  scores: "подзаголовок появляется под названием",
  intensity: 0.3,
  pan: -0.35,
  pitch: "fifth",
});
T.cue({
  id: "sweep-light",
  kind: "sweep",
  dur: 0.9,
  frame: T.easePeakVelocityFrame(S_LIGHT, S_LIGHT + 70, "inOutCubic"),
  scores: "фон светлеет, список превращается в интерфейс",
  intensity: 0.45,
  brightness: 0.75,
});

// 3. Создание обращения
const cursorWhoosh = (id: string, from: number, to: number, scores: string, pan = 0) =>
  T.cue({
    id,
    kind: "whoosh",
    dur: 0.35,
    peak: 0.5,
    frame: T.easePeakVelocityFrame(from, to, "inOutCubic"),
    scores,
    intensity: 0.14,
    brightness: 0.7,
    pan,
  });
cursorWhoosh("whoosh-cursor-new", C_CURSOR_IN + 14, C_CLICK_NEW - 4, "курсор идёт к кнопке «Новое обращение»", -0.4);
T.cue({ id: "click-new", kind: "click", frame: C_CLICK_NEW, scores: "нажатие «Новое обращение»", intensity: 0.5, pan: -0.5 });
T.cue({
  id: "whoosh-form",
  kind: "whoosh",
  dur: 0.6,
  peak: 0.45,
  frame: T.easePeakVelocityFrame(C_FORM, C_FORM + 64, "inOutCubic"),
  scores: "открывается форма, камера приближается к ней",
  intensity: 0.35,
  brightness: 0.55,
});
T.cue({ id: "click-type", kind: "click", frame: C_CLICK_TYPE, scores: "выбран тип «Проблема»", intensity: 0.42 });
T.cue({ id: "click-cat", kind: "click", frame: C_CLICK_CAT, scores: "открывается список категорий", intensity: 0.42 });
T.cue({
  id: "pop-menu",
  kind: "pop",
  frame: C_CLICK_CAT + 4,
  scores: "появляется список категорий",
  intensity: 0.28,
  pitch: "third",
});
T.cue({
  id: "click-pick",
  kind: "click",
  frame: C_MENU_PICK,
  scores: "выбрана категория «Межотдельное взаимодействие»",
  intensity: 0.45,
});
for (let i = 0, n = 0; i < C_TITLE_TEXT.length; i += 5, n++) {
  T.cue({
    id: `type-title-${n}`,
    kind: "type",
    frame: C_TITLE_TYPE + Math.ceil(i * C_TITLE_CPF),
    scores: "вводится заголовок обращения",
    intensity: 0.2 + (n % 3) * 0.04,
    pan: -0.1 + (n % 4) * 0.06,
  });
}
for (let i = 0, n = 0; i < C_DESC_TEXT.length; i += 9, n++) {
  T.cue({
    id: `type-desc-${n}`,
    kind: "type",
    frame: C_DESC_TYPE + Math.ceil(i * C_DESC_CPF),
    scores: "вводится описание проблемы",
    intensity: 0.17 + (n % 3) * 0.04,
    pan: -0.15 + (n % 5) * 0.07,
  });
}
T.cue({ id: "click-file", kind: "click", frame: C_CLICK_FILE, scores: "нажатие «Выбрать файл»", intensity: 0.42 });
T.cue({
  id: "pop-file",
  kind: "pop",
  frame: T.springArrivalFrame(C_FILE_IN, "snappy", 0.85),
  scores: "появляется прикреплённый файл",
  intensity: 0.38,
  pitch: "fifth",
});
T.cue({ id: "click-submit", kind: "click", frame: C_CLICK_SUBMIT, scores: "нажатие «Отправить обращение»", intensity: 0.6 });
T.cue({
  id: "chime-created",
  kind: "chime",
  frame: C_CREATED + 6,
  scores: "обращение A-021 зарегистрировано",
  intensity: 0.5,
  pitch: "third",
});

// 4. Рассмотрение
T.cue({
  id: "whoosh-lift",
  kind: "whoosh",
  dur: 0.8,
  peak: 0.45,
  frame: T.easePeakVelocityFrame(C_LIFT, W_STEPPER + 30, "inOutCubic"),
  scores: "карточка обращения отделяется от интерфейса, камера следует за ней",
  intensity: 0.45,
  brightness: 0.5,
});
T.cue({
  id: "sweep-route",
  kind: "sweep",
  dur: W_ROUTE_DUR / FPS,
  frame: W_ROUTE + Math.round(W_ROUTE_DUR / 2),
  scores: "линия маршрутизации идёт от категории к правилу",
  intensity: 0.35,
  brightness: 0.65,
  pan: -0.3,
});
T.cue({
  id: "pop-rule",
  kind: "pop",
  frame: T.springArrivalFrame(W_RULE, "snappy", 0.85),
  scores: "появляется правило маршрутизации",
  intensity: 0.36,
  pan: -0.35,
  pitch: "root",
});
T.cue({
  id: "blip-assign",
  kind: "blip",
  frame: W_ASSIGN,
  scores: "назначен ответственный: Руководитель закупок",
  intensity: 0.45,
  pitch: "third",
});
T.cue({ id: "tick-due", kind: "tick", frame: W_DUE, scores: "появляется срок рассмотрения", intensity: 0.32, pitch: "fifth" });
(
  [
    [W_REVIEW, "статус меняется на «На рассмотрении»", "fifth"],
    [W_WORK, "статус меняется на «В работе»", "octave"],
  ] as const
).forEach(([f, s, p], i) =>
  T.cue({ id: `blip-status-${i}`, kind: "blip", frame: f, scores: s, intensity: 0.48 + i * 0.05, pitch: p }),
);
T.cue({
  id: "pop-comment",
  kind: "pop",
  frame: T.springArrivalFrame(W_COMMENT, "snappy", 0.85),
  scores: "в истории появляется комментарий ответственного",
  intensity: 0.3,
  pan: 0.4,
});
T.cue({
  id: "chime-done",
  kind: "chime",
  frame: W_DONE + 4,
  scores: "статус «Реализовано»",
  intensity: 0.6,
  pitch: "root",
});
T.cue({
  id: "shimmer-result",
  kind: "shimmer",
  frame: T.springArrivalFrame(W_RESULT, "smooth", 0.8),
  scores: "появляется итог рассмотрения",
  intensity: 0.32,
  pitch: "fifth",
});

// 5. Аналитика
T.cue({
  id: "whoosh-shrink",
  kind: "whoosh",
  dur: 1.0,
  peak: 0.5,
  frame: T.easePeakVelocityFrame(W_OUT, A_LAND, "inOutCubic"),
  scores: "карточка уменьшается и летит в панель аналитики",
  intensity: 0.45,
  brightness: 0.45,
});
T.cue({
  id: "thud-land",
  kind: "thud",
  frame: A_LAND,
  scores: "карточка встаёт в строку «Реализовано», счётчик 2 → 3",
  intensity: 0.45,
});
for (let i = 0; i < 4; i++) {
  T.cue({
    id: `tick-kpi-${i}`,
    kind: "tick",
    frame: A_KPI + i * A_KPI_STAGGER + A_KPI_DUR,
    scores: `показатель ${i + 1} досчитывает до значения`,
    intensity: 0.3 + i * 0.04,
    pitch: (["root", "third", "fifth", "octave"] as const)[i],
    pan: -0.6 + i * 0.4,
  });
}
for (let i = 0; i < 3; i++) {
  T.cue({
    id: `tick-bar-${i}`,
    kind: "tick",
    frame: T.springArrivalFrame(A_BARS + i * A_BARS_STAGGER, "smooth", 0.85),
    scores: `столбец «по типам» ${i + 1} достигает значения`,
    intensity: 0.26 + i * 0.05,
    pitch: (["third", "fifth", "octave"] as const)[i],
    pan: -0.3,
  });
}
(
  [
    [A_ACCENT1, "камера выделяет долю завершённых обращений"],
    [A_ACCENT2, "камера выделяет повторяющуюся проблему в категории"],
    [A_ACCENT3, "камера выделяет просроченные обращения"],
  ] as const
).forEach(([f, s], i) =>
  T.cue({
    id: `whoosh-accent-${i}`,
    kind: "whoosh",
    dur: 0.6,
    peak: 0.5,
    frame: T.easePeakVelocityFrame(f - 30, f + 10, "inOutCubic"),
    scores: s,
    intensity: 0.26,
    brightness: 0.55,
  }),
);

// 6. Ценность
I_GROUPS.forEach((g, i) => {
  T.cue({
    id: `impact-word-${i}`,
    kind: i === 0 ? "impact" : "thud",
    frame: T.springArrivalFrame(g.at + (i === 0 ? 14 : 4), "heavy", 0.7),
    scores: `слово ${g.word} встаёт на место`,
    intensity: 0.5 + i * 0.05,
    brightness: 0.4,
    pan: -0.4,
  });
  if (i < 2)
    T.cue({
      id: `whoosh-truck-${i}`,
      kind: "whoosh",
      dur: 0.6,
      peak: 0.5,
      frame: T.easePeakVelocityFrame(g.move, g.move + I_MOVE_DUR, "inOutCubic"),
      scores: "камера переезжает к следующему понятию",
      intensity: 0.42,
      brightness: 0.5,
    });
});

// 7. Развитие
T.cue({
  id: "whoosh-pullback",
  kind: "whoosh",
  dur: 0.7,
  peak: 0.5,
  frame: T.easePeakVelocityFrame(3170, E_CORE + 24, "inOutCubic"),
  scores: "камера отъезжает, интерфейс собирается в ядро системы",
  intensity: 0.45,
  brightness: 0.4,
});
for (let i = 0; i < 7; i++) {
  T.cue({
    id: `pop-module-${i}`,
    kind: "pop",
    frame: T.springArrivalFrame(E_MODULES + i * E_MODULE_STAGGER, "snappy", 0.85),
    scores: `модуль ${i + 1} из 7 занимает место вокруг ядра`,
    intensity: 0.22 + i * 0.025,
    pitch: (["root", "third", "fifth", "octave", "fifth", "third", "octave"] as const)[i],
    pan: Math.sin((i / 7) * Math.PI * 2) * 0.6,
  });
}
T.cue({
  id: "sweep-planned",
  kind: "sweep",
  dur: 0.6,
  frame: E_PLANNED + 18,
  scores: "пунктиром проявляются планируемые интеграции",
  intensity: 0.25,
  brightness: 0.6,
  pan: 0.5,
});

// 8. Финал
T.cue({
  id: "whoosh-out",
  kind: "whoosh",
  dur: 0.5,
  peak: 0.45,
  frame: T.easePeakVelocityFrame(F_OUT, F_OUT + 34, "emphasizedIn"),
  scores: "элементы уходят из кадра",
  intensity: 0.38,
});
T.cue({
  id: "impact-final",
  kind: "impact",
  frame: T.springArrivalFrame(F_TITLE, "heavy", 0.7),
  scores: "финальный заголовок MODUS FEEDBACK",
  intensity: 0.72,
  brightness: 0.3,
});
T.cue({
  id: "shimmer-slogan",
  kind: "shimmer",
  frame: T.springArrivalFrame(F_SLOGAN, "smooth", 0.8),
  scores: "появляется слоган «От обращения — к решению»",
  intensity: 0.3,
  pitch: "third",
});
T.hold("final-hold", F_HOLD, DURATION - 1);
