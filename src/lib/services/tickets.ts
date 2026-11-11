import { z } from "zod";
import { Params, type Db, type Queryable } from "../../db";
import {
  ACTION_DEFS,
  FILE_TYPES,
  FINAL_STATUSES,
  LIMITS,
  MAX_FILE_BYTES,
  PRIORITIES,
  STATUSES,
  STATUS_LABEL,
  TYPES,
  actionTextRule,
  availableActions,
  formatPublicId,
  ticketPerms,
  type Actor,
  type Priority,
  type Status,
  type TicketAction,
  type TicketPerms,
  type TicketType,
} from "../domain";
import { AppError, forbidden, invalid, notFound } from "../errors";
import { SIMILARITY_THRESHOLD, similarity, tokenize } from "../similarity";
import { getSetting, resolveAssignee } from "./routing";

export type TicketRow = {
  id: number;
  public_id: string;
  type: TicketType;
  category_id: number;
  category_name: string;
  department_id: number | null;
  department_name: string | null;
  author_id: number;
  author_name: string;
  assignee_id: number | null;
  assignee_name: string | null;
  assignee_absent: boolean | null;
  title: string | null;
  description: string;
  proposed_solution: string | null;
  priority: Priority;
  status: Status;
  status_before_info: Status | null;
  resolution: string | null;
  created_at: Date;
  updated_at: Date;
  first_response_at: Date | null;
  due_at: Date | null;
  finished_at: Date | null;
  is_dataset: boolean;
  dates_synthetic: boolean;
  dataset_next_action: string | null;
};

export type EventRow = {
  id: number;
  kind: string;
  actor_id: number | null;
  actor_name: string | null;
  from_value: string | null;
  to_value: string | null;
  body: string | null;
  is_internal: boolean;
  is_synthetic: boolean;
  created_at: Date;
};

export type AttachmentMeta = {
  id: number;
  event_id: number | null;
  filename: string;
  size: number;
  uploader_name: string;
  created_at: Date;
};

const SELECT_TICKET = `
  SELECT t.id, t.public_id, t.type, t.category_id, c.name AS category_name,
         t.department_id, d.name AS department_name,
         t.author_id, au.name AS author_name,
         t.assignee_id, asg.name AS assignee_name, asg.is_absent AS assignee_absent,
         t.title, t.description, t.proposed_solution, t.priority, t.status, t.status_before_info,
         t.resolution, t.created_at, t.updated_at, t.first_response_at, t.due_at, t.finished_at,
         t.is_dataset, t.dates_synthetic, t.dataset_next_action
    FROM tickets t
    JOIN categories c ON c.id = t.category_id
    LEFT JOIN departments d ON d.id = t.department_id
    JOIN users au ON au.id = t.author_id
    LEFT JOIN users asg ON asg.id = t.assignee_id`;

const FINAL_SQL = FINAL_STATUSES.map((s) => `'${s}'`).join(",");

/**
 * Условие видимости обращений на уровне запроса. Любая выборка обращений проходит через него,
 * поэтому чужие обращения не попадают в ответ независимо от того, что показывает интерфейс.
 */
export function scopeSql(actor: Actor, p: Params, alias = "t"): string {
  if (actor.role === "admin") return "TRUE";
  const me = p.add(actor.id);
  const own = `${alias}.author_id = ${me} OR ${alias}.assignee_id = ${me}`;
  if (actor.role === "manager" && actor.departmentId !== null) {
    return `(${own} OR ${alias}.department_id = ${p.add(actor.departmentId)})`;
  }
  return `(${own})`;
}

// ---------- Список ----------

export type ListView = "mine" | "queue" | "scope";
export type ListFilters = {
  q?: string;
  status?: Status;
  group?: "active" | "waiting" | "done";
  type?: TicketType;
  categoryId?: number;
  departmentId?: number;
  priority?: Priority;
  due?: "overdue" | "soon" | "no_response";
  unassigned?: boolean;
  sort?: "updated" | "created" | "due" | "priority";
  page?: number;
};

export const PAGE_SIZE = 20;

const pick = <T extends string>(v: unknown, allowed: readonly T[]): T | undefined =>
  typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : undefined;
const int = (v: unknown): number | undefined => {
  const n = typeof v === "string" ? Number(v) : NaN;
  return Number.isInteger(n) && n > 0 ? n : undefined;
};

