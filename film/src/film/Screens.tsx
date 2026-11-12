// Плоские экраны приложения для слайдов: без камеры и 3D, чтобы текст рендерился чётко.
// Рендер: npx remotion still src/index.ts Screen-<id> out/screens/<id>.png --scale=2

import { AbsoluteFill } from "remotion";
import { C } from "./lib";
import { fontFamily } from "./font";
import { AnalyticsPage } from "./ui/analytics";
import { AppFrame, EMPLOYEE_NAV, Sidebar, NewTicketPage, TicketCreatedPage, APP_W } from "./ui/app";
import { HeroCard, HistoryCard, ResultCard, RuleCard, Stepper, type HistItem } from "./ui/workflow";
import { C_DESC_TEXT, C_TITLE_TEXT } from "./timeline";

const shell = (children: React.ReactNode, bg = C.page) => (
  <AbsoluteFill style={{ background: bg, fontFamily, ["--font-golos" as string]: fontFamily, color: C.ink }}>{children}</AbsoluteFill>
);

const employee = <Sidebar items={EMPLOYEE_NAV} active="my" user="Сотрудник закупок" role="Сотрудник · Закупки" />;

export function ScreenForm() {
  return shell(
    <AppFrame sidebar={employee} scroll={120} className="!rounded-none !border-0">
      <NewTicketPage
        s={{
          typeOn: 0,
          catFocused: false,
          menuOpen: 0,
          menuHover: 0,
          category: "Межотдельное взаимодействие",
          title: C_TITLE_TEXT,
          titleFocused: false,
          desc: C_DESC_TEXT,
          descFocused: false,
          caret: false,
          file: 1,
          pressFile: 0,
          pressSubmit: 0,
          submitting: false,
        }}
      />
    </AppFrame>,
  );
}

export function ScreenCreated() {
  return shell(
    <AppFrame sidebar={employee} className="!rounded-none !border-0">
      <TicketCreatedPage notice={1} />
    </AppFrame>,
  );
}

const HIST: HistItem[] = [
  { at: 0, title: "Обращение создано", meta: "Сотрудник закупок · 11 нояб. 10:42", tone: "system" },
  { at: 0, title: "Назначен ответственный: Руководитель закупок", meta: "Система · По правилу маршрутизации (категория)", tone: "system" },
  { at: 0, title: "Статус: Новое → На рассмотрении", meta: "Руководитель закупок · 11 нояб. 11:05", tone: "status" },
  { at: 0, title: "Статус: На рассмотрении → В работе", meta: "Руководитель закупок · 12 нояб. 09:30", tone: "status" },
  { at: 0, title: "Комментарий", meta: "Руководитель закупок · 12 нояб. 09:32", quote: "Добавим номер заявки в шаблон запроса.", tone: "speech" },
  { at: 0, title: "Статус: В работе → Реализовано", meta: "Руководитель закупок · 18 нояб. 15:20", tone: "status" },
];

export function ScreenWorkflow() {
  return shell(
    <div style={{ position: "absolute", inset: 0, padding: 56, display: "grid", gridTemplateColumns: "760px 1fr", gap: 40, alignItems: "start" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        <div style={{ padding: "8px 28px 0" }}>
          <Stepper stage={3} width={700} />
        </div>
        <HeroCard stage={3} chrome={1} details={1} assign={1} due={1} done={1} />
        <ResultCard />
        <RuleCard />
      </div>
      <HistoryCard items={HIST} f={100} width={680} />
    </div>,
  );
}

export function ScreenAnalytics() {
  return shell(
    <AnalyticsPage s={{ kpi: [1, 1, 1, 1], bars: [1, 1, 1], statusIn: 1, landed: true, landFlash: 0, accent: [0, 0, 0] }} />,
  );
}

export const SCREEN_SIZE = { width: APP_W, height: 1000 };
