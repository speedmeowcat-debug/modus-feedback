// Сцены 3–5 в одном мире: окно приложения → карточка обращения и процесс → панель аналитики.
// Мир измеряется в пикселях интерфейса; левый верхний угол окна сотрудника — (0, 0).

import { At, Cursor, Stage, breathe, camTrack, cam0, clamp, cursorAt, ev, lerp, out, sp, type Cam, type CamKey } from "../lib";
import {
  A_ACCENT1,
  A_ACCENT2,
  A_ACCENT3,
  A_BARS,
  A_BARS_STAGGER,
  A_KPI,
  A_KPI_DUR,
  A_KPI_STAGGER,
  A_LAND,
  A_OUT,
  C_APP_IN,
  C_CLICK_CAT,
  C_CLICK_FILE,
  C_CLICK_NEW,
  C_CLICK_SUBMIT,
  C_CLICK_TYPE,
  C_CREATED,
  C_CURSOR_IN,
  C_DESC_CPF,
  C_DESC_TEXT,
  C_DESC_TYPE,
  C_FILE_IN,
  C_FORM,
  C_LIFT,
  C_MENU_PICK,
  C_TITLE_CPF,
  C_TITLE_TEXT,
  C_TITLE_TYPE,
  W_ASSIGN,
  W_COMMENT,
  W_DONE,
  W_DUE,
  W_OUT,
  W_RESULT,
  W_REVIEW,
  W_ROUTE,
  W_ROUTE_DUR,
  W_RULE,
  W_STEPPER,
  W_WORK,
  typedChars,
  typingEnd,
} from "../timeline";
import { AnalyticsPage, statusRowCenter } from "../ui/analytics";
import {
  AppFrame,
  CL,
  CT,
  EMPLOYEE_NAV,
  HEAD,
  LIST_ROW_H,
  LIST_ROW_TOP,
  MY_ROWS,
  MyListPage,
  NewTicketPage,
  Sidebar,
  TicketCreatedPage,
  type FormState,
} from "../ui/app";
import { HeroCard, HistoryCard, ResultCard, RuleCard, Stepper, type HistItem } from "../ui/workflow";

// ---------------------------------------------------------------- геометрия
export const PRODUCT_CAM_START: Cam = { ...cam0, x: 800, y: 500, s: 1 };
export const LIST_ROW_CENTER = (i: number) => ({ x: CL + 580, y: CT + LIST_ROW_TOP + LIST_ROW_H * i + LIST_ROW_H / 2 });
/** Точка мира → смещение от центра кадра (для плоской камеры). */
export const appToScreen = (cam: Cam, p: { x: number; y: number }) => ({ x: (p.x - cam.x) * cam.s, y: (p.y - cam.y) * cam.s });

// Ключевые точки формы (координаты окна, до прокрутки)
const PT = {
  newBtn: { x: 124, y: 88 },
  typeProblem: { x: 697, y: 268 },
  category: { x: 746, y: 396 },
  menuPick: { x: 720, y: 580 },
  title: { x: 924, y: 545 },
  file: { x: 663, y: 1004 },
  submit: { x: 693, y: 1160 },
};
const SCROLL_DESC = 140;
const SCROLL_END = 280;

// Мир процесса: карточка вырастает из заголовка страницы обращения
const HERO = { x: HEAD.x - 24, y: HEAD.y - 24 }; // левый верхний угол карточки
const HERO_C = { x: HERO.x + 380, y: HERO.y + 140 };
const STEPPER = { x: HERO.x + 0, y: HERO.y - 96 };
const RULE = { x: HERO.x - 580, y: HERO.y + 96 };
const HISTORY = { x: HERO.x + 800, y: HERO.y - 96 };
const RESULT = { x: HERO.x, y: HERO.y + 324 };
// Панель аналитики справа от процесса
const ADMIN = { x: 1900, y: -150 };
const LAND = (() => {
  const c = statusRowCenter("implemented");
  return { x: ADMIN.x + c.x, y: ADMIN.y + c.y };
})();
const adminPt = (x: number, y: number) => ({ x: ADMIN.x + x, y: ADMIN.y + y });