/** Разбор параметров адресной строки: неизвестные значения молча отбрасываются. */
export function parseFilters(sp: Record<string, string | string[] | undefined>): ListFilters {
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : sp[k]) as string | undefined;
  return {
    q: one("q")?.trim().slice(0, 100) || undefined,
    status: pick(one("status"), STATUSES),
    group: pick(one("group"), ["active", "waiting", "done"] as const),
    type: pick(one("type"), TYPES),
    categoryId: int(one("category")),
    departmentId: int(one("department")),
    priority: pick(one("priority"), PRIORITIES),
    due: pick(one("due"), ["overdue", "soon", "no_response"] as const),
    unassigned: one("unassigned") === "1" || undefined,
    sort: pick(one("sort"), ["updated", "created", "due", "priority"] as const),
    page: int(one("page")),
  };
}

function filterSql(f: ListFilters, p: Params, firstResponseHours: number): string[] {
  const w: string[] = [];
  if (f.q) {
    const like = p.add(`%${f.q.replace(/[\\%_]/g, "\\$&")}%`);
    w.push(`(t.public_id ILIKE ${like} OR t.title ILIKE ${like} OR t.description ILIKE ${like})`);
  }
  if (f.status) w.push(`t.status = ${p.add(f.status)}`);
  if (f.group === "active") w.push(`t.status IN ('new','in_review','in_progress')`);
  if (f.group === "waiting") w.push(`t.status = 'needs_info'`);
  if (f.group === "done") w.push(`t.status IN (${FINAL_SQL})`);
  if (f.type) w.push(`t.type = ${p.add(f.type)}`);
  if (f.categoryId) w.push(`t.category_id = ${p.add(f.categoryId)}`);
  if (f.departmentId) w.push(`t.department_id = ${p.add(f.departmentId)}`);
  if (f.priority) w.push(`t.priority = ${p.add(f.priority)}`);
  if (f.unassigned) w.push(`t.assignee_id IS NULL`);
  if (f.due === "overdue") w.push(`t.status NOT IN (${FINAL_SQL}) AND t.due_at < now()`);
  if (f.due === "soon")
    w.push(`t.status NOT IN (${FINAL_SQL}) AND t.due_at >= now() AND t.due_at < now() + interval '3 days'`);
  if (f.due === "no_response")
    w.push(
      `t.status = 'new' AND t.first_response_at IS NULL AND t.created_at < now() - make_interval(hours => ${p.add(firstResponseHours)}::int)`,
    );
  return w;
}

const ORDER: Record<NonNullable<ListFilters["sort"]>, string> = {
  updated: "t.updated_at DESC",
  created: "t.created_at DESC",
  due: `(t.status IN (${FINAL_SQL})) ASC, t.due_at ASC NULLS LAST`,
  priority: `(t.status IN (${FINAL_SQL})) ASC, CASE t.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, t.created_at DESC`,
};

export async function getFirstResponseHours(q: Queryable): Promise<number> {
  const n = Number(await getSetting(q, "first_response_hours"));
  return Number.isFinite(n) && n > 0 ? n : 24;
}

export async function listTickets(db: Queryable, actor: Actor, view: ListView, f: ListFilters) {
  const firstResponseHours = await getFirstResponseHours(db);
  const p = new Params();
  const base: string[] = [];
  if (view === "mine") base.push(`t.author_id = ${p.add(actor.id)}`);
  else if (view === "queue") base.push(`t.assignee_id = ${p.add(actor.id)}`);
  else {
    if (actor.role === "employee" || actor.role === "responsible") throw forbidden();
    base.push(scopeSql(actor, p));
  }

  // Счётчики вкладок считаются по представлению без пользовательских фильтров.
  const [counts] = await db.query<{ active: number; waiting: number; done: number; overdue: number; total: number }>(
    `SELECT count(*) FILTER (WHERE t.status IN ('new','in_review','in_progress'))::int AS active,
            count(*) FILTER (WHERE t.status = 'needs_info')::int AS waiting,
            count(*) FILTER (WHERE t.status IN (${FINAL_SQL}))::int AS done,
            count(*) FILTER (WHERE t.status NOT IN (${FINAL_SQL}) AND t.due_at < now())::int AS overdue,
            count(*)::int AS total
       FROM tickets t WHERE ${base.join(" AND ")}`,
    [...p.values],
  );

  const where = [...base, ...filterSql(f, p, firstResponseHours)].join(" AND ");
  const [{ c: total }] = await db.query<{ c: number }>(
    `SELECT count(*)::int AS c FROM tickets t WHERE ${where}`,
    [...p.values],
  );
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(f.page ?? 1, pages);
  const sort = f.sort ?? (view === "queue" ? "due" : "updated");
  const rows = await db.query<TicketRow>(
    `${SELECT_TICKET} WHERE ${where} ORDER BY ${ORDER[sort]}, t.id DESC
     LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}`,
    [...p.values],
  );
  return { rows, total, page, pages, sort, counts, firstResponseHours };
}

