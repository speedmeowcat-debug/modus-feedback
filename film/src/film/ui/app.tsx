// Экраны приложения Modus Feedback для ролика.
// Используются настоящие компоненты приложения (src/components/ui.tsx), его словарь (src/lib/domain.ts)
// и дизайн-токены (src/app/globals.css). Разметка страниц повторяет классы приложения; размеры блоков
// зафиксированы, чтобы камера и курсор могли попадать в нужные элементы.

import type { ReactNode } from "react";
import { Bell, ChartColumn, ChevronDown, Inbox, LayoutDashboard, ListChecks, LogOut, Paperclip, Plus, Search, Settings, TriangleAlert, X } from "lucide-react";
import { Card, Notice, PriorityMark, StatusBadge, Tag, buttonClass, cx } from "@/components/ui";
import { PRIORITY_LABEL, STATUS_LABEL, TYPES, TYPE_LABEL, type Priority, type Status, type TicketType } from "@/lib/domain";
import dataset from "../../../../src/db/dataset.json";

// ---------------------------------------------------------------- геометрия окна приложения (UI px)
export const APP_W = 1600;
export const APP_H = 1000;
export const SIDEBAR_W = 248;
export const CL = SIDEBAR_W + 40 + (APP_W - SIDEBAR_W - 80 - 1160) / 2; // левый край контента: 344
export const CT = 36; // верх контента
export const CONTENT_W = 1160;

// Список «Мои обращения»
export const LIST_ROW_TOP = 236;
export const LIST_ROW_H = 66;
// Форма (max-w 720 по центру контента)
export const FL = CL + (CONTENT_W - 720) / 2;
export const FORM_W = 720;
export const FORM = {
  card: 136,
  typeTop: 136 + 24 + 30, // радиокнопки типа
  selectTop: 286 + 24 + 28, // поле «Категория»
  titleTop: 436 + 24 + 28,
  descTop: 436 + 24 + 28 + 40 + 28 + 20 + 28,
  fileTop: 970,
  submitTop: 1102,
};

const ROLE_BY_ID: Record<string, string> = {};
for (const t of dataset) ROLE_BY_ID[t.id] = t.responsible;
const DS = Object.fromEntries(dataset.map((t) => [t.id, t]));

// ---------------------------------------------------------------- боковая панель

type NavKey = "overview" | "queue" | "analytics" | "admin" | "my" | "notifications";
const NAV_ICON = { overview: LayoutDashboard, queue: ListChecks, analytics: ChartColumn, admin: Settings, my: Inbox, notifications: Bell };

function Brand() {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-[7px] bg-accent text-[15px] font-semibold text-white">М</span>
      <span className="leading-tight">
        <span className="block text-[15px] font-semibold whitespace-nowrap">Обратная связь</span>
        <span className="block text-xs whitespace-nowrap text-muted">ГК «Модус Трейд»</span>
      </span>
    </div>
  );
}

export function Sidebar({
  items,
  active,
  user,
  role,
  pressNew = 0,
}: {
  items: { key: NavKey; label: string; count?: number }[];
  active: NavKey | null;
  user: string;
  role: string;
  pressNew?: number;
}) {
  return (
    <aside className="absolute top-0 left-0 flex h-full flex-col border-r border-line bg-surface px-3 py-4" style={{ width: SIDEBAR_W }}>
      <div className="px-1.5">
        <Brand />
      </div>
      <div className={buttonClass("primary", "md", "mt-5 w-full")} style={{ transform: `scale(${1 - pressNew * 0.04})`, filter: pressNew ? `brightness(${1 - pressNew * 0.12})` : undefined }}>
        <Plus className="size-4" />
        Новое обращение
      </div>
      <nav className="mt-5 flex flex-col gap-0.5">
        {items.map((it) => {
          const Icon = NAV_ICON[it.key];
          const on = it.key === active;
          return (
            <div key={it.key} className={cx("flex h-9 items-center gap-2.5 rounded-control px-2.5 text-[15px]", on ? "bg-accent-soft font-medium text-accent-ink" : "text-ink")}>
              <Icon className={cx("size-[18px] shrink-0", on ? "text-accent" : "text-muted")} />
              {it.label}
              {it.count ? (
                <span className={cx("num ml-auto min-w-5 rounded-full px-1.5 text-center text-xs leading-5 font-medium", on ? "bg-accent text-white" : "bg-neutral-soft text-ink")}>{it.count}</span>
              ) : null}
            </div>
          );
        })}
      </nav>
      <div className="mt-auto border-t border-line pt-3">
        <div className="px-2.5">
          <p className="truncate text-sm font-medium">{user}</p>
          <p className="truncate text-xs text-muted">{role}</p>
          <p className="mt-1 text-xs text-muted">Тестовый аккаунт</p>
        </div>
        <div className={buttonClass("ghost", "sm", "mt-2 w-full justify-start !px-2.5 text-muted")}>
          <LogOut className="size-4" />
          Выйти
        </div>
      </div>
    </aside>
  );
}

