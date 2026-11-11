// Первичное заполнение базы.
//
// Из оригинального датасета («Датасет.docx») берутся без изменений: номер, тип, категория,
// автор, приоритет, статус, текст, условный ответственный и пример дальнейшего действия.
// Файл dataset.json получен скриптом прямо из DOCX, руками тексты не набирались.
//
// Чего в датасете нет и что добавлено как допущение (см. docs/ASSUMPTIONS.md):
//  - подразделения и принадлежность условных ролей к ним;
//  - роли доступа (сотрудник, ответственный, руководитель);
//  - даты. Все даты демо-набора синтетические и помечены dates_synthetic / is_synthetic.

import type { Db, Queryable } from "./index";
import dataset from "./dataset.json";
import { hashPassword } from "../lib/password";
import type { Priority, Role, Status, TicketType } from "../lib/domain";

const DEPARTMENTS = [
  "Закупки",
  "Продажи",
  "Проектирование",
  "Бухгалтерия",
  "Управление проектами",
  "Офис и администрация",
  "IT",
  "HR и внутренние коммуникации",
] as const;
type Dept = (typeof DEPARTMENTS)[number];

type SeedUser = { login: string; name: string; role: Role; dept: Dept | null };

// Имена пользователей совпадают с условными ролями датасета: реальных людей в наборе нет.
const USERS: SeedUser[] = [
  { login: "admin", name: "Администратор системы", role: "admin", dept: "IT" },
  // Авторы обращений
  { login: "zakupki", name: "Сотрудник закупок", role: "employee", dept: "Закупки" },
  { login: "proektirovanie", name: "Сотрудник проектирования", role: "employee", dept: "Проектирование" },
  { login: "buhgalteria", name: "Сотрудник бухгалтерии", role: "employee", dept: "Бухгалтерия" },
  { login: "prodazhi", name: "Менеджер по продажам", role: "employee", dept: "Продажи" },
  { login: "koordinator", name: "Координатор проекта", role: "employee", dept: "Управление проектами" },
  { login: "ruk.proekta", name: "Руководитель проекта", role: "employee", dept: "Управление проектами" },
  { login: "ofis", name: "Сотрудник офиса", role: "employee", dept: "Офис и администрация" },
  // Условные ответственные
  { login: "ruk.zakupok", name: "Руководитель закупок", role: "manager", dept: "Закупки" },
  { login: "ruk.napravleniya", name: "Руководитель направления", role: "manager", dept: null },
  { login: "nomenklatura", name: "Ответственный за номенклатуру", role: "responsible", dept: null },
  { login: "obuchenie", name: "Ответственный за обучение", role: "responsible", dept: "HR и внутренние коммуникации" },
  { login: "ruk.buhgalterii", name: "Руководитель бухгалтерии", role: "manager", dept: "Бухгалтерия" },
  { login: "processy", name: "Ответственный за процессы", role: "responsible", dept: null },
  { login: "it", name: "IT-специалист", role: "responsible", dept: "IT" },
  { login: "ruk.podrazdeleniya", name: "Руководитель подразделения", role: "manager", dept: null },
  { login: "dogovory", name: "Ответственный за договоры", role: "responsible", dept: null },
  { login: "ruk.prodazh", name: "Руководитель продаж", role: "manager", dept: "Продажи" },
  { login: "ruk.proektov", name: "Руководитель проектов", role: "manager", dept: "Управление проектами" },
  { login: "ruk.proektirovaniya", name: "Руководитель проектирования", role: "manager", dept: "Проектирование" },
  { login: "adm.rukovoditel", name: "Административный руководитель", role: "manager", dept: "Офис и администрация" },
  { login: "hr", name: "HR / внутренние коммуникации", role: "responsible", dept: "HR и внутренние коммуникации" },
  { login: "dokumenty", name: "Администратор документов", role: "responsible", dept: null },
];

