import type { Metadata } from "next";
import Link from "next/link";
import { Download, SearchX, TriangleAlert } from "lucide-react";
import { Card, EmptyState, LinkButton, Notice, PriorityMark, StatusBadge, Tag, cx } from "@/components/ui";
import { getDb } from "@/db";
import { requireActor } from "@/lib/auth";
import {
  PRIORITY_LABEL,
  STATUS_LABEL,
  TYPE_LABEL,
  isFinal,
  type Priority,
  type Status,
} from "@/lib/domain";
import { AppError } from "@/lib/errors";
import { deadlineInfo, fmtBytes, fmtDate, fmtDateTime, isoDay } from "@/lib/format";
import { markTicketRead } from "@/lib/services/notifications";
import {
  getTicketDetail,
  listAssignable,
  type AttachmentMeta,
  type EventRow,
  type TicketRow,
} from "@/lib/services/tickets";
import { AnswerForm, CommentForm, StatusActions, TicketSettings } from "./ticket-actions";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: (await params).id };
}

/** Что сейчас происходит с обращением и чего ждать автору. */
const AUTHOR_STATUS_TEXT: Record<Status, string> = {
  new: "Обращение зарегистрировано и передано ответственному. Он ещё не приступил к рассмотрению.",
  in_review: "Ответственный изучает обращение. Если понадобятся детали, вам придёт запрос уточнения.",
  in_progress: "Обращение принято в работу. Результат появится здесь, когда работа будет завершена.",
  needs_info: "Ответственному нужны уточнения. Рассмотрение продолжится после вашего ответа.",
  implemented: "Предложенное реализовано. Ознакомьтесь с итогом и закройте обращение.",
  rejected: "Обращение отклонено. Причина указана в итоге рассмотрения.",
  closed: "Рассмотрение завершено, обращение закрыто.",
};

