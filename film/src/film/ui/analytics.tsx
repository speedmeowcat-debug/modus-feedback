// Страница «Аналитика» администратора. Значения посчитаны по демонстрационному датасету
// (20 обращений) плюс новое обращение A-021, прошедшее путь в ролике до «Реализовано».

import { BarRow, Card, Notice, SectionTitle, StatusBadge, cx } from "@/components/ui";
import { STATUSES, TYPE_LABEL, type Status, type TicketType } from "@/lib/domain";
import { AppFrame, ADMIN_NAV, CL, CONTENT_W, CT, SIDEBAR_W, Sidebar } from "./app";

// Счёт по датасету: статусы и типы из «Датасет.docx», A-021 — реализованная проблема.
export const STATUS_COUNTS_BEFORE: Record<Status, number> = {
  new: 5,
  in_review: 6,
  in_progress: 3,
  needs_info: 2,
  implemented: 2,
  rejected: 1,
  closed: 1,
};
export const TYPE_COUNTS: [TicketType, number, number][] = [
  ["problem", 10, 1],
  ["suggestion", 10, 3],
  ["praise", 1, 1],
];
export const KPI = {
  total: 21,
  finishedPct: 24, // 5 из 21
  firstResponseH: 13, // среднее по 16 ответам, даты демо-набора синтетические
  overdue: 2,
};

// Геометрия страницы (координаты окна приложения)
export const AN = {
  kpiTop: CT + 148,
  gridTop: CT + 366,
  statusRowTop: CT + 366 + 24 + 40,
  statusRowH: 40,
  rightCardLeft: CL + 590,
  cardW: 570,
  repeatTop: CT + 716,
};
/** Центр строки статуса в координатах окна приложения. */
export const statusRowCenter = (s: Status) => ({
  x: AN.rightCardLeft + AN.cardW / 2,
  y: AN.statusRowTop + STATUSES.indexOf(s) * AN.statusRowH + AN.statusRowH / 2,
});

function Kpi({ label, value, note, tone, accent = 0, shown = 1 }: { label: string; value: string; note: string; tone?: "danger"; accent?: number; shown?: number }) {
  return (
    <div className="bg-surface p-5" style={{ boxShadow: accent ? `inset 0 0 0 2px rgb(31 90 74 / ${accent})` : undefined }}>
      <p className="text-sm text-muted">{label}</p>
      <p className={cx("num mt-1 text-[28px] leading-none font-semibold tracking-[-0.01em]", tone === "danger" && "text-danger")} style={{ opacity: shown }}>{value}</p>
      <p className="mt-2 text-sm text-muted" style={{ opacity: shown }}>{note}</p>
    </div>
  );
}

export type AnalyticsState = {
  kpi: number[]; // 0..1 счёт каждого показателя
  bars: number[]; // 0..1 рост каждого столбца
  statusIn: number; // 0..1 появление списка статусов
  landed: boolean; // A-021 уже учтено в «Реализовано»
  landFlash: number;
  accent: [number, number, number];
};

