// Общий шаблон списка обращений: вкладки, фильтры, строки, постраничный переход.
// Одна разметка служит и таблицей на широком экране, и карточками на телефоне.

import Link from "next/link";
import { Inbox, Search, SearchX, TriangleAlert, UserRound } from "lucide-react";
import { getDb } from "@/db";
import {
  PRIORITIES,
  PRIORITY_LABEL,
  STATUSES,
  STATUS_LABEL,
  TYPES,
  TYPE_LABEL,
  type Actor,
} from "@/lib/domain";
import { deadlineInfo, plural } from "@/lib/format";
import { listFormOptions, listTickets, type ListFilters, type ListView, type TicketRow } from "@/lib/services/tickets";
import { AutoSubmitForm, FilterPanel } from "./client";
import { Button, Card, EmptyState, LinkButton, PriorityMark, Select, StatusBadge, cx } from "./ui";

type SP = Record<string, string | string[] | undefined>;

function hrefWith(base: string, sp: SP, patch: Record<string, string | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && v) q.set(k, v);
  for (const [k, v] of Object.entries(patch)) {
    if (v) q.set(k, v);
    else q.delete(k);
  }
  const s = q.toString();
  return s ? `${base}?${s}` : base;
}

const GRID =
  "xl:grid xl:grid-cols-[60px_minmax(0,1fr)_146px_96px_minmax(0,168px)_168px] xl:items-center xl:gap-x-4";

function Row({ t, view, frh }: { t: TicketRow; view: ListView; frh: number }) {
  const dl = deadlineInfo(t, frh);
  const person =
    view === "queue" ? { label: "Автор", name: t.author_name } : { label: "Ответственный", name: t.assignee_name };
  const headline = t.title ?? t.description;
  return (
    <li>
      <Link
        href={`/tickets/${t.public_id}`}
        className={cx("block px-4 py-3.5 transition-colors hover:bg-sunken/70 xl:px-5 xl:py-3", GRID)}
      >
        <div className="flex items-center justify-between gap-3 xl:contents">
          <span className="num text-sm font-medium text-muted">{t.public_id}</span>
          <span className="xl:order-3">
            <StatusBadge status={t.status} />
          </span>
          <div className="hidden min-w-0 xl:order-2 xl:block">
            <p className="truncate font-medium">{headline}</p>
            <p className="truncate text-sm text-muted">
              {TYPE_LABEL[t.type]} · {t.category_name}
              {view === "scope" && t.department_name ? ` · ${t.department_name}` : ""}
            </p>
          </div>
        </div>

        {/* Телефон: заголовок под номером и статусом */}
        <div className="mt-2 xl:hidden">
          <p className="line-clamp-2 font-medium">{headline}</p>
          <p className="mt-0.5 truncate text-sm text-muted">
            {TYPE_LABEL[t.type]} · {t.category_name}
          </p>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm xl:contents">
          <span className="xl:order-4">
            <PriorityMark priority={t.priority} />
          </span>
          <span className="flex min-w-0 items-center gap-1.5 text-muted xl:order-5 xl:text-ink">
            <UserRound className="size-3.5 shrink-0 text-muted xl:hidden" aria-hidden />
            <span className="sr-only">{person.label}: </span>
            <span className="truncate">{person.name ?? "Не назначен"}</span>
          </span>
          <span
            className={cx(
              "flex items-center gap-1.5 whitespace-nowrap xl:order-6",
              dl.tone === "danger" ? "font-medium text-danger" : dl.tone === "warn" ? "text-warn" : "text-muted",
            )}
          >
            {dl.tone !== "muted" && <TriangleAlert className="size-3.5 shrink-0" aria-hidden />}
            {dl.label}
          </span>
        </div>
      </Link>
    </li>
  );
}