function Files({ files }: { files: AttachmentMeta[] }) {
  if (!files.length) return null;
  return (
    <ul className="mt-2 flex flex-wrap gap-2">
      {files.map((a) => (
        <li key={a.id}>
          <a
            href={`/files/${a.id}`}
            className="inline-flex max-w-full items-center gap-2 rounded-control border border-line-strong bg-surface px-2.5 py-1.5 text-sm hover:bg-sunken"
          >
            <Download className="size-3.5 shrink-0 text-muted" aria-hidden />
            <span className="truncate">{a.filename}</span>
            <span className="num shrink-0 text-muted">{fmtBytes(a.size)}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

function eventView(e: EventRow): { title: string; quote?: string; note?: string } {
  const st = (v: string | null) => (v ? (STATUS_LABEL[v as Status] ?? v) : "");
  switch (e.kind) {
    case "created":
      return { title: "Обращение создано" };
    case "assigned":
      return {
        title: e.to_value
          ? e.from_value
            ? `Ответственный изменён: ${e.from_value} → ${e.to_value}`
            : `Назначен ответственный: ${e.to_value}`
          : "Ответственный не назначен",
        note: e.body ?? undefined,
      };
    case "status":
      return { title: `Статус: ${st(e.from_value)} → ${st(e.to_value)}`, quote: e.body ?? undefined };
    case "clarification_request":
      return { title: "Запрошено уточнение", quote: e.body ?? undefined };
    case "clarification_answer":
      return { title: "Автор ответил на уточнение", quote: e.body ?? undefined };
    case "priority":
      return {
        title: `Приоритет: ${PRIORITY_LABEL[e.from_value as Priority] ?? ""} → ${PRIORITY_LABEL[e.to_value as Priority] ?? ""}`,
      };
    case "due":
      return {
        title: `Срок изменён: ${e.from_value ? fmtDate(new Date(e.from_value)) : "не задан"} → ${e.to_value ? fmtDate(new Date(e.to_value)) : ""}`,
      };
    default:
      return { title: e.is_internal ? "Внутренняя заметка" : "Комментарий", quote: e.body ?? undefined };
  }
}

function Timeline({ events, attachments }: { events: EventRow[]; attachments: AttachmentMeta[] }) {
  return (
    <ol className="relative space-y-5 before:absolute before:top-2 before:bottom-2 before:left-[5px] before:w-px before:bg-line">
      {events.map((e) => {
        const v = eventView(e);
        const files = e.kind === "created" ? [] : attachments.filter((a) => a.event_id === e.id);
        const speech = e.kind === "comment" || e.kind.startsWith("clarification");
        return (
          <li key={e.id} className="relative pl-6">
            <span
              aria-hidden
              className={cx(
                "absolute top-[7px] left-0 size-[11px] rounded-full border-2 border-surface",
                e.kind === "clarification_request" ? "bg-warn" : speech ? "bg-ink" : "bg-line-strong",
              )}
            />
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <p className="font-medium">{v.title}</p>
              {e.is_internal && <Tag tone="warn">Не видно автору</Tag>}
            </div>
            <p className="text-sm text-muted">
              {e.actor_name ?? "Система"} · <time dateTime={e.created_at.toISOString()}>{fmtDateTime(e.created_at)}</time>
              {e.is_synthetic && <span title="В датасете нет дат. Эта дата добавлена искусственно для демонстрации."> · синтетическая дата</span>}
            </p>
            {v.quote && (
              <p
                className={cx(
                  "mt-2 rounded-control px-3.5 py-2.5 whitespace-pre-wrap break-words",
                  e.is_internal ? "bg-warn-soft" : "bg-sunken",
                )}
              >
                {v.quote}
              </p>
            )}
            {v.note && <p className="mt-1 text-sm text-muted">{v.note}</p>}
            <Files files={files} />
          </li>
        );
      })}
    </ol>
  );
}

function Details({ t, frh, showAuthor }: { t: TicketRow; frh: number; showAuthor: boolean }) {
  const dl = deadlineInfo(t, frh);
  const rows: [string, React.ReactNode][] = [
    ["Тип", TYPE_LABEL[t.type]],
    ["Категория", t.category_name],
    ["Подразделение", t.department_name ?? "Не указано"],
    ["Приоритет", <PriorityMark key="p" priority={t.priority} />],
    [
      "Ответственный",
      t.assignee_name ? (
        <span key="a">
          {t.assignee_name}
          {t.assignee_absent && !isFinal(t.status) && <span className="block text-sm text-warn">Сейчас отсутствует</span>}
        </span>
      ) : (
        <span key="a" className="text-warn">
          Не назначен
        </span>
      ),
    ],
    ...(showAuthor ? ([["Автор", t.author_name]] as [string, React.ReactNode][]) : []),
    ["Создано", fmtDateTime(t.created_at)],
    [
      isFinal(t.status) ? "Завершено" : "Срок",
      isFinal(t.status) ? (
        t.finished_at ? fmtDateTime(t.finished_at) : "Дата не указана"
      ) : (
        <span key="d">
          {t.due_at ? fmtDate(t.due_at) : "Не задан"}
          {dl.tone !== "muted" && (
            <span className={cx("mt-0.5 flex items-center gap-1 text-sm", dl.tone === "danger" ? "font-medium text-danger" : "text-warn")}>
              <TriangleAlert className="size-3.5" aria-hidden />
              {dl.overdue || !dl.noResponse ? dl.label : "Нет первого ответа"}
            </span>
          )}
        </span>
      ),
    ],
  ];
  return (
    <dl className="grid grid-cols-[minmax(0,116px)_minmax(0,1fr)] gap-x-4 gap-y-3 text-[15px]">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted">{k}</dt>
          <dd className="min-w-0 break-words">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export default async function TicketPage({ params, searchParams }: Props) {
  const actor = await requireActor();
  const { id } = await params;
  const { created } = await searchParams;
  const db = await getDb();

  let detail;
  try {
    detail = await getTicketDetail(db, actor, id.toUpperCase());
  } catch (e) {
    if (!(e instanceof AppError)) throw e;
    // Чужое и несуществующее обращение выглядят одинаково: номера нельзя перебрать.
    return (
      <Card className="mx-auto mt-6 max-w-xl">
        <EmptyState
          icon={<SearchX className="size-5" aria-hidden />}
          title="Обращение недоступно"
          action={<LinkButton href="/">К списку обращений</LinkButton>}
        >
          Такого обращения нет или у вас нет к нему доступа. Проверьте номер. Свои обращения вы найдёте в разделе «Мои
          обращения».
        </EmptyState>
      </Card>
    );
  }
  await markTicketRead(db, actor, detail.ticket.public_id);

  const { ticket: t, perms, events, attachments, similar, actions, firstResponseHours } = detail;
  const assignable = perms.canSupervise && t.status !== "closed" ? await listAssignable(db) : null;
  const initialFiles = attachments.filter((a) => {
    const ev = events.find((e) => e.id === a.event_id);
    return !ev || ev.kind === "created";
  });
  const question = [...events].reverse().find((e) => e.kind === "clarification_request");
  const authorMustAnswer = perms.isAuthor && t.status === "needs_info";
  const statusActions = actions.filter((a) => a !== "answer");
  const back =
    perms.isAuthor && !perms.canHandle
      ? { href: "/my", label: "Мои обращения" }
      : t.assignee_id === actor.id
        ? { href: "/queue", label: "Моя очередь" }
        : { href: "/overview", label: actor.role === "admin" ? "Все обращения" : "Обзор" };

  const showNext = statusActions.length > 0 || perms.isAuthor;
  // Блок следующего шага: на широком экране в боковой колонке, на телефоне сразу под описанием.
  const nextStep = (idp: string, className: string) => (
    <Card className={cx("p-5", className)}>
              <h2 className="text-[17px] font-semibold">{statusActions.length ? "Следующий шаг" : "Что происходит"}</h2>
              {perms.isAuthor && !perms.canHandle && (
                <p className="mt-1.5 text-muted">{AUTHOR_STATUS_TEXT[t.status]}</p>
              )}
              {perms.canHandle && t.status === "needs_info" && (
                <p className="mt-1.5 text-muted">Автору отправлен вопрос. После ответа обращение вернётся в рассмотрение.</p>
              )}
              {statusActions.length > 0 && (
                <div className="mt-4">
                  <StatusActions idp={idp} publicId={t.public_id} actions={statusActions} hasResolution={Boolean(t.resolution)} />
                </div>
              )}
            </Card>
  );

  return (
    <article>
      <header className="mb-6">
        <Link href={back.href} className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
          <span aria-hidden>←</span> {back.label}
        </Link>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="num text-sm font-medium text-muted">{t.public_id}</span>
          <StatusBadge status={t.status} />
          {t.is_dataset && <Tag>Демо-набор</Tag>}
        </div>
        <h1 className="mt-2 max-w-3xl text-[26px] leading-tight font-semibold tracking-[-0.01em] break-words">
          {t.title ?? `${TYPE_LABEL[t.type]}: ${t.category_name}`}
        </h1>
      </header>

      {created && perms.isAuthor && (
        <Notice tone="success" title={`Обращение ${t.public_id} зарегистрировано`} className="mb-5 animate-rise">
          {t.assignee_name
            ? `Ответственный: ${t.assignee_name}. Об изменениях статуса придёт уведомление.`
            : "Ответственный будет назначен администратором. Об изменениях статуса придёт уведомление."}
        </Notice>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="min-w-0 space-y-5">
          {authorMustAnswer && (
            <Card className="!border-warn/50 p-5 sm:p-6">
              <h2 className="text-[17px] font-semibold">Нужен ваш ответ</h2>
              {question?.body && (
                <p className="mt-2 rounded-control bg-warn-soft px-3.5 py-2.5 whitespace-pre-wrap break-words">
                  {question.body}
                </p>
              )}
              <p className="mt-1 mb-4 text-sm text-muted">
                {question?.actor_name ?? "Ответственный"}
                {question ? ` · ${fmtDateTime(question.created_at)}` : ""}
              </p>
              <AnswerForm publicId={t.public_id} />
            </Card>
          )}

          {t.resolution && (
            <Card className={cx("p-5 sm:p-6", t.status === "rejected" ? "!border-danger/40" : "!border-accent/50")}>
              <h2 className="text-sm font-medium text-muted">
                {t.status === "rejected" ? "Причина отказа" : "Итог рассмотрения"}
              </h2>
              <p className="mt-1.5 text-[17px] leading-relaxed whitespace-pre-wrap break-words">{t.resolution}</p>
            </Card>
          )}

          <Card className="p-5 sm:p-6">
            <h2 className="text-sm font-medium text-muted">Описание</h2>
            <p className="mt-1.5 leading-relaxed whitespace-pre-wrap break-words">{t.description}</p>
            {t.proposed_solution && (
              <>
                <h2 className="mt-5 text-sm font-medium text-muted">Предполагаемое решение</h2>
                <p className="mt-1.5 leading-relaxed whitespace-pre-wrap break-words">{t.proposed_solution}</p>
              </>
            )}
            {initialFiles.length > 0 && (
              <>
                <h2 className="mt-5 text-sm font-medium text-muted">Вложения</h2>
                <Files files={initialFiles} />
              </>
            )}
            {t.is_dataset && (
              <div className="mt-5 border-t border-line pt-4 text-sm text-muted">
                <p>
                  Обращение загружено из демонстрационного датасета без изменений. Дат в датасете нет: они добавлены
                  искусственно и помечены в истории.
                </p>
                {t.dataset_next_action && perms.canHandle && (
                  <p className="mt-1.5">
                    <span className="text-ink">Пример дальнейшего действия из датасета:</span> {t.dataset_next_action}
                  </p>
                )}
              </div>
            )}
          </Card>

          {showNext && nextStep("main", "lg:hidden")}

          <Card className="p-5 sm:p-6">
            <h2 className="mb-4 text-[17px] font-semibold">История</h2>
            <Timeline events={events} attachments={attachments} />
            {t.status !== "closed" && (
              <div className="mt-6 border-t border-line pt-5">
                <CommentForm publicId={t.public_id} canInternal={perms.canHandle} />
              </div>
            )}
          </Card>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-6">
          {showNext && nextStep("side", "max-lg:hidden")}

          <Card className="p-5">
            <h2 className="mb-4 text-[17px] font-semibold">Сведения</h2>
            <Details t={t} frh={firstResponseHours} showAuthor={!perms.isAuthor || perms.canHandle} />
          </Card>

          {perms.canHandle && t.status !== "closed" && (
            <Card className="p-5">
              <h2 className="mb-4 text-[17px] font-semibold">Параметры</h2>
              <TicketSettings
                publicId={t.public_id}
                priority={t.priority}
                dueDay={t.due_at ? isoDay(t.due_at) : ""}
                today={isoDay(new Date())}
                finished={isFinal(t.status)}
                assigneeId={t.assignee_id}
                assignable={
                  assignable?.map((u) => ({
                    id: u.id,
                    label: `${u.name}${u.department_name ? `, ${u.department_name}` : ""}${u.is_absent ? " (отсутствует)" : ""}`,
                  })) ?? null
                }
              />
            </Card>
          )}

          {perms.canHandle && similar.length > 0 && (
            <Card className="p-5">
              <h2 className="text-[17px] font-semibold">Похожие обращения</h2>
              <p className="mt-1 mb-3 text-sm text-muted">Найдены по совпадению формулировок среди доступных вам обращений.</p>
              <ul className="-mx-2">
                {similar.map((s) => (
                  <li key={s.public_id}>
                    <Link href={`/tickets/${s.public_id}`} className="block rounded-control px-2 py-2 hover:bg-sunken">
                      <span className="flex items-center justify-between gap-2 text-sm">
                        <span className="num font-medium text-muted">{s.public_id}</span>
                        <StatusBadge status={s.status} />
                      </span>
                      <span className="mt-1 line-clamp-2 text-sm">{s.excerpt}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </aside>
      </div>
    </article>
  );
}