export const EMPLOYEE_NAV = [
  { key: "my" as const, label: "Мои обращения" },
  { key: "notifications" as const, label: "Уведомления" },
];
export const ADMIN_NAV = [
  { key: "overview" as const, label: "Все обращения" },
  { key: "queue" as const, label: "Моя очередь", count: 1 },
  { key: "analytics" as const, label: "Аналитика" },
  { key: "admin" as const, label: "Настройки" },
  { key: "my" as const, label: "Мои обращения" },
  { key: "notifications" as const, label: "Уведомления" },
];

/** Окно приложения: фиксированный размер, содержимое страницы можно прокручивать. */
export function AppFrame({ sidebar, children, scroll = 0, className }: { sidebar: ReactNode; children: ReactNode; scroll?: number; className?: string }) {
  return (
    <div className={cx("relative overflow-hidden rounded-[14px] border border-line bg-page text-ink", className)} style={{ width: APP_W, height: APP_H, boxShadow: "0 30px 80px rgb(27 29 28 / 0.16), 0 4px 14px rgb(27 29 28 / 0.06)" }}>
      <div className="absolute top-0 right-0 bottom-0" style={{ left: SIDEBAR_W }}>
        <div className="absolute inset-0" style={{ transform: `translateY(${-scroll}px)` }}>
          {children}
        </div>
      </div>
      {sidebar}
    </div>
  );
}

// ---------------------------------------------------------------- строки обращений

export type RowData = {
  id: string;
  headline: string;
  type: TicketType;
  category: string;
  status: Status;
  priority: Priority;
  person: string;
  deadline: { label: string; tone: "danger" | "warn" | "muted" };
};

const fromDs = (id: string, status: Status, priority: Priority, deadline: RowData["deadline"]): RowData => {
  const t = DS[id]!;
  const type: TicketType = t.type === "Проблема" ? "problem" : t.type === "Предложение" ? "suggestion" : "praise";
  return { id, headline: t.text, type, category: t.category, status, priority, person: ROLE_BY_ID[id]!, deadline };
};

// Обращения «Сотрудника закупок» из датасета в том виде, как их показывает приложение.
export const MY_ROWS: RowData[] = [
  fromDs("A-020", "new", "low", { label: "Нет первого ответа", tone: "warn" }),
  fromDs("A-004", "implemented", "low", { label: "Завершено 3 нояб.", tone: "muted" }),
  fromDs("A-002", "in_review", "medium", { label: "Просрочено на 1 дн.", tone: "danger" }),
  fromDs("A-001", "new", "medium", { label: "Просрочено на 1 дн.", tone: "danger" }),
];

export const ROW_GRID = "grid grid-cols-[60px_minmax(0,1fr)_146px_96px_minmax(0,168px)_168px] items-center gap-x-4";

export function TicketRowView({ r, highlight = 0 }: { r: RowData; highlight?: number }) {
  return (
    <div className={cx("px-5", ROW_GRID)} style={{ height: LIST_ROW_H, background: highlight ? `rgb(230 239 235 / ${highlight})` : undefined }}>
      <span className="num text-sm font-medium text-muted">{r.id}</span>
      <div className="min-w-0">
        <p className="truncate font-medium">{r.headline}</p>
        <p className="truncate text-sm text-muted">
          {TYPE_LABEL[r.type]} · {r.category}
        </p>
      </div>
      <span>
        <StatusBadge status={r.status} />
      </span>
      <span>
        <PriorityMark priority={r.priority} />
      </span>
      <span className="truncate text-sm">{r.person}</span>
      <span className={cx("flex items-center gap-1.5 text-sm whitespace-nowrap", r.deadline.tone === "danger" ? "font-medium text-danger" : r.deadline.tone === "warn" ? "text-warn" : "text-muted")}>
        {r.deadline.tone !== "muted" && <TriangleAlert className="size-3.5 shrink-0" />}
        {r.deadline.label}
      </span>
    </div>
  );
}