// ---------- Карточка ----------

async function loadTicket(q: Queryable, publicId: string, lock = false): Promise<TicketRow | null> {
  if (!/^A-\d{1,9}$/.test(publicId)) return null;
  if (lock) await q.query("SELECT id FROM tickets WHERE public_id = $1 FOR UPDATE", [publicId]);
  const [t] = await q.query<TicketRow>(`${SELECT_TICKET} WHERE t.public_id = $1`, [publicId]);
  return t ?? null;
}

/** Возвращает обращение с правами. Для чужого обращения ведёт себя так же, как для несуществующего. */
async function requireTicket(q: Queryable, actor: Actor, publicId: string, lock = false) {
  const ticket = await loadTicket(q, publicId, lock);
  if (!ticket) throw notFound();
  const perms = ticketPerms(actor, ticket);
  if (!perms.canView) throw notFound();
  return { ticket, perms };
}

export type SimilarTicket = {
  public_id: string;
  type: TicketType;
  status: Status;
  category_name: string;
  excerpt: string;
  score: number;
};

const textOf = (t: { title: string | null; description: string; proposed_solution: string | null }) =>
  [t.title, t.description, t.proposed_solution].filter(Boolean).join(" ");

export async function getTicketDetail(db: Queryable, actor: Actor, publicId: string) {
  const { ticket, perms } = await requireTicket(db, actor, publicId);

  const events = await db.query<EventRow>(
    `SELECT e.id, e.kind, e.actor_id, u.name AS actor_name, e.from_value, e.to_value, e.body,
            e.is_internal, e.is_synthetic, e.created_at
       FROM ticket_events e LEFT JOIN users u ON u.id = e.actor_id
      WHERE e.ticket_id = $1 ${perms.canHandle ? "" : "AND NOT e.is_internal"}
      ORDER BY e.created_at, e.id`,
    [ticket.id],
  );
  const visibleEvents = new Set(events.map((e) => e.id));
  const attachments = (
    await db.query<AttachmentMeta>(
      `SELECT a.id, a.event_id, a.filename, a.size, u.name AS uploader_name, a.created_at
         FROM attachments a JOIN users u ON u.id = a.uploader_id
        WHERE a.ticket_id = $1 ORDER BY a.id`,
      [ticket.id],
    )
  ).filter((a) => a.event_id === null || visibleEvents.has(a.event_id));

  // Похожие обращения показываются только тем, кто обрабатывает, и только из доступных им.
  let similar: SimilarTicket[] = [];
  if (perms.canHandle) {
    const p = new Params();
    const scope = scopeSql(actor, p);
    const others = await db.query<TicketRow>(
      `${SELECT_TICKET} WHERE ${scope} AND t.id <> ${p.add(ticket.id)}`,
      p.values,
    );
    const me = { id: ticket.id, categoryId: ticket.category_id, tokens: tokenize(textOf(ticket)) };
    similar = others
      .map((o) => ({
        o,
        score: similarity(me, { id: o.id, categoryId: o.category_id, tokens: tokenize(textOf(o)) }),
      }))
      .filter((x) => x.score >= SIMILARITY_THRESHOLD)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(({ o, score }) => ({
        public_id: o.public_id,
        type: o.type,
        status: o.status,
        category_name: o.category_name,
        excerpt: o.title ?? o.description.slice(0, 140),
        score,
      }));
  }

  const actions = availableActions(ticket.status, perms);
  const firstResponseHours = await getFirstResponseHours(db);
  return { ticket, perms, events, attachments, similar, actions, firstResponseHours };
}