const TYPE_BY_LABEL: Record<string, TicketType> = {
  "Проблема": "problem",
  "Предложение": "suggestion",
  "Положительный отзыв": "praise",
};
const STATUS_BY_LABEL: Record<string, Status> = {
  "Новое": "new",
  "На рассмотрении": "in_review",
  "В работе": "in_progress",
  "Ожидает уточнения": "needs_info",
  "Реализовано": "implemented",
  "Отклонено": "rejected",
  "Закрыто": "closed",
};
const PRIORITY_BY_LABEL: Record<string, Priority> = { "Низкий": "low", "Средний": "medium", "Высокий": "high" };

// СИНТЕТИЧЕСКИЕ даты (время Павлодара, UTC+5). В датасете дат нет.
// created: когда обращение «подано»; respH: через сколько часов дан первый ответ;
// doneD: через сколько дней завершено рассмотрение.
const SYNTHETIC: Record<string, { created: string; respH?: number; doneD?: number }> = {
  "A-001": { created: "2026-10-27T09:40" },
  "A-002": { created: "2026-10-27T14:15", respH: 4 },
  "A-003": { created: "2026-10-28T10:05", respH: 2 },
  "A-004": { created: "2026-10-28T16:30", respH: 6, doneD: 6 },
  "A-005": { created: "2026-10-29T11:20", respH: 21 },
  "A-006": { created: "2026-10-30T09:10", respH: 26 },
  "A-007": { created: "2026-10-30T15:45" },
  "A-008": { created: "2026-11-02T10:30", respH: 5, doneD: 4 },
  "A-009": { created: "2026-11-02T13:00", respH: 3 },
  "A-010": { created: "2026-11-03T09:50", respH: 19 },
  "A-011": { created: "2026-11-03T16:20" },
  "A-012": { created: "2026-11-04T11:00", respH: 28 },
  "A-013": { created: "2026-11-04T15:10", respH: 7 },
  "A-014": { created: "2026-11-05T10:40", respH: 23 },
  "A-015": { created: "2026-11-05T14:25", respH: 4 },
  "A-016": { created: "2026-11-06T09:30" },
  "A-017": { created: "2026-11-06T12:15", respH: 44, doneD: 3 },
  "A-018": { created: "2026-11-06T16:00", respH: 2, doneD: 1 },
  "A-019": { created: "2026-11-09T10:20", respH: 6 },
  "A-020": { created: "2026-11-09T15:30" },
};

export const DEFAULT_RESOLUTION_DAYS = 14;

/** Итог рассмотрения есть в датасете только там, где он назван результатом или мотивированным ответом. */
function resolutionFromDataset(nextAction: string): string | null {
  const m = nextAction.match(/^(?:Пример результата|Пример мотивированного ответа):\s*(.+)$/);
  return m ? m[1] : null;
}

const addHours = (d: Date, h: number) => new Date(d.getTime() + h * 3600_000);

export async function seedIfEmpty(db: Db): Promise<void> {
  const [{ c }] = await db.query<{ c: number }>("SELECT count(*)::int AS c FROM users");
  if (c > 0) return;
  await db.tx((q) => seed(q));
  console.log("[db] загружены демонстрационные данные: 20 обращений из датасета");
}

