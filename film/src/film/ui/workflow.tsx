// Элементы процесса рассмотрения: те же статусы, поля, история и итог, что на странице обращения в приложении.

import type { CSSProperties, ReactNode } from "react";
import { ArrowRight, Check, TriangleAlert } from "lucide-react";
import { Card, StatusBadge, Tag, cx } from "@/components/ui";
import { STATUS_LABEL, type Status } from "@/lib/domain";
import { NEW_TICKET } from "./app";

/** Смена статуса: старая метка уходит вверх, новая приходит снизу. */
export function MorphBadge({ from, to, p }: { from: Status; to: Status; p: number }) {
  if (p <= 0.001 || from === to) return <StatusBadge status={from} />;
  if (p >= 0.999) return <StatusBadge status={to} />;
  return (
    <span className="relative inline-grid h-6 overflow-hidden align-middle">
      <span style={{ gridArea: "1/1", transform: `translateY(${-p * 100}%)`, opacity: 1 - p }}>
        <StatusBadge status={from} />
      </span>
      <span style={{ gridArea: "1/1", transform: `translateY(${(1 - p) * 100}%)`, opacity: p }}>
        <StatusBadge status={to} />
      </span>
    </span>
  );
}

export const FLOW: Status[] = ["new", "in_review", "in_progress", "implemented"];

/** Текущий статус по непрерывной стадии 0..3 (дробная часть — переход). */
export function statusAt(stage: number): { from: Status; to: Status; p: number } {
  const i = Math.max(0, Math.min(FLOW.length - 1, Math.floor(stage)));
  const p = stage - i;
  return { from: FLOW[i]!, to: FLOW[Math.min(FLOW.length - 1, i + 1)]!, p: i >= FLOW.length - 1 ? 0 : p };
}

/** Этапы жизненного цикла с линией прогресса. */
export function Stepper({ stage, width = 760 }: { stage: number; width?: number }) {
  const step = width / (FLOW.length - 1);
  return (
    <div className="relative" style={{ width, height: 64 }}>
      <div className="absolute top-[11px] left-0 h-[2px] w-full bg-line" />
      <div className="absolute top-[11px] left-0 h-[2px] bg-accent" style={{ width: Math.min(1, stage / (FLOW.length - 1)) * width }} />
      {FLOW.map((s, i) => {
        const on = Math.max(0, Math.min(1, stage - i + 1));
        const done = stage >= i + 0.999 && i < FLOW.length - 1;
        return (
          <div key={s} className="absolute top-0 flex flex-col items-center" style={{ left: i * step, transform: "translateX(-50%)" }}>
            <div
              className="flex size-6 items-center justify-center rounded-full border-2"
              style={{
                borderColor: on > 0.5 ? "var(--color-accent)" : "var(--color-line-strong)",
                background: done || (i === FLOW.length - 1 && on > 0.9) ? "var(--color-accent)" : "var(--color-surface)",
              }}
            >
              {done || (i === FLOW.length - 1 && on > 0.9) ? (
                <Check className="size-3.5 text-white" strokeWidth={3} />
              ) : (
                <span className="size-2 rounded-full" style={{ background: "var(--color-accent)", opacity: on }} />
              )}
            </div>
            <span className={cx("mt-2 text-sm whitespace-nowrap", on > 0.5 ? "font-medium text-ink" : "text-muted")}>{STATUS_LABEL[s]}</span>
          </div>
        );
      })}
    </div>
  );
}

function Row({ k, children, accent = 0 }: { k: string; children: ReactNode; accent?: number }) {
  return (
    <div className="contents">
      <dt className="text-muted">{k}</dt>
      <dd className="min-w-0 rounded-[4px]" style={{ background: accent ? `rgb(230 239 235 / ${accent})` : undefined, boxShadow: accent ? `0 0 0 4px rgb(230 239 235 / ${accent})` : undefined }}>
        {children}
      </dd>
    </div>
  );
}

/**
 * Карточка обращения A-021. Её строка с номером и заголовок совпадают по положению
 * с заголовком страницы обращения, поэтому она «вырастает» из интерфейса.
 */
export function HeroCard({
  stage,
  chrome,
  details,
  assign,
  due,
  done,
  routeAccent = 0,
  style,
}: {
  stage: number;
  chrome: number; // 0..1 фон и рамка карточки
  details: number; // 0..1 блок сведений
  assign: number; // 0..1 ответственный назначен
  due: number; // 0..1 срок появился
  done: number; // 0..1 рассмотрение завершено
  routeAccent?: number;
  style?: CSSProperties;
}) {
  const st = statusAt(stage);
  return (
    <div
      className="relative rounded-card border p-6"
      style={{
        width: 760,
        background: `rgb(255 255 255 / ${chrome})`,
        borderColor: `rgb(227 225 219 / ${chrome})`,
        boxShadow: `0 ${24 * chrome}px ${60 * chrome}px rgb(27 29 28 / ${0.14 * chrome}), 0 2px 6px rgb(27 29 28 / ${0.05 * chrome})`,
        ...style,
      }}
    >
      <div className="flex items-center gap-3" style={{ height: 24 }}>
        <span className="num text-sm font-medium text-muted">{NEW_TICKET.id}</span>
        <MorphBadge {...st} />
      </div>
      <h1 className="mt-2 text-[26px] leading-tight font-semibold tracking-[-0.01em]">{NEW_TICKET.title}</h1>
      <div style={{ opacity: details, height: details * 152, overflow: "hidden" }}>
        <dl className="mt-5 grid grid-cols-[132px_minmax(0,1fr)] gap-x-4 gap-y-3 border-t border-line pt-5 text-[15px]">
          <Row k="Категория" accent={routeAccent}>
            {NEW_TICKET.category}
          </Row>
          <Row k="Ответственный">
            <span className="relative inline-grid">
              <span style={{ gridArea: "1/1", opacity: 1 - assign }} className="text-warn">
                Назначается…
              </span>
              <span style={{ gridArea: "1/1", opacity: assign, transform: `translateX(${(1 - assign) * 10}px)` }}>{NEW_TICKET.assignee}</span>
            </span>
          </Row>
          <Row k={done > 0.5 ? "Завершено" : "Срок"}>
            <span style={{ opacity: due }}>{done > 0.5 ? "18 нояб. 15:20" : `до ${NEW_TICKET.due}`}</span>
          </Row>
        </dl>
      </div>
    </div>
  );
}