// ---------- Вложения ----------

export type UploadedFile = { name: string; bytes: Uint8Array };

function sniffOk(ext: string, b: Uint8Array): boolean {
  const starts = (...sig: number[]) => sig.every((v, i) => b[i] === v);
  switch (ext) {
    case "pdf":
      return starts(0x25, 0x50, 0x44, 0x46);
    case "png":
      return starts(0x89, 0x50, 0x4e, 0x47);
    case "jpg":
    case "jpeg":
      return starts(0xff, 0xd8, 0xff);
    case "webp":
      return starts(0x52, 0x49, 0x46, 0x46) && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50;
    case "docx":
    case "xlsx":
      return starts(0x50, 0x4b, 0x03, 0x04);
    case "txt":
      return !b.subarray(0, 4096).includes(0);
    default:
      return false;
  }
}

/** Проверяет файл по расширению, размеру и сигнатуре содержимого. Тип от браузера не используется. */
export function validateFile(file: UploadedFile): { filename: string; mime: string } {
  const filename = file.name
    .replace(/^.*[\\/]/, "")
    .replace(/[\u0000-\u001f\u007f"<>|:*?]/g, "")
    .trim()
    .slice(-120);
  const ext = filename.includes(".") ? filename.split(".").pop()!.toLowerCase() : "";
  const mime = FILE_TYPES[ext];
  if (!filename || !mime) throw invalid("Файл не принят.", { file: "Этот тип файла не поддерживается." });
  if (file.bytes.length === 0) throw invalid("Файл не принят.", { file: "Файл пустой." });
  if (file.bytes.length > MAX_FILE_BYTES) throw invalid("Файл не принят.", { file: "Файл больше 5 МБ." });
  if (!sniffOk(ext, file.bytes))
    throw invalid("Файл не принят.", { file: "Содержимое файла не соответствует его расширению." });
  return { filename, mime };
}

async function saveAttachment(q: Queryable, ticketId: number, eventId: number, actor: Actor, file: UploadedFile) {
  const { filename, mime } = validateFile(file);
  await q.query(
    `INSERT INTO attachments (ticket_id, event_id, uploader_id, filename, mime, size, data)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [ticketId, eventId, actor.id, filename, mime, file.bytes.length, file.bytes],
  );
}

export async function getAttachment(db: Queryable, actor: Actor, id: number) {
  const [a] = await db.query<{
    filename: string;
    mime: string;
    data: Uint8Array;
    public_id: string;
    is_internal: boolean | null;
    author_id: number;
    assignee_id: number | null;
    department_id: number | null;
  }>(
    `SELECT a.filename, a.mime, a.data, t.public_id, e.is_internal, t.author_id, t.assignee_id, t.department_id
       FROM attachments a JOIN tickets t ON t.id = a.ticket_id
       LEFT JOIN ticket_events e ON e.id = a.event_id
      WHERE a.id = $1`,
    [id],
  );
  if (!a) throw notFound();
  const perms = ticketPerms(actor, a);
  if (!perms.canView || (a.is_internal && !perms.canHandle)) throw notFound();
  return { filename: a.filename, mime: a.mime, data: a.data };
}

// ---------- События и уведомления ----------

async function addEvent(
  q: Queryable,
  ticketId: number,
  actorId: number | null,
  kind: string,
  v: { from?: string | null; to?: string | null; body?: string | null; internal?: boolean } = {},
): Promise<number> {
  const [r] = await q.query<{ id: number }>(
    `INSERT INTO ticket_events (ticket_id, actor_id, kind, from_value, to_value, body, is_internal)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [ticketId, actorId, kind, v.from ?? null, v.to ?? null, v.body ?? null, v.internal ?? false],
  );
  return r.id;
}

async function notify(q: Queryable, actor: Actor, userId: number | null, ticketId: number, text: string) {
  if (!userId || userId === actor.id) return;
  await q.query("INSERT INTO notifications (user_id, ticket_id, text) VALUES ($1,$2,$3)", [userId, ticketId, text]);
}

// ---------- Создание ----------

const createSchema = z.object({
  type: z.enum(TYPES, { message: "Выберите тип обращения." }),
  categoryId: z.coerce.number({ message: "Выберите категорию." }).int().positive("Выберите категорию."),
  departmentId: z.coerce.number().int().positive().nullable(),
  title: z
    .string()
    .trim()
    .min(5, "Заголовок слишком короткий: нужно хотя бы 5 символов.")
    .max(LIMITS.title, `Не больше ${LIMITS.title} символов.`),
  description: z
    .string()
    .trim()
    .min(20, "Опишите ситуацию подробнее: хотя бы 20 символов.")
    .max(LIMITS.description, `Не больше ${LIMITS.description} символов.`),
  proposedSolution: z.string().trim().max(LIMITS.solution, `Не больше ${LIMITS.solution} символов.`),
  clientToken: z.string().uuid(),
});

export type CreateInput = {
  type: string;
  categoryId: string | number;
  departmentId: string | number | null;
  title: string;
  description: string;
  proposedSolution: string;
  clientToken: string;
};

function zodFields(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of err.issues) {
    const k = String(i.path[0] ?? "form");
    if (!out[k]) out[k] = i.message;
  }
  return out;
}

export async function createTicket(
  db: Db,
  actor: Actor,
  raw: CreateInput,
  file: UploadedFile | null,
): Promise<{ publicId: string; duplicate: boolean }> {
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) throw invalid("Проверьте выделенные поля.", zodFields(parsed.error));
  const input = parsed.data;
  if (file) validateFile(file);

  return db.tx(async (q) => {
    // Повторная отправка той же формы возвращает уже созданное обращение.
    const [dup] = await q.query<{ public_id: string; author_id: number }>(
      "SELECT public_id, author_id FROM tickets WHERE client_token = $1",
      [input.clientToken],
    );
    if (dup) {
      if (dup.author_id !== actor.id) throw invalid("Форма устарела. Обновите страницу и отправьте снова.");
      return { publicId: dup.public_id, duplicate: true };
    }

    const [cat] = await q.query<{ id: number; resolution_days: number }>(
      "SELECT id, resolution_days FROM categories WHERE id = $1 AND is_active",
      [input.categoryId],
    );
    if (!cat) throw invalid("Проверьте выделенные поля.", { categoryId: "Категория недоступна. Выберите другую." });

    const departmentId = input.departmentId;
    if (departmentId !== null) {
      const [dep] = await q.query("SELECT id FROM departments WHERE id = $1 AND is_active", [departmentId]);
      if (!dep)
        throw invalid("Проверьте выделенные поля.", { departmentId: "Подразделение недоступно. Выберите другое." });
    }

    const route = await resolveAssignee(q, { categoryId: cat.id, type: input.type, departmentId });
    const [{ n }] = await q.query<{ n: number }>("SELECT nextval('ticket_number_seq')::int AS n");
    const publicId = formatPublicId(n);

    const [t] = await q.query<{ id: number }>(
      `INSERT INTO tickets (public_id, type, category_id, department_id, author_id, assignee_id,
         title, description, proposed_solution, due_at, client_token)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, now() + make_interval(days => $10::int), $11)
       RETURNING id`,
      [
        publicId,
        input.type,
        cat.id,
        departmentId,
        actor.id,
        route.assigneeId,
        input.title,
        input.description,
        input.proposedSolution || null,
        cat.resolution_days,
        input.clientToken,
      ],
    );

    const createdEvent = await addEvent(q, t.id, actor.id, "created");
    await addEvent(q, t.id, null, "assigned", { to: route.assigneeName, body: route.reason });
    if (file) await saveAttachment(q, t.id, createdEvent, actor, file);
    await notify(q, actor, route.assigneeId, t.id, `Вам назначено новое обращение ${publicId}: ${input.title}`);
    return { publicId, duplicate: false };
  });
}