// ---------------------------------------------------------------- камера
const CAM_KEYS: CamKey[] = [
  // сцена 3: интерфейс и форма
  { at: 800, dur: 60, to: { x: 560, y: 360, s: 1.22 } },
  { at: C_FORM + 4, dur: 64, to: { x: 900, y: 330, s: 1.62 } },
  { at: C_CLICK_TYPE + 8, dur: 36, to: { x: 820, y: 420, s: 1.78 } },
  { at: C_MENU_PICK + 2, dur: 30, to: { x: 924, y: 545, s: 1.85 } },
  { at: 1102, dur: 38, to: { x: 924, y: 600 - 30, s: 1.74 } },
  { at: 1200, dur: 40, to: { x: 860, y: 655, s: 1.58 } },
  { at: C_CREATED, dur: 46, to: { x: 640, y: 150, s: 2.0 } },
  // сцена 4: карточка отделяется, камера следует за процессом
  { at: C_LIFT, dur: 70, to: { x: HERO_C.x - 60, y: HERO_C.y - 40, s: 1.32, rx: 4, ry: -5 } },
  { at: W_ROUTE - 10, dur: 60, to: { x: HERO.x + 60, y: HERO_C.y + 30, s: 1.36, rx: 2, ry: 6 } },
  { at: W_REVIEW - 30, dur: 50, to: { x: HERO_C.x, y: HERO_C.y - 70, s: 1.42, rx: 3, ry: -2 } },
  { at: W_COMMENT - 40, dur: 54, to: { x: HISTORY.x + 120, y: HERO_C.y + 40, s: 1.3, rx: 2, ry: -8 } },
  { at: W_DONE - 12, dur: 56, to: { x: HERO_C.x + 160, y: HERO_C.y + 110, s: 1.3, rx: 3, ry: 4 } },
  { at: W_RESULT + 70, dur: 90, to: { x: HERO_C.x + 140, y: HERO_C.y + 90, s: 1.0, rx: 6, ry: 9 } },
  // сцена 5: карточка летит в аналитику, камера отъезжает и раскрывает панель
  { at: W_OUT, dur: A_LAND - W_OUT, to: { x: LAND.x - 120, y: LAND.y - 60, s: 1.3, rx: 0, ry: 0 } },
  { at: A_LAND + 6, dur: 110, to: { x: ADMIN.x + 800, y: ADMIN.y + 500, s: 1.1 } },
  { at: A_ACCENT1 - 30, dur: 40, to: { ...adminPt(779, 250), s: 1.95 } },
  { at: A_ACCENT2 - 30, dur: 40, to: { ...adminPt(700, 836), s: 1.62 } },
  { at: A_ACCENT3 - 30, dur: 40, to: { ...adminPt(1359, 250), s: 1.95 } },
  { at: A_OUT - 20, dur: 90, to: { ...adminPt(860, 520), s: 0.92, ry: 10, rx: 4 } },
];
export const productCam = (f: number) => camTrack(f, PRODUCT_CAM_START, CAM_KEYS);
// Дыхание включается после передачи кадра из сцены 2, чтобы строки совпали точно.
const liveCam = (f: number) => breathe(f, productCam(f), ev(f, 800, 60));