async function seed(q: Queryable): Promise<void> {
  const demoPassword = process.env.DEMO_PASSWORD?.trim() || "modus-demo-2026";

  const deptId = new Map<string, number>();
  for (const name of DEPARTMENTS) {
    const [r] = await q.query<{ id: number }>("INSERT INTO departments (name) VALUES ($1) RETURNING id", [name]);
    deptId.set(name, r.id);
  }

  const userId = new Map<string, number>();
  for (const u of USERS) {
    const [r] = await q.query<{ id: number }>(
      `INSERT INTO users (login, name, role, department_id, password_hash, is_demo)
       VALUES ($1,$2,$3,$4,$5,TRUE) RETURNING id`,
      [u.login, u.name, u.role, u.dept ? deptId.get(u.dept) : null, hashPassword(demoPassword)],
    );
    userId.set(u.name, r.id);
  }
  const need = (name: string) => {
    const id = userId.get(name);
    if (!id) throw new Error(`В сиде нет пользователя для роли датасета: ${name}`);
    return id;
  };

  // Категории и правила маршрутизации выводятся из датасета: категория -> условный ответственный.
  // Если внутри категории ответственный зависит от типа обращения, создаётся уточняющее правило.
  const catId = new Map<string, number>();
  for (const t of dataset) {
    if (catId.has(t.category)) continue;
    const [r] = await q.query<{ id: number }>(
      "INSERT INTO categories (name, resolution_days) VALUES ($1,$2) RETURNING id",
      [t.category, DEFAULT_RESOLUTION_DAYS],
    );
    catId.set(t.category, r.id);
  }
  const defaultRule = new Map<string, string>();
  for (const t of dataset) {
    const type = TYPE_BY_LABEL[t.type];
    if (!defaultRule.has(t.category)) {
      defaultRule.set(t.category, t.responsible);
      await q.query("INSERT INTO routing_rules (category_id, assignee_id) VALUES ($1,$2)", [
        catId.get(t.category),
        need(t.responsible),
      ]);
    } else if (defaultRule.get(t.category) !== t.responsible) {
      await q.query(
        `INSERT INTO routing_rules (category_id, type, assignee_id) VALUES ($1,$2,$3)
         ON CONFLICT DO NOTHING`,
        [catId.get(t.category), type, need(t.responsible)],
      );
    }
  }

  await q.query("INSERT INTO settings (key, value) VALUES ($1,$2), ($3,$4)", [
    "fallback_assignee_id",
    String(need("Администратор системы")),
    "first_response_hours",
    "24",
  ]);

  for (const t of dataset) {
    const syn = SYNTHETIC[t.id];
    const type = TYPE_BY_LABEL[t.type];
    const status = STATUS_BY_LABEL[t.status];
    const priority = PRIORITY_BY_LABEL[t.priority];
    if (!syn || !type || !status || !priority) throw new Error(`Не удалось разобрать обращение ${t.id}`);

    const author = USERS.find((u) => u.name === t.author);
    if (!author) throw new Error(`Нет автора ${t.author}`);
    const authorId = need(t.author);
    const assigneeId = need(t.responsible);

    const created = new Date(`${syn.created}:00+05:00`);
    const firstResponse = syn.respH ? addHours(created, syn.respH) : null;
    const finished = syn.doneD ? addHours(created, syn.doneD * 24) : null;
    const due = addHours(created, DEFAULT_RESOLUTION_DAYS * 24);
    const isFinal = status === "implemented" || status === "rejected" || status === "closed";
    if ((status !== "new") !== Boolean(firstResponse) || isFinal !== Boolean(finished)) {
      throw new Error(`Синтетические даты не согласованы со статусом ${t.id}`);
    }

    const [row] = await q.query<{ id: number }>(
      `INSERT INTO tickets (public_id, type, category_id, department_id, author_id, assignee_id,
         title, description, priority, status, status_before_info, resolution,
         created_at, updated_at, first_response_at, due_at, finished_at,
         is_dataset, dates_synthetic, dataset_next_action)
       VALUES ($1,$2,$3,$4,$5,$6,NULL,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,TRUE,TRUE,$17)
       RETURNING id`,
      [
        t.id,
        type,
        catId.get(t.category),
        author.dept ? deptId.get(author.dept) : null,
        authorId,
        assigneeId,
        t.text,
        priority,
        status,
        status === "needs_info" ? "in_review" : null,
        isFinal ? resolutionFromDataset(t.nextAction) : null,
        created,
        finished ?? firstResponse ?? created,
        firstResponse,
        due,
        finished,
        t.nextAction,
      ],
    );

    const ev = (kind: string, actor: number | null, at: Date, from: string | null, to: string | null) =>
      q.query(
        `INSERT INTO ticket_events (ticket_id, actor_id, kind, from_value, to_value, is_synthetic, created_at)
         VALUES ($1,$2,$3,$4,$5,TRUE,$6)`,
        [row.id, actor, kind, from, to, at],
      );
    await ev("created", authorId, created, null, null);
    await ev("assigned", null, created, null, t.responsible);
    if (firstResponse) {
      const first: Status = isFinal ? "in_review" : status;
      await ev("status", assigneeId, firstResponse, "new", first);
      if (isFinal && finished) await ev("status", assigneeId, finished, "in_review", status);
    }
  }

  await q.query("SELECT setval('ticket_number_seq', $1)", [dataset.length]);
}