// ---------- Действия ----------

export async function performAction(
  db: Db,
  actor: Actor,
  publicId: string,
  action: TicketAction,
  textRaw: string,
): Promise<void> {
  const def = ACTION_DEFS[action];
  if (!def) throw invalid("Неизвестное действие.");
  const text = textRaw.trim();

  await db.tx(async (q) => {
    const { ticket, perms } = await requireTicket(q, actor, publicId, true);
    if (!availableActions(ticket.status, perms).includes(action)) {
      throw new AppError(
        "conflict",
        `Действие недоступно: обращение сейчас в статусе «${STATUS_LABEL[ticket.status]}». Обновите страницу.`,
      );
    }
    const rule = actionTextRule(action, Boolean(ticket.resolution));
    if (rule && text.length < rule.min)
      throw invalid("Заполните обязательное поле.", { text: `${rule.label}: нужно хотя бы ${rule.min} символов.` });
    if (text.length > LIMITS.comment) throw invalid("Слишком длинный текст.", { text: `Не больше ${LIMITS.comment} символов.` });

    const to: Status = def.to ?? ticket.status_before_info ?? "in_review";
    const byHandler = def.who !== "author";
    const sets: string[] = ["status = $2", "updated_at = now()"];
    const params: unknown[] = [ticket.id, to];
    const set = (sql: string, v: unknown) => {
      params.push(v);
      sets.push(sql.replace("?", `$${params.length}`));
    };

    if (byHandler) sets.push("first_response_at = COALESCE(first_response_at, now())");
    if (action === "request_info")
      set("status_before_info = ?", ticket.status === "new" ? "in_review" : ticket.status);
    if (to !== "needs_info" && ticket.status === "needs_info") sets.push("status_before_info = NULL");
    if (action === "implement" || action === "reject") set("resolution = ?", text);
    if (action === "close" && !ticket.resolution) set("resolution = ?", text);
    if (FINAL_STATUSES.includes(to)) sets.push("finished_at = COALESCE(finished_at, now())");
    if (action === "reopen") sets.push("finished_at = NULL", "resolution = NULL");

    await q.query(`UPDATE tickets SET ${sets.join(", ")} WHERE id = $1`, params);

    const kind =
      action === "request_info" ? "clarification_request" : action === "answer" ? "clarification_answer" : "status";
    await addEvent(q, ticket.id, actor.id, kind, { from: ticket.status, to, body: text || null });

    const label = ticket.title ?? ticket.public_id;
    if (byHandler) {
      const msg =
        action === "request_info"
          ? `По обращению ${ticket.public_id} нужен ваш ответ: ${text}`
          : `Обращение ${ticket.public_id} «${label}»: статус «${STATUS_LABEL[to]}»`;
      await notify(q, actor, ticket.author_id, ticket.id, msg);
    } else {
      const msg =
        action === "answer"
          ? `Автор ответил на уточнение по обращению ${ticket.public_id}`
          : `Автор закрыл обращение ${ticket.public_id}`;
      await notify(q, actor, ticket.assignee_id, ticket.id, msg);
    }
  });
}