// ---------------------------------------------------------------- курсор (координаты мира)
const CURSOR = [
  { at: C_CURSOR_IN, x: 1020, y: 640 },
  { at: C_CLICK_NEW - 4, ...PT.newBtn, dur: 46 },
  { at: C_CLICK_TYPE - 6, ...PT.typeProblem, dur: 50 },
  { at: C_CLICK_CAT - 6, ...PT.category, dur: 34 },
  { at: C_MENU_PICK - 6, ...PT.menuPick, dur: 26 },
  { at: C_TITLE_TYPE - 6, ...PT.title, dur: 20 },
  { at: C_CLICK_FILE - 6, x: PT.file.x, y: PT.file.y - SCROLL_END, dur: 30 },
  { at: C_CLICK_SUBMIT - 6, x: PT.submit.x, y: PT.submit.y - SCROLL_END, dur: 34 },
];
const CLICKS = [C_CLICK_NEW, C_CLICK_TYPE, C_CLICK_CAT, C_MENU_PICK, C_TITLE_TYPE - 4, C_CLICK_FILE, C_CLICK_SUBMIT];
const press = (f: number, c: number) => (f >= c - 2 && f < c + 8 ? 1 - Math.abs(f - c - 1) / 7 : 0);

const HISTORY_ITEMS: HistItem[] = [
  { at: W_STEPPER + 4, title: "Обращение создано", meta: "Сотрудник закупок · 11 нояб. 10:42", tone: "system" },
  { at: W_ASSIGN, title: "Назначен ответственный: Руководитель закупок", meta: "Система · По правилу маршрутизации (категория)", tone: "system" },
  { at: W_REVIEW + 4, title: "Статус: Новое → На рассмотрении", meta: "Руководитель закупок · 11 нояб. 11:05", tone: "status" },
  { at: W_WORK + 4, title: "Статус: На рассмотрении → В работе", meta: "Руководитель закупок · 12 нояб. 09:30", tone: "status" },
  { at: W_COMMENT, title: "Комментарий", meta: "Руководитель закупок · 12 нояб. 09:32", quote: "Добавим номер заявки в шаблон запроса.", tone: "speech" },
  { at: W_DONE + 4, title: "Статус: В работе → Реализовано", meta: "Руководитель закупок · 18 нояб. 15:20", tone: "status" },
];

/** Линия маршрутизации: категория в карточке → правило → ответственный. */
function RouteLines({ p }: { p: number }) {
  if (p <= 0) return null;
  const a = { x: HERO.x + 24, y: HERO.y + 152 };
  const r = { x: RULE.x + 520, y: RULE.y + 46 };
  const b = { x: HERO.x + 24, y: HERO.y + 186 };
  const d1 = `M ${a.x} ${a.y} C ${a.x - 40} ${a.y}, ${r.x + 40} ${r.y - 10}, ${r.x} ${r.y - 10}`;
  const d2 = `M ${r.x} ${r.y + 14} C ${r.x + 40} ${r.y + 14}, ${b.x - 40} ${b.y}, ${b.x} ${b.y}`;
  const p1 = clamp(p * 2);
  const p2 = clamp(p * 2 - 1);
  return (
    <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} width={1} height={1}>
      <path d={d1} fill="none" stroke="var(--color-accent)" strokeWidth={2.5} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p1} strokeLinecap="round" />
      <path d={d2} fill="none" stroke="var(--color-accent)" strokeWidth={2.5} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p2} strokeLinecap="round" />
      {p1 > 0.98 && <circle cx={r.x} cy={r.y - 10} r={4.5} fill="var(--color-accent)" />}
      {p2 > 0.98 && <circle cx={b.x} cy={b.y} r={4.5} fill="var(--color-accent)" />}
    </svg>
  );
}