export function AnalyticsPage({ s }: { s: AnalyticsState }) {
  const counts = { ...STATUS_COUNTS_BEFORE, implemented: STATUS_COUNTS_BEFORE.implemented + (s.landed ? 1 : 0) };
  const total = s.landed ? 21 : 20;
  const n = (v: number, p: number) => Math.round(v * p);
  return (
    <AppFrame sidebar={<Sidebar items={ADMIN_NAV} active="analytics" user="Администратор системы" role="Администратор · IT" />}>
      <div className="absolute" style={{ left: CL - SIDEBAR_W, top: CT, width: CONTENT_W }}>
        <div style={{ height: 90 }}>
          <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.01em]">Аналитика</h1>
          <p className="mt-1.5 text-muted">По всем подразделениям. Все показатели считаются по сохранённым обращениям на момент открытия страницы.</p>
        </div>
        <div className="mt-2.5 flex gap-1">
          {["Все обращения", "Без демо-набора", "Только демо-набор"].map((l, i) => (
            <span key={l} className={cx("flex h-8 items-center rounded-control px-3 text-sm", i === 0 ? "bg-ink font-medium text-white" : "text-muted")}>
              {l}
            </span>
          ))}
        </div>
        <Card className="absolute grid grid-cols-4 gap-px overflow-hidden !bg-line" style={{ top: 148, width: CONTENT_W }}>
          <Kpi label="Всего обращений" value={String(n(KPI.total, s.kpi[0]!))} note="С зафиксированным итогом: 4 (19%)" shown={Math.min(1, s.kpi[0]! * 5)} />
          <Kpi label="Рассмотрение завершено" value={`${n(KPI.finishedPct, s.kpi[1]!)}%`} note="5 из 21: реализовано 3, отклонено 1, закрыто 1" accent={s.accent[0]} shown={Math.min(1, s.kpi[1]! * 5)} />
          <Kpi label="Среднее время до первого ответа" value={`${n(KPI.firstResponseH, s.kpi[2]!)} ч`} note="По 16 обращениям с ответом" shown={Math.min(1, s.kpi[2]! * 5)} />
          <Kpi label="Просрочено сейчас" value={String(n(KPI.overdue, s.kpi[3]!))} tone="danger" note="Без первого ответа дольше нормы: 2" accent={s.accent[2]} shown={Math.min(1, s.kpi[3]! * 5)} />
        </Card>
        <div className="absolute" style={{ top: 294, width: CONTENT_W }}>
          <Notice tone="info">Демо-данные: 20 обращений синтетического датасета и новое обращение A-021. Даты демо-набора синтетические.</Notice>
        </div>
        <div className="absolute grid grid-cols-2 gap-5" style={{ top: 366, width: CONTENT_W }}>
          <Card className="p-6" style={{ height: 330 }}>
            <SectionTitle hint="в скобках: рассмотрение завершено">По типам</SectionTitle>
            {TYPE_COUNTS.map(([t, c, done], i) => (
              <div key={t} style={{ opacity: Math.min(1, s.bars[i]! * 4) }}>
              <BarRow label={TYPE_LABEL[t]} value={Math.round(c * s.bars[i]!)} note={`(${done})`} share={(c / 10) * s.bars[i]!} />
              </div>
            ))}
          </Card>
          <Card className="p-6" style={{ height: 330, opacity: 0.25 + 0.75 * s.statusIn }}>
            <SectionTitle>По статусам</SectionTitle>
            <ul>
              {STATUSES.map((st) => (
                <li key={st} className="-mx-2 flex items-center justify-between gap-3 rounded-control px-2" style={{ height: 40, background: st === "implemented" && s.landFlash > 0 ? `rgb(230 239 235 / ${s.landFlash})` : undefined }}>
                  <StatusBadge status={st} />
                  <span className="num font-medium">
                    {counts[st]}
                    <span className="ml-2 inline-block w-10 text-right font-normal text-muted">{Math.round((counts[st] / total) * 100)}%</span>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
        <Card className="absolute p-6" style={{ top: 716, width: CONTENT_W, boxShadow: s.accent[1] ? `inset 0 0 0 2px rgb(31 90 74 / ${s.accent[1]})` : undefined }}>
          <SectionTitle hint="правило: не менее трёх общих значимых слов, без машинного обучения">Повторяющиеся темы</SectionTitle>
          <div className="grid grid-cols-2 gap-x-10">
            <div>
              <h3 className="mb-2 text-sm font-medium text-muted">Категории, где проблем две и больше</h3>
              <BarRow label="Межотдельное взаимодействие" value={s.landed ? 2 : 1} share={1} />
            </div>
            <div>
              <h3 className="mb-2 text-sm font-medium text-muted">Обращения в этой категории</h3>
              <p className="py-1 text-[15px]">
                <span className="num font-medium text-muted">A-001</span> В заявках не хватает назначения изделия и параметров
              </p>
              <p className="py-1 text-[15px]">
                <span className="num font-medium text-muted">A-021</span> Счета поставщиков приходят без номера заявки
              </p>
            </div>
          </div>
        </Card>
      </div>
    </AppFrame>
  );
}