export async function addComment(
  db: Db,
  actor: Actor,
  publicId: string,
  bodyRaw: string,
  internal: boolean,
  file: UploadedFile | null,
): Promise<void> {
  const body = bodyRaw.trim();
  if (!body) throw invalid("Комментарий пустой.", { body: "Напишите текст комментария." });
  if (body.length > LIMITS.comment) throw invalid("Слишком длинный текст.", { body: `Не больше ${LIMITS.comment} символов.` });
  if (file) validateFile(file);

  await db.tx(async (q) => {
    const { ticket, perms } = await requireTicket(q, actor, publicId, true);
    if (ticket.status === "closed") throw new AppError("conflict", "Обращение закрыто, комментарии недоступны.");
    if (internal && !perms.canHandle) throw forbidden();

    const eventId = await addEvent(q, ticket.id, actor.id, "comment", { body, internal });
    if (file) await saveAttachment(q, ticket.id, eventId, actor, file);

    const handlerReply = perms.canHandle && !perms.isAuthor && !internal;
    await q.query(
      `UPDATE tickets SET updated_at = now()
         ${handlerReply ? ", first_response_at = COALESCE(first_response_at, now())" : ""} WHERE id = $1`,
      [ticket.id],
    );
    if (internal) return;
    if (perms.isAuthor) {
      await notify(q, actor, ticket.assignee_id, ticket.id, `Новый комментарий автора в обращении ${ticket.public_id}`);
    } else {
      await notify(q, actor, ticket.author_id, ticket.id, `Новый комментарий в вашем обращении ${ticket.public_id}`);
    }
  });
}