export function Product({ f }: { f: number }) {
  if (f < C_APP_IN || f > 2760) return null;
  const cam = liveCam(f);

  // ---- сцена 3: окно сотрудника
  const appIn = ev(f, C_APP_IN, 40, "inOutCubic");
  const page = f < C_FORM + 12 ? "list" : f < C_CREATED ? "form" : "ticket";
  // Форма и страница обращения перекрываются на несколько кадров, без пустого кадра между ними.
  const showForm = (f >= C_FORM && f < C_CREATED) || (f >= C_CREATED && f < C_CREATED + 10);
  const showTicket = f >= C_CREATED - 4;
  const formIn = ev(f, C_FORM, 26, "outCubic");
  const ticketIn = ev(f, C_CREATED - 4, 22, "outCubic");
  const titleEnd = typingEnd(C_TITLE_TYPE, C_TITLE_CPF, C_TITLE_TEXT.length);
  const descEnd = typingEnd(C_DESC_TYPE, C_DESC_CPF, C_DESC_TEXT.length);
  const scroll = page === "list" ? 0 : (lerp(0, SCROLL_DESC, ev(f, 1102, 38)) + (SCROLL_END - SCROLL_DESC) * ev(f, 1200, 40)) * (1 - ev(f, C_CREATED - 4, 24));
  const form: FormState = {
    typeOn: press(f, C_CLICK_TYPE),
    catFocused: f >= C_CLICK_CAT && f < C_MENU_PICK + 6,
    menuOpen: f >= C_CLICK_CAT ? ev(f, C_CLICK_CAT, 10, "outCubic") * out(f, C_MENU_PICK + 2, 8) : 0,
    menuHover: lerp(0, 4, ev(f, C_CLICK_CAT + 8, 24)),
    category: f >= C_MENU_PICK + 2 ? "Межотдельное взаимодействие" : undefined,
    title: C_TITLE_TEXT.slice(0, typedChars(f, C_TITLE_TYPE, C_TITLE_CPF, C_TITLE_TEXT.length)),
    titleFocused: f >= C_TITLE_TYPE - 4 && f < titleEnd + 14,
    desc: C_DESC_TEXT.slice(0, typedChars(f, C_DESC_TYPE, C_DESC_CPF, C_DESC_TEXT.length)),
    descFocused: f >= titleEnd + 14 && f < descEnd + 30,
    caret: Math.floor(f / 30) % 2 === 0 || (f >= C_TITLE_TYPE && f <= descEnd),
    file: sp(f, C_FILE_IN, "snappy"),
    pressFile: press(f, C_CLICK_FILE),
    pressSubmit: press(f, C_CLICK_SUBMIT),
    submitting: f >= C_CLICK_SUBMIT + 2 && f < C_CREATED + 12,
  };
  const cur = cursorAt(f, CURSOR);
  const cursorO = ev(f, C_CURSOR_IN, 12) * out(f, C_TITLE_TYPE + 4, 12) + ev(f, descEnd + 4, 14) * out(f, C_CLICK_SUBMIT + 14, 14);

  // ---- сцена 4: процесс
  const lift = ev(f, C_LIFT, 50, "inOutCubic");
  const appO = appIn * (1 - ev(f, C_LIFT + 6, 50));
  const stage =
    ev(f, W_REVIEW, 16) + ev(f, W_WORK, 16) + ev(f, W_DONE, 16); // 0..3: Новое → … → Реализовано
  const toAdmin = ev(f, W_OUT, A_LAND - W_OUT, "inOutCubic");
  const clusterO = out(f, W_OUT, 40); // окружение карточки уходит, карточка летит дальше
  const heroO = f < C_LIFT ? 0 : 1 - ev(f, A_LAND - 8, 10);
  const heroPos = { x: lerp(HERO.x, LAND.x - 380 * 0.16, toAdmin), y: lerp(HERO.y, LAND.y - 140 * 0.16, toAdmin) };
  const heroScale = lerp(1, 0.16, toAdmin);

  // ---- сцена 5: аналитика
  const adminO = ev(f, W_OUT + 20, 70) * out(f, A_OUT + 10, 60);
  const accentWin = (at: number) => ev(f, at - 10, 20) * out(f, at + 56, 16);

  return (
    <div style={{ position: "absolute", inset: 0, opacity: out(f, A_OUT + 30, 60) }}>
      <Stage cam={cam} perspective={2200}>
        {/* окно сотрудника */}
        <At x={0} y={0} o={appO} origin="topleft" blur={lift * 6}>
          <AppFrame scroll={scroll} sidebar={<Sidebar items={EMPLOYEE_NAV} active="my" user="Сотрудник закупок" role="Сотрудник · Закупки" pressNew={press(f, C_CLICK_NEW)} />}>
            {page === "list" && (
              <div style={{ opacity: 1 - ev(f, C_FORM, 12) }}>
                <MyListPage rows={MY_ROWS} rowsOpacity={ev(f, 772, 14)} />
              </div>
            )}
            {showForm && (
              <div style={{ opacity: formIn * (1 - ev(f, C_CREATED - 2, 12)), transform: `translateY(${(1 - formIn) * 18}px)` }}>
                <NewTicketPage s={form} />
              </div>
            )}
            {showTicket && (
              <div style={{ opacity: ev(f, C_CREATED - 4, 14, "outCubic"), transform: `translateY(${(1 - ticketIn) * 14}px)` }}>
                <TicketCreatedPage notice={sp(f, C_CREATED + 6, "smooth")} headOpacity={f >= C_LIFT ? 0 : 1} />
              </div>
            )}
          </AppFrame>
        </At>

        {/* процесс рассмотрения вокруг карточки */}
        {f >= C_LIFT && (
          <>
            <At x={STEPPER.x} y={STEPPER.y} origin="topleft" o={ev(f, W_STEPPER, 30) * clusterO} z={lift * 10}>
              <Stepper stage={stage} />
            </At>
            <At x={RULE.x} y={RULE.y} origin="topleft" o={sp(f, W_RULE, "snappy") * clusterO} z={lift * 10}>
              <RuleCard />
            </At>
            <At x={0} y={0} origin="topleft" o={clusterO} z={lift * 10}>
              <RouteLines p={ev(f, W_ROUTE, W_ROUTE_DUR, "inOutCubic")} />
            </At>
            <At x={HISTORY.x} y={HISTORY.y} origin="topleft" o={ev(f, W_STEPPER, 30) * clusterO} z={lift * 10}>
              <HistoryCard items={HISTORY_ITEMS} f={f} />
            </At>
            <At x={RESULT.x} y={RESULT.y} origin="topleft" o={sp(f, W_RESULT, "smooth") * clusterO} z={lift * 10 + (1 - sp(f, W_RESULT, "smooth")) * -60}>
              <ResultCard />
            </At>
            <At x={heroPos.x} y={heroPos.y} s={heroScale} origin="topleft" o={heroO} z={lift * 40 * (1 - toAdmin)} style={{ transformOrigin: "0 0" }}>
              <HeroCard
                stage={stage}
                chrome={lift}
                details={ev(f, C_LIFT + 24, 40)}
                assign={ev(f, W_ASSIGN, 14)}
                due={ev(f, W_DUE, 14)}
                done={ev(f, W_DONE, 10)}
                routeAccent={ev(f, W_ROUTE, 20) * out(f, W_ASSIGN + 30, 30)}
              />
            </At>
          </>
        )}

        {/* панель аналитики администратора */}
        {f >= W_OUT && (
          <At x={ADMIN.x} y={ADMIN.y} origin="topleft" o={adminO}>
            <AnalyticsPage
              s={{
                kpi: [0, 1, 2, 3].map((i) => ev(f, A_KPI + i * A_KPI_STAGGER, A_KPI_DUR, "outCubic")),
                bars: [0, 1, 2].map((i) => sp(f, A_BARS + i * A_BARS_STAGGER, "smooth")),
                statusIn: ev(f, W_OUT + 40, 60),
                landed: f >= A_LAND,
                landFlash: f >= A_LAND ? out(f, A_LAND + 20, 60) : 0,
                accent: [accentWin(A_ACCENT1), accentWin(A_ACCENT2), accentWin(A_ACCENT3)],
              }}
            />
          </At>
        )}

        {/* курсор */}
        {cursorO > 0.01 && (
          <At x={0} y={0} origin="topleft" o={cursorO * appO}>
            <Cursor x={cur.x} y={cur.y} f={f} clicks={CLICKS} />
          </At>
        )}
      </Stage>
    </div>
  );
}