export async function TicketList({
  actor,
  view,
  basePath,
  searchParams,
  filters,
  emptyTitle,
  emptyText,
}: {
  actor: Actor;
  view: ListView;
  basePath: string;
  searchParams: SP;
  filters: ListFilters;
  emptyTitle: string;
  emptyText: string;
}) {
  const db = await getDb();
  const [data, options] = await Promise.all([listTickets(db, actor, view, filters), listFormOptions(db)]);
  const { rows, total, page, pages, counts } = data;

  const tabs = [
    { key: undefined, label: "Все", n: counts.total },
    { key: "active", label: "В работе", n: counts.active },
    { key: "waiting", label: view === "mine" ? "Нужен ваш ответ" : "Ждут автора", n: counts.waiting },
    { key: "done", label: "Завершённые", n: counts.done },
  ] as const;

  const filtered = Boolean(
    filters.q || filters.status || filters.type || filters.categoryId || filters.departmentId || filters.priority || filters.due || filters.unassigned,
  );
  const showDepartment = view === "scope" && actor.role === "admin";
  const sel = "h-9 text-sm md:flex-none md:!w-auto md:max-w-[210px]";
  const activeFilters = [filters.status, filters.type, filters.categoryId, filters.departmentId, filters.priority, filters.due].filter(Boolean).length;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <nav aria-label="Группы обращений" className="no-scrollbar -mx-1 flex max-w-full gap-1 overflow-x-auto px-1 py-1">
          {tabs.map((tab) => {
            const active = filters.group === tab.key;
            return (
              <Link
                key={tab.label}
                href={hrefWith(basePath, searchParams, { group: tab.key, status: undefined, page: undefined })}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "flex h-8 shrink-0 items-center gap-1.5 rounded-control px-3 text-sm transition-colors",
                  active ? "bg-ink font-medium text-white" : "text-muted hover:bg-neutral-soft hover:text-ink",
                )}
              >
                {tab.label}
                <span className={cx("num", active ? "text-white/70" : "text-faint")}>{tab.n}</span>
              </Link>
            );
          })}
        </nav>
        {counts.overdue > 0 && (
          <Link
            href={hrefWith(basePath, {}, { due: "overdue" })}
            className="flex items-center gap-1.5 text-sm font-medium text-danger hover:underline"
          >
            <TriangleAlert className="size-4" aria-hidden />
            Просрочено: {counts.overdue}
          </Link>
        )}
      </div>

      <Card>
        <AutoSubmitForm className="flex flex-wrap items-center gap-2 border-b border-line p-3 md:px-4">
          {filters.group && <input type="hidden" name="group" value={filters.group} />}
          <div className="relative min-w-[220px] flex-[1_1_260px]">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" aria-hidden />
            <input
              type="search"
              name="q"
              defaultValue={filters.q ?? ""}
              placeholder="Номер или текст обращения"
              aria-label="Поиск по номеру или тексту"
              className="h-9 w-full rounded-control border border-line-strong bg-surface pr-3 pl-9 text-sm placeholder:text-faint hover:border-muted focus:border-accent focus:outline-2 focus:outline-offset-0 focus:outline-accent/25"
            />
          </div>
          <FilterPanel active={activeFilters}>
          {!filters.group && (
            <Select name="status" defaultValue={filters.status ?? ""} aria-label="Статус" className={sel}>
              <option value="">Любой статус</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
          )}
          <Select name="type" defaultValue={filters.type ?? ""} aria-label="Тип" className={sel}>
            <option value="">Любой тип</option>
            {TYPES.map((s) => (
              <option key={s} value={s}>
                {TYPE_LABEL[s]}
              </option>
            ))}
          </Select>
          <Select name="category" defaultValue={filters.categoryId ?? ""} aria-label="Категория" className={sel}>
            <option value="">Любая категория</option>
            {options.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          {showDepartment && (
            <Select name="department" defaultValue={filters.departmentId ?? ""} aria-label="Подразделение" className={sel}>
              <option value="">Любое подразделение</option>
              {options.departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          )}
          <Select name="priority" defaultValue={filters.priority ?? ""} aria-label="Приоритет" className={sel}>
            <option value="">Любой приоритет</option>
            {PRIORITIES.map((s) => (
              <option key={s} value={s}>
                {PRIORITY_LABEL[s]}
              </option>
            ))}
          </Select>
          <Select name="due" defaultValue={filters.due ?? ""} aria-label="Срок" className={sel}>
            <option value="">Любой срок</option>
            <option value="overdue">Просроченные</option>
            <option value="soon">Срок в ближайшие 3 дня</option>
            <option value="no_response">Нет первого ответа</option>
          </Select>
          <Select name="sort" defaultValue={data.sort} aria-label="Сортировка" className={sel}>
            <option value="updated">Сначала обновлённые</option>
            <option value="created">Сначала новые</option>
            <option value="due">По сроку</option>
            <option value="priority">По приоритету</option>
          </Select>
          </FilterPanel>
          <Button type="submit" size="sm" className="!h-9 max-md:hidden">
            Найти
          </Button>
          {filtered && (
            <LinkButton href={hrefWith(basePath, {}, { group: filters.group })} variant="ghost" size="sm" className="!h-9 text-muted">
              Сбросить
            </LinkButton>
          )}
        </AutoSubmitForm>

        {rows.length === 0 ? (
          filtered || filters.group ? (
            <EmptyState
              icon={<SearchX className="size-5" aria-hidden />}
              title="Ничего не найдено"
              action={
                <LinkButton href={basePath} size="sm">
                  Показать все
                </LinkButton>
              }
            >
              Под выбранные условия не подходит ни одно обращение. Измените фильтры или сбросьте их.
            </EmptyState>
          ) : (
            <EmptyState
              icon={<Inbox className="size-5" aria-hidden />}
              title={emptyTitle}
              action={
                view === "mine" ? (
                  <LinkButton href="/tickets/new" variant="primary">
                    Создать обращение
                  </LinkButton>
                ) : undefined
              }
            >
              {emptyText}
            </EmptyState>
          )
        ) : (
          <>
            <div
              aria-hidden
              className={cx("hidden border-b border-line px-5 py-2 text-xs font-medium tracking-wide text-muted uppercase", GRID)}
            >
              <span>Номер</span>
              <span>Обращение</span>
              <span>Статус</span>
              <span>Приоритет</span>
              <span>{view === "queue" ? "Автор" : "Ответственный"}</span>
              <span>Срок</span>
            </div>
            <ul className="divide-y divide-line">
              {rows.map((t) => (
                <Row key={t.id} t={t} view={view} frh={data.firstResponseHours} />
              ))}
            </ul>
          </>
        )}

        {total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm text-muted xl:px-5">
            <span>
              {total} {plural(total, "обращение", "обращения", "обращений")}
              {filtered ? " по фильтру" : ""}
            </span>
            {pages > 1 && (
              <nav aria-label="Страницы" className="flex items-center gap-2">
                {page > 1 ? (
                  <LinkButton size="sm" href={hrefWith(basePath, searchParams, { page: String(page - 1) })}>
                    Назад
                  </LinkButton>
                ) : (
                  <Button size="sm" disabled>
                    Назад
                  </Button>
                )}
                <span className="num px-1">
                  {page} из {pages}
                </span>
                {page < pages ? (
                  <LinkButton size="sm" href={hrefWith(basePath, searchParams, { page: String(page + 1) })}>
                    Вперёд
                  </LinkButton>
                ) : (
                  <Button size="sm" disabled>
                    Вперёд
                  </Button>
                )}
              </nav>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