export async function setPriority(db: Db, actor: Actor, publicId: string, priority: string): Promise<void> {
  const value = pick(priority, PRIORITIES);
  if (!value) throw invalid("Неизвестный приоритет.");
  await db.tx(async (q) => {
    const { ticket, perms } = await requireTicket(q, actor, publicId, true);
    if (!perms.canHandle) throw forbidden();
    if (ticket.priority === value) return;
    await q.query("UPDATE tickets SET priority = $2, updated_at = now() WHERE id = $1", [ticket.id, value]);
    await addEvent(q, ticket.id, actor.id, "priority", { from: ticket.priority, to: value });
  });
}

export async function setDueDate(db: Db, actor: Actor, publicId: string, dateStr: string): Promise<void> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) throw invalid("Укажите дату.", { due: "Укажите дату в формате ДД.ММ.ГГГГ." });
  // Срок истекает в конце указанного дня по времени Павлодара (UTC+5).
  const due = new Date(`${dateStr}T23:59:59+05:00`);
  if (Number.isNaN(due.getTime())) throw invalid("Укажите дату.", { due: "Такой даты не существует." });
  if (due.getTime() < Date.now()) throw invalid("Укажите дату.", { due: "Срок не может быть в прошлом." });
  await db.tx(async (q) => {
    const { ticket, perms } = await requireTicket(q, actor, publicId, true);
    if (!perms.canHandle) throw forbidden();
    if (FINAL_STATUSES.includes(ticket.status))
      throw new AppError("conflict", "Рассмотрение завершено, срок изменить нельзя.");
    await q.query("UPDATE tickets SET due_at = $2, updated_at = now() WHERE id = $1", [ticket.id, due]);
    await addEvent(q, ticket.id, actor.id, "due", {
      from: ticket.due_at ? ticket.due_at.toISOString() : null,
      to: due.toISOString(),
    });
  });
}

export async function reassign(
  db: Db,
  actor: Actor,
  publicId: string,
  assigneeIdRaw: string | number,
  reasonRaw: string,
): Promise<void> {
  const assigneeId = Number(assigneeIdRaw);
  const reason = reasonRaw.trim().slice(0, 500);
  if (!Number.isInteger(assigneeId) || assigneeId <= 0) throw invalid("Выберите ответственного.", { assigneeId: "Выберите ответственного." });
  await db.tx(async (q) => {
    const { ticket, perms } = await requireTicket(q, actor, publicId, true);
    if (!perms.canSupervise) throw forbidden("Менять ответственного может руководитель подразделения или администратор.");
    if (ticket.status === "closed") throw new AppError("conflict", "Обращение закрыто.");
    if (ticket.assignee_id === assigneeId) throw invalid("Этот сотрудник уже назначен.", { assigneeId: "Этот сотрудник уже назначен." });
    const [u] = await q.query<{ id: number; name: string }>(
      "SELECT id, name FROM users WHERE id = $1 AND is_active AND role <> 'employee'",
      [assigneeId],
    );
    if (!u) throw invalid("Сотрудник недоступен для назначения.", { assigneeId: "Сотрудник недоступен для назначения." });
    await q.query("UPDATE tickets SET assignee_id = $2, updated_at = now() WHERE id = $1", [ticket.id, u.id]);
    await addEvent(q, ticket.id, actor.id, "assigned", {
      from: ticket.assignee_name,
      to: u.name,
      body: reason || null,
    });
    await notify(q, actor, u.id, ticket.id, `Вам передано обращение ${ticket.public_id}`);
    await notify(q, actor, ticket.assignee_id, ticket.id, `Обращение ${ticket.public_id} передано другому ответственному`);
  });
}

/** Сотрудники, которым можно назначить обращение. */
export async function listAssignable(db: Queryable) {
  return db.query<{ id: number; name: string; is_absent: boolean; department_name: string | null }>(
    `SELECT u.id, u.name, u.is_absent, d.name AS department_name
       FROM users u LEFT JOIN departments d ON d.id = u.department_id
      WHERE u.is_active AND u.role <> 'employee' ORDER BY u.name`,
  );
}

export async function listFormOptions(db: Queryable) {
  const [categories, departments] = await Promise.all([
    db.query<{ id: number; name: string }>("SELECT id, name FROM categories WHERE is_active ORDER BY name"),
    db.query<{ id: number; name: string }>("SELECT id, name FROM departments WHERE is_active ORDER BY name"),
  ]);
  return { categories, departments };
}

export type { TicketPerms };