function FilterBar() {
  const sel = (t: string) => (
    <div className="flex h-9 items-center justify-between gap-6 rounded-control border border-line-strong bg-surface px-3 text-sm whitespace-nowrap">
      {t}
      <ChevronDown className="size-4 text-muted" />
    </div>
  );
  return (
    <div className="flex items-center gap-2 border-b border-line px-4" style={{ height: 60 }}>
      <div className="relative w-[300px]">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
        <div className="flex h-9 items-center rounded-control border border-line-strong bg-surface pl-9 text-sm text-faint">Номер или текст обращения</div>
      </div>
      {sel("Любой статус")}
      {sel("Любой тип")}
      {sel("Любая категория")}
      {sel("Любой срок")}
      <div className={buttonClass("secondary", "sm", "!h-9")}>Найти</div>
    </div>
  );
}

export function ListHeader({ person }: { person: string }) {
  return (
    <div className={cx("border-b border-line px-5 text-xs font-medium tracking-wide text-muted uppercase", ROW_GRID)} style={{ height: 34 }}>
      <span>Номер</span>
      <span>Обращение</span>
      <span>Статус</span>
      <span>Приоритет</span>
      <span>{person}</span>
      <span>Срок</span>
    </div>
  );
}

/** Страница «Мои обращения». rowsOpacity позволяет проявить строки поверх уже стоящих на месте карточек. */
export function MyListPage({ rows, rowsOpacity = 1 }: { rows: RowData[]; rowsOpacity?: number }) {
  return (
    <div className="absolute" style={{ left: CL - SIDEBAR_W, top: CT, width: CONTENT_W }}>
      <div className="flex items-end justify-between" style={{ height: 90 }}>
        <div>
          <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.01em]">Мои обращения</h1>
          <p className="mt-1.5 text-muted">Всё, что вы отправили: текущий статус, ответственный и итог рассмотрения.</p>
        </div>
        <div className={buttonClass("primary")}>
          <Plus className="size-4" />
          Новое обращение
        </div>
      </div>
      <div className="mt-3 flex gap-1" style={{ height: 32 }}>
        {[
          ["Все", 4],
          ["В работе", 3],
          ["Нужен ваш ответ", 0],
          ["Завершённые", 1],
        ].map(([l, n], i) => (
          <span key={l} className={cx("flex h-8 items-center gap-1.5 rounded-control px-3 text-sm", i === 0 ? "bg-ink font-medium text-white" : "text-muted")}>
            {l}
            <span className={cx("num", i === 0 ? "text-white/70" : "text-faint")}>{n}</span>
          </span>
        ))}
      </div>
      <Card className="absolute" style={{ top: 142, width: CONTENT_W }}>
        <FilterBar />
        <ListHeader person="Ответственный" />
        <div className="divide-y divide-line" style={{ opacity: rowsOpacity }}>
          {rows.map((r) => (
            <TicketRowView key={r.id} r={r} />
          ))}
        </div>
        <div className="border-t border-line px-5 py-3 text-sm text-muted">
          {rows.length} {rows.length === 4 ? "обращения" : "обращений"}
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------- форма нового обращения

const TYPE_HINT: Record<TicketType, string> = {
  problem: "Что-то мешает работе или работает не так",
  suggestion: "Идея, как сделать процесс лучше",
  praise: "То, что работает хорошо и стоит сохранить",
};

/** Поле ввода в фокусе с кареткой: повторяет классы Input/Textarea приложения. */
function TypedField({ value, focused, multiline, placeholder, height, caret }: { value: string; focused: boolean; multiline?: boolean; placeholder?: string; height: number; caret: boolean }) {
  return (
    <div
      className={cx(
        "w-full rounded-control border bg-surface px-3 text-[15px] text-ink",
        multiline ? "py-2.5 leading-relaxed" : "flex items-center",
        focused ? "border-accent outline-2 outline-offset-0 outline-accent/25" : "border-line-strong",
      )}
      style={{ height }}
    >
      {value ? (
        <span className="whitespace-pre-wrap">
          {value}
          {caret && <span className="ml-px inline-block h-[18px] w-[1.5px] translate-y-[3px] bg-ink" />}
        </span>
      ) : (
        <span className="text-faint">
          {caret && <span className="mr-px inline-block h-[18px] w-[1.5px] translate-y-[3px] bg-ink" />}
          {placeholder}
        </span>
      )}
    </div>
  );
}

function FakeSelect({ value, placeholder, focused }: { value?: string; placeholder: string; focused?: boolean }) {
  return (
    <div className={cx("flex h-10 items-center justify-between rounded-control border bg-surface px-3 text-[15px]", focused ? "border-accent outline-2 outline-offset-0 outline-accent/25" : "border-line-strong")}>
      <span className={value ? "text-ink" : "text-ink"}>{value ?? placeholder}</span>
      <ChevronDown className="size-4 text-muted" />
    </div>
  );
}

export const CATEGORIES = [...new Set(dataset.map((t) => t.category))].sort((a, b) => a.localeCompare(b, "ru"));

export type FormState = {
  typeOn: number; // 0..1 подсветка нажатия на «Проблема»
  catFocused: boolean;
  menuOpen: number; // 0..1 появление списка категорий
  menuHover: number; // индекс подсвеченного пункта (дробный — движение подсветки)
  category?: string;
  title: string;
  titleFocused: boolean;
  desc: string;
  descFocused: boolean;
  caret: boolean;
  file: number; // 0..1 появление прикреплённого файла
  pressFile: number;
  pressSubmit: number;
  submitting: boolean;
};

export function NewTicketPage({ s }: { s: FormState }) {
  const sectionCls = "absolute left-0 right-0 border-t border-line px-6";
  const menuItems = CATEGORIES.slice(5, 13); // фрагмент списка вокруг нужной категории
  return (
    <div className="absolute" style={{ left: FL - SIDEBAR_W, top: CT, width: FORM_W }}>
      <p className="text-sm text-muted">← Мои обращения</p>
      <h1 className="mt-2 text-[26px] leading-tight font-semibold tracking-[-0.01em]">Новое обращение</h1>
      <p className="mt-1.5 text-muted">После отправки обращение получит номер и ответственного. Ход рассмотрения будет виден в разделе «Мои обращения».</p>
      <Card className="absolute" style={{ top: FORM.card, width: FORM_W, height: 1030 }}>
        <div className="absolute inset-x-0 top-0 px-6 pt-6">
          <p className="mb-3 text-sm font-medium">Тип обращения</p>
          <div className="grid grid-cols-3 gap-2">
            {TYPES.map((t) => (
              <div key={t} className={cx("rounded-control border px-3.5 py-3", t === "problem" ? "border-accent bg-accent-soft" : "border-line-strong")} style={t === "problem" ? { transform: `scale(${1 - s.typeOn * 0.02})` } : undefined}>
                <span className={cx("block font-medium", t === "problem" && "text-accent-ink")}>{TYPE_LABEL[t]}</span>
                <span className="mt-0.5 block text-sm text-muted">{TYPE_HINT[t]}</span>
              </div>
            ))}
          </div>
        </div>
        <div className={cx(sectionCls, "grid grid-cols-2 gap-5 pt-6")} style={{ top: 150 }}>
          <div className="relative">
            <p className="mb-1.5 text-sm font-medium">Категория</p>
            <FakeSelect value={s.category} placeholder="Выберите категорию" focused={s.catFocused} />
            <p className="mt-1.5 text-sm text-muted">От категории зависит, кто рассмотрит обращение.</p>
            {s.menuOpen > 0.01 && (
              <div
                className="absolute z-10 rounded-control border border-line bg-surface py-1 shadow-pop"
                style={{ top: 72, left: 0, right: -40, opacity: s.menuOpen, transform: `translateY(${(1 - s.menuOpen) * -6}px)` }}
              >
                {menuItems.map((c, i) => (
                  <div key={c} className="relative px-3 py-1.5 text-[15px]">
                    {Math.abs(s.menuHover - i) < 1 && <div className="absolute inset-x-1 inset-y-0 rounded-[4px] bg-accent-soft" style={{ opacity: 1 - Math.abs(s.menuHover - i) }} />}
                    <span className="relative">{c}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium">Подразделение</p>
            <FakeSelect value="Закупки" placeholder="" />
            <p className="mt-1.5 text-sm text-muted">К чьей работе относится вопрос. По умолчанию ваше.</p>
          </div>
        </div>
        <div className={cx(sectionCls, "pt-6")} style={{ top: 300 }}>
          <p className="mb-1.5 text-sm font-medium">Заголовок</p>
          <TypedField value={s.title} focused={s.titleFocused} height={40} caret={s.titleFocused && s.caret} />
          <p className="mt-1.5 text-sm text-muted">Одна фраза, по которой обращение легко узнать в списке.</p>
          <p className="mt-5 mb-1.5 text-sm font-medium">Что происходит</p>
          <TypedField value={s.desc} focused={s.descFocused} multiline height={150} caret={s.descFocused && s.caret} placeholder="Опишите ситуацию: где возникает, как часто, чему мешает." />
          <p className="mt-1.5 flex justify-between text-sm text-muted">
            <span>Не указывайте персональные данные и коммерческие условия.</span>
            <span className="num">{s.desc.length} / 4000</span>
          </p>
          <p className="mt-5 mb-1.5 flex items-baseline gap-2 text-sm font-medium">
            Предполагаемое решение <span className="font-normal text-muted">необязательно</span>
          </p>
          <TypedField value="" focused={false} multiline height={80} caret={false} placeholder="Если есть идея, как это исправить или внедрить." />
          <p className="mt-5 mb-1.5 flex items-baseline gap-2 text-sm font-medium">
            Файл <span className="font-normal text-muted">необязательно</span>
          </p>
          <div className="flex items-center gap-3">
            <div className="inline-flex h-10 items-center gap-2 rounded-control border border-line-strong bg-surface px-4 font-medium" style={{ transform: `scale(${1 - s.pressFile * 0.04})` }}>
              <Paperclip className="size-4" />
              {s.file > 0.5 ? "Заменить файл" : "Выбрать файл"}
            </div>
            {s.file > 0.01 && (
              <span className="flex items-center gap-2 text-sm" style={{ opacity: s.file, transform: `translateX(${(1 - s.file) * -8}px)` }}>
                <span>пример счёта.pdf</span>
                <span className="num text-muted">184 КБ</span>
                <X className="size-4 text-muted" />
              </span>
            )}
          </div>
          <p className="mt-1.5 text-sm text-muted">PDF, PNG, JPG, WEBP, TXT, DOCX или XLSX, до 5 МБ</p>
        </div>
        <div className={cx(sectionCls, "flex items-center gap-3 pt-6")} style={{ top: 940 }}>
          <div className={buttonClass("primary")} style={{ transform: `scale(${1 - s.pressSubmit * 0.04})` }}>
            {s.submitting && <span className="size-4 rounded-full border-2 border-white/40 border-t-white" style={{ transform: `rotate(${s.title.length * 0}deg)` }} />}
            {s.submitting ? "Отправляем" : "Отправить обращение"}
          </div>
          <div className={buttonClass("ghost")}>Отмена</div>
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------- страница обращения

export const NEW_TICKET = {
  id: "A-021",
  title: "Счета поставщиков приходят без номера заявки",
  category: "Межотдельное взаимодействие",
  department: "Закупки",
  author: "Сотрудник закупок",
  assignee: "Руководитель закупок",
  created: "11 нояб. 10:42",
  due: "25 нояб. 2026",
  result: "В шаблон запроса поставщику добавлено обязательное поле с номером заявки.",
};

/** Заголовок страницы обращения. Его положение в окне фиксировано: из него вырастает карточка следующей сцены. */
export const HEAD = { x: CL, y: CT + 32, titleY: CT + 64 };

export function TicketCreatedPage({ notice, headOpacity = 1 }: { notice: number; headOpacity?: number }) {
  return (
    <div className="absolute" style={{ left: CL - SIDEBAR_W, top: CT, width: CONTENT_W }}>
      <div style={{ opacity: headOpacity }}>
        <p className="text-sm text-muted">← Мои обращения</p>
        <div className="mt-3 flex items-center gap-3">
          <span className="num text-sm font-medium text-muted">{NEW_TICKET.id}</span>
          <StatusBadge status="new" />
        </div>
        <h1 className="mt-2 text-[26px] leading-tight font-semibold tracking-[-0.01em]">{NEW_TICKET.title}</h1>
      </div>
      <div style={{ opacity: notice, transform: `translateY(${(1 - notice) * 6}px)` }} className="mt-5">
        <Notice tone="success" title={`Обращение ${NEW_TICKET.id} зарегистрировано`}>
          Ответственный: {NEW_TICKET.assignee}. Об изменениях статуса придёт уведомление.
        </Notice>
      </div>
      <div className="mt-5 grid grid-cols-[minmax(0,1fr)_340px] gap-5">
        <Card className="p-6">
          <h2 className="text-sm font-medium text-muted">Описание</h2>
          <p className="mt-1.5 leading-relaxed">
            Бухгалтерия передаёт нам счета поставщиков без номера внутренней заявки. Заявку приходится искать вручную, на каждый счёт уходит до 15 минут.
          </p>
          <h2 className="mt-5 text-sm font-medium text-muted">Вложения</h2>
          <div className="mt-2 inline-flex items-center gap-2 rounded-control border border-line-strong px-2.5 py-1.5 text-sm">
            <Paperclip className="size-3.5 text-muted" /> пример счёта.pdf <span className="num text-muted">184 КБ</span>
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="text-[17px] font-semibold">Что происходит</h2>
          <p className="mt-1.5 text-muted">Обращение зарегистрировано и передано ответственному. Он ещё не приступил к рассмотрению.</p>
        </Card>
      </div>
    </div>
  );
}

export { PRIORITY_LABEL, STATUS_LABEL, Tag };
