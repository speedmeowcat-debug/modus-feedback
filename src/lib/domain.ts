// Словарь предметной области: типы, статусы, приоритеты, роли и допустимые действия.
// Модуль не зависит от сервера и используется и в интерфейсе, и в сервисах.

export const TYPES = ["problem", "suggestion", "praise"] as const;
export type TicketType = (typeof TYPES)[number];
export const TYPE_LABEL: Record<TicketType, string> = {
  problem: "Проблема",
  suggestion: "Предложение",
  praise: "Положительный отзыв",
};

export const STATUSES = [
  "new",
  "in_review",
  "in_progress",
  "needs_info",
  "implemented",
  "rejected",
  "closed",
] as const;
export type Status = (typeof STATUSES)[number];
export const STATUS_LABEL: Record<Status, string> = {
  new: "Новое",
  in_review: "На рассмотрении",
  in_progress: "В работе",
  needs_info: "Ожидает уточнения",
  implemented: "Реализовано",
  rejected: "Отклонено",
  closed: "Закрыто",
};
/** Рассмотрение завершено: дальнейших действий от ответственного не ожидается. */
export const FINAL_STATUSES: Status[] = ["implemented", "rejected", "closed"];
export const isFinal = (s: Status) => FINAL_STATUSES.includes(s);

export const PRIORITIES = ["low", "medium", "high"] as const;
export type Priority = (typeof PRIORITIES)[number];
export const PRIORITY_LABEL: Record<Priority, string> = {
  low: "Низкий",
  medium: "Средний",
  high: "Высокий",
};

export const ROLES = ["employee", "responsible", "manager", "admin"] as const;
export type Role = (typeof ROLES)[number];
export const ROLE_LABEL: Record<Role, string> = {
  employee: "Сотрудник",
  responsible: "Ответственный",
  manager: "Руководитель",
  admin: "Администратор",
};

export type Actor = {
  id: number;
  login: string;
  name: string;
  role: Role;
  departmentId: number | null;
  departmentName: string | null;
};

// ---------- Действия над обращением ----------

export const ACTIONS = [
  "take_review",
  "start_work",
  "request_info",
  "resume",
  "implement",
  "reject",
  "close",
  "reopen",
  "answer",
  "confirm_close",
] as const;
export type TicketAction = (typeof ACTIONS)[number];

type ActionDef = {
  label: string;
  from: Status[];
  /** Итоговый статус; null означает «вернуть статус, который был до запроса уточнения». */
  to: Status | null;
  who: "handler" | "supervisor" | "author";
  /** Обязателен ли текст и как он называется в форме. */
  text?: { label: string; hint?: string; min: number };
  /** Действие трудно отменить: спрашиваем подтверждение. */
  confirm?: string;
};

export const ACTION_DEFS: Record<TicketAction, ActionDef> = {
  take_review: { label: "Взять на рассмотрение", from: ["new"], to: "in_review", who: "handler" },
  start_work: { label: "Взять в работу", from: ["new", "in_review"], to: "in_progress", who: "handler" },
  request_info: {
    label: "Запросить уточнение",
    from: ["new", "in_review", "in_progress"],
    to: "needs_info",
    who: "handler",
    text: { label: "Вопрос автору", hint: "Автор получит уведомление и сможет ответить в обращении.", min: 5 },
  },
  resume: {
    label: "Продолжить без ответа автора",
    from: ["needs_info"],
    to: null,
    who: "handler",
  },
  implement: {
    label: "Зафиксировать: реализовано",
    from: ["in_review", "in_progress"],
    to: "implemented",
    who: "handler",
    text: { label: "Что сделано", hint: "Итог увидит автор. Опишите принятое решение и выполненные действия.", min: 10 },
  },
  reject: {
    label: "Отклонить",
    from: ["new", "in_review", "in_progress", "needs_info"],
    to: "rejected",
    who: "handler",
    text: { label: "Причина отказа", hint: "Автор увидит причину. Отказ без объяснения не сохраняется.", min: 10 },
    confirm: "Автор получит уведомление с указанной причиной. Вернуть обращение на рассмотрение сможет руководитель или администратор.",
  },
  close: {
    label: "Закрыть",
    from: ["new", "in_review", "in_progress", "implemented", "rejected"],
    to: "closed",
    who: "handler",
    confirm: "После закрытия комментарии недоступны. Вернуть обращение в работу сможет только руководитель или администратор.",
  },
  reopen: {
    label: "Вернуть на рассмотрение",
    from: ["implemented", "rejected", "closed"],
    to: "in_review",
    who: "supervisor",
    text: { label: "Причина возврата", min: 5 },
  },
  answer: {
    label: "Ответить на уточнение",
    from: ["needs_info"],
    to: null,
    who: "author",
    text: { label: "Ваш ответ", min: 2 },
  },
  confirm_close: {
    label: "Ознакомлен, закрыть",
    from: ["implemented", "rejected"],
    to: "closed",
    who: "author",
  },
};

export type TicketPerms = {
  canView: boolean;
  isAuthor: boolean;
  /** Ответственный, руководитель подразделения обращения или администратор. */
  canHandle: boolean;
  /** Руководитель подразделения обращения или администратор. */
  canSupervise: boolean;
};

export function ticketPerms(
  actor: Actor,
  t: { author_id: number; assignee_id: number | null; department_id: number | null },
): TicketPerms {
  const isAuthor = t.author_id === actor.id;
  const isAssignee = t.assignee_id === actor.id;
  const isAdmin = actor.role === "admin";
  const isDeptManager =
    actor.role === "manager" && actor.departmentId !== null && t.department_id === actor.departmentId;
  const canSupervise = isAdmin || isDeptManager;
  const canHandle = canSupervise || isAssignee;
  return { canView: isAuthor || canHandle, isAuthor, canHandle, canSupervise };
}

/** Действия, доступные пользователю для обращения в текущем статусе. */
export function availableActions(status: Status, perms: TicketPerms): TicketAction[] {
  return ACTIONS.filter((a) => {
    const def = ACTION_DEFS[a];
    if (!def.from.includes(status)) return false;
    if (def.who === "handler") return perms.canHandle;
    if (def.who === "supervisor") return perms.canSupervise;
    return perms.isAuthor;
  });
}

/** Нужен ли текст для действия с учётом того, зафиксирован ли уже итог. */
export function actionTextRule(action: TicketAction, hasResolution: boolean) {
  if (action === "close" && !hasResolution) {
    return {
      label: "Итог рассмотрения",
      hint: "Обращение закрывается без статуса «Реализовано». Кратко запишите итог для автора.",
      min: 10,
    };
  }
  return ACTION_DEFS[action].text ?? null;
}

export function formatPublicId(n: number): string {
  return `A-${String(n).padStart(3, "0")}`;
}

// ---------- Вложения ----------

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const FILE_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  txt: "text/plain; charset=utf-8",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};
export const FILE_ACCEPT = Object.keys(FILE_TYPES)
  .map((e) => `.${e}`)
  .join(",");
export const FILE_HINT = "PDF, PNG, JPG, WEBP, TXT, DOCX или XLSX, до 5 МБ";

export const LIMITS = { title: 120, description: 4000, solution: 2000, comment: 3000 };