/** Правило маршрутизации в том виде, как его показывает «Настройки → Маршрутизация». */
export function RuleCard({ o = 1 }: { o?: number }) {
  return (
    <Card className="px-5 py-4" style={{ width: 520, opacity: o }}>
      <p className="text-xs font-medium tracking-wide text-muted uppercase">Правило маршрутизации</p>
      <div className="mt-2.5 flex items-center gap-3 text-[15px]">
        <span className="font-medium">Межотдельное взаимодействие</span>
        <ArrowRight className="size-4 text-faint" />
        <span>Руководитель закупок</span>
      </div>
      <p className="mt-1.5 text-sm text-muted">Условия: любое обращение · срок категории 14 дней</p>
    </Card>
  );
}

export type HistItem = { title: string; meta: string; quote?: string; tone?: "speech" | "status" | "system"; at: number };

export function HistoryCard({ items, f, width = 460 }: { items: HistItem[]; f: number; width?: number }) {
  return (
    <Card className="p-6" style={{ width }}>
      <h2 className="mb-4 text-[17px] font-semibold">История</h2>
      <ol className="relative space-y-4 before:absolute before:top-2 before:bottom-2 before:left-[5px] before:w-px before:bg-line">
        {items.map((e) => {
          const p = Math.max(0, Math.min(1, (f - e.at) / 18));
          const eased = 1 - Math.pow(1 - p, 3);
          if (p <= 0) return null;
          return (
            <li key={e.title + e.at} className="relative pl-6" style={{ opacity: eased, transform: `translateY(${(1 - eased) * 10}px)` }}>
              <span className={cx("absolute top-[7px] left-0 size-[11px] rounded-full border-2 border-surface", e.tone === "speech" ? "bg-ink" : e.tone === "status" ? "bg-accent" : "bg-line-strong")} />
              <p className="font-medium">{e.title}</p>
              <p className="text-sm text-muted">{e.meta}</p>
              {e.quote && <p className="mt-2 rounded-control bg-sunken px-3.5 py-2.5">{e.quote}</p>}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

export function ResultCard({ o = 1, width = 760 }: { o?: number; width?: number }) {
  return (
    <Card className="!border-accent/50 p-6" style={{ width, opacity: o }}>
      <h2 className="text-sm font-medium text-muted">Итог рассмотрения</h2>
      <p className="mt-1.5 text-[19px] leading-relaxed">{NEW_TICKET.result}</p>
    </Card>
  );
}

/** Сводка ответственного и сроков: блок «Сведения» и индикатор просрочки из списков. */
export function ControlCard({ width = 520 }: { width?: number }) {
  return (
    <Card className="p-6" style={{ width }}>
      <h2 className="mb-4 text-[17px] font-semibold">Сведения</h2>
      <dl className="grid grid-cols-[132px_minmax(0,1fr)] gap-x-4 gap-y-3 text-[15px]">
        <dt className="text-muted">Ответственный</dt>
        <dd>Руководитель закупок</dd>
        <dt className="text-muted">Срок</dt>
        <dd>до {NEW_TICKET.due}</dd>
        <dt className="text-muted">Приоритет</dt>
        <dd>Средний</dd>
      </dl>
      <div className="mt-5 border-t border-line pt-4">
        <p className="mb-1.5 text-sm font-medium">Передать другому ответственному</p>
        <div className="flex h-10 items-center rounded-control border border-line-strong px-3 text-[15px]">Выберите сотрудника</div>
      </div>
    </Card>
  );
}

export function OverdueRow({ id, text, status }: { id: string; text: string; status: Status }) {
  return (
    <Card className="flex items-center gap-4 px-5 py-3.5" style={{ width: 640 }}>
      <span className="num text-sm font-medium text-muted">{id}</span>
      <span className="min-w-0 flex-1 truncate font-medium">{text}</span>
      <StatusBadge status={status} />
      <span className="flex items-center gap-1.5 text-sm font-medium whitespace-nowrap text-danger">
        <TriangleAlert className="size-3.5" />
        Просрочено на 1 дн.
      </span>
    </Card>
  );
}

export { Tag };
