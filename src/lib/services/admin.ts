import { z } from "zod";
import type { Db, Queryable } from "../../db";
import { ROLES, TYPES, type Actor, type Role, type TicketType } from "../domain";
import { AppError, forbidden, invalid } from "../errors";
import { hashPassword } from "../password";
import { resolveAssignee } from "./routing";

function requireAdmin(actor: Actor) {
  if (actor.role !== "admin") throw forbidden("Раздел доступен только администратору.");
}

async function audit(q: Queryable, actor: Actor, action: string, details: string) {
  await q.query("INSERT INTO audit_log (actor_id, action, details) VALUES ($1,$2,$3)", [actor.id, action, details]);
}

const isUniqueViolation = (e: unknown) => (e as { code?: string })?.code === "23505";

// ---------- Категории ----------

export async function listCategories(db: Queryable, actor: Actor) {
  requireAdmin(actor);
  return db.query<{
    id: number;
    name: string;
    resolution_days: number;
    is_active: boolean;
    tickets: number;
    rules: number;
  }>(
    `SELECT c.id, c.name, c.resolution_days, c.is_active,
            (SELECT count(*)::int FROM tickets t WHERE t.category_id = c.id) AS tickets,
            (SELECT count(*)::int FROM routing_rules r WHERE r.category_id = c.id) AS rules
       FROM categories c ORDER BY c.is_active DESC, c.name`,
  );
}

const categorySchema = z.object({
  name: z.string().trim().min(3, "Название: хотя бы 3 символа.").max(60, "Название: не больше 60 символов."),
  resolutionDays: z.coerce
    .number({ message: "Срок: укажите число дней." })
    .int("Срок: целое число дней.")
    .min(1, "Срок: от 1 дня.")
    .max(365, "Срок: не больше 365 дней."),
});

function fields(err: z.ZodError) {
  const out: Record<string, string> = {};
  for (const i of err.issues) out[String(i.path[0] ?? "form")] ??= i.message;
  return out;
}

export async function saveCategory(
  db: Db,
  actor: Actor,
  id: number | null,
  raw: { name: string; resolutionDays: string | number; isActive?: boolean },
) {
  requireAdmin(actor);
  const parsed = categorySchema.safeParse(raw);
  if (!parsed.success) throw invalid(Object.values(fields(parsed.error))[0], fields(parsed.error));
  const { name, resolutionDays } = parsed.data;
  try {
    await db.tx(async (q) => {
      if (id === null) {
        await q.query("INSERT INTO categories (name, resolution_days) VALUES ($1,$2)", [name, resolutionDays]);
        await audit(q, actor, "Создана категория", `${name}, срок ${resolutionDays} дн.`);
      } else {
        const rows = await q.query(
          "UPDATE categories SET name = $2, resolution_days = $3, is_active = $4 WHERE id = $1 RETURNING id",
          [id, name, resolutionDays, raw.isActive ?? true],
        );
        if (!rows.length) throw invalid("Категория не найдена.");
        await audit(
          q,
          actor,
          raw.isActive === false ? "Категория отключена" : "Изменена категория",
          `${name}, срок ${resolutionDays} дн.`,
        );
      }
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw invalid("Категория с таким названием уже есть.", { name: "Такое название уже занято." });
    throw e;
  }
}

// ---------- Маршрутизация ----------

export async function listRules(db: Queryable, actor: Actor) {
  requireAdmin(actor);
  return db.query<{
    id: number;
    category_id: number;
    category_name: string;
    category_active: boolean;
    type: TicketType | null;
    department_name: string | null;
    assignee_id: number;
    assignee_name: string;
    assignee_active: boolean;
    assignee_absent: boolean;
  }>(
    `SELECT r.id, r.category_id, c.name AS category_name, c.is_active AS category_active, r.type,
            d.name AS department_name, r.assignee_id, u.name AS assignee_name,
            u.is_active AS assignee_active, u.is_absent AS assignee_absent
       FROM routing_rules r
       JOIN categories c ON c.id = r.category_id
       JOIN users u ON u.id = r.assignee_id
       LEFT JOIN departments d ON d.id = r.department_id
      ORDER BY c.name, r.type NULLS FIRST, d.name NULLS FIRST`,
  );
}

const ruleSchema = z.object({
  categoryId: z.coerce.number().int().positive("Выберите категорию."),
  type: z.enum(TYPES).nullable(),
  departmentId: z.coerce.number().int().positive().nullable(),
  assigneeId: z.coerce.number().int().positive("Выберите ответственного."),
});

export async function createRule(
  db: Db,
  actor: Actor,
  raw: { categoryId: string; type: string | null; departmentId: string | null; assigneeId: string },
) {
  requireAdmin(actor);
  const parsed = ruleSchema.safeParse({
    ...raw,
    type: raw.type || null,
    departmentId: raw.departmentId || null,
  });
  if (!parsed.success) throw invalid("Заполните категорию и ответственного.", fields(parsed.error));
  const r = parsed.data;
  try {
    await db.tx(async (q) => {
      const [u] = await q.query<{ name: string }>(
        "SELECT name FROM users WHERE id = $1 AND is_active AND role <> 'employee'",
        [r.assigneeId],
      );
      if (!u) throw invalid("Ответственным может быть только активный пользователь с ролью не ниже «Ответственный».");
      const [c] = await q.query<{ name: string }>("SELECT name FROM categories WHERE id = $1", [r.categoryId]);
      if (!c) throw invalid("Категория не найдена.");
      await q.query(
        "INSERT INTO routing_rules (category_id, type, department_id, assignee_id) VALUES ($1,$2,$3,$4)",
        [r.categoryId, r.type, r.departmentId, r.assigneeId],
      );
      await audit(q, actor, "Добавлено правило маршрутизации", `${c.name} -> ${u.name}`);
    });
  } catch (e) {
    if (isUniqueViolation(e))
      throw invalid("Правило с такими условиями уже есть. Удалите старое или измените условия.");
    throw e;
  }
}

export async function deleteRule(db: Db, actor: Actor, id: number) {
  requireAdmin(actor);
  await db.tx(async (q) => {
    const [r] = await q.query<{ category_name: string; assignee_name: string }>(
      `DELETE FROM routing_rules r USING categories c, users u
        WHERE r.id = $1 AND c.id = r.category_id AND u.id = r.assignee_id
        RETURNING c.name AS category_name, u.name AS assignee_name`,
      [id],
    );
    if (r) await audit(q, actor, "Удалено правило маршрутизации", `${r.category_name} -> ${r.assignee_name}`);
  });
}

export async function previewRoute(
  db: Queryable,
  actor: Actor,
  raw: { categoryId: string; type: string; departmentId: string | null },
) {
  requireAdmin(actor);
  const categoryId = Number(raw.categoryId);
  const type = (TYPES as readonly string[]).includes(raw.type) ? (raw.type as TicketType) : null;
  if (!Number.isInteger(categoryId) || categoryId <= 0 || !type) throw invalid("Выберите категорию и тип.");
  return resolveAssignee(db, { categoryId, type, departmentId: Number(raw.departmentId) || null });
}

// ---------- Пользователи ----------

export async function listUsers(db: Queryable, actor: Actor) {
  requireAdmin(actor);
  return db.query<{
    id: number;
    login: string;
    name: string;
    role: Role;
    department_id: number | null;
    department_name: string | null;
    is_active: boolean;
    is_absent: boolean;
    is_demo: boolean;
    open_assigned: number;
    rules: number;
  }>(
    `SELECT u.id, u.login, u.name, u.role, u.department_id, d.name AS department_name,
            u.is_active, u.is_absent, u.is_demo,
            (SELECT count(*)::int FROM tickets t
              WHERE t.assignee_id = u.id AND t.status NOT IN ('implemented','rejected','closed')) AS open_assigned,
            (SELECT count(*)::int FROM routing_rules r WHERE r.assignee_id = u.id) AS rules
       FROM users u LEFT JOIN departments d ON d.id = u.department_id
      ORDER BY u.is_active DESC, CASE u.role WHEN 'admin' THEN 0 WHEN 'manager' THEN 1 WHEN 'responsible' THEN 2 ELSE 3 END, u.name`,
  );
}

const userSchema = z.object({
  name: z.string().trim().min(2, "Имя: хотя бы 2 символа.").max(80, "Имя: не больше 80 символов."),
  role: z.enum(ROLES, { message: "Выберите роль." }),
  departmentId: z.coerce.number().int().positive().nullable(),
});

export async function updateUser(
  db: Db,
  actor: Actor,
  id: number,
  raw: { name: string; role: string; departmentId: string | null; isActive: boolean; isAbsent: boolean },
) {
  requireAdmin(actor);
  const parsed = userSchema.safeParse({ ...raw, departmentId: raw.departmentId || null });
  if (!parsed.success) throw invalid(Object.values(fields(parsed.error))[0], fields(parsed.error));
  const u = parsed.data;
  if (id === actor.id && (u.role !== "admin" || !raw.isActive))
    throw new AppError("conflict", "Нельзя снять роль администратора или отключить собственную учётную запись.");

  await db.tx(async (q) => {
    const [cur] = await q.query<{ role: Role; is_active: boolean }>(
      "SELECT role, is_active FROM users WHERE id = $1 FOR UPDATE",
      [id],
    );
    if (!cur) throw invalid("Пользователь не найден.");
    // Пользователь без права обработки не должен оставаться ответственным.
    if (u.role === "employee" || !raw.isActive) {
      const [{ open, rules }] = await q.query<{ open: number; rules: number }>(
        `SELECT (SELECT count(*)::int FROM tickets WHERE assignee_id = $1
                  AND status NOT IN ('implemented','rejected','closed')) AS open,
                (SELECT count(*)::int FROM routing_rules WHERE assignee_id = $1) AS rules`,
        [id],
      );
      if (open > 0 || rules > 0)
        throw new AppError(
          "conflict",
          `За пользователем закреплено открытых обращений: ${open}, правил маршрутизации: ${rules}. Сначала передайте их другому ответственному.`,
        );
    }
    await q.query(
      "UPDATE users SET name = $2, role = $3, department_id = $4, is_active = $5, is_absent = $6 WHERE id = $1",
      [id, u.name, u.role, u.departmentId, raw.isActive, raw.isAbsent],
    );
    if (!raw.isActive) await q.query("DELETE FROM sessions WHERE user_id = $1", [id]);
    await audit(
      q,
      actor,
      "Изменён пользователь",
      `${u.name}: роль ${u.role}${raw.isAbsent ? ", отсутствует" : ""}${raw.isActive ? "" : ", отключён"}`,
    );
  });
}

const newUserSchema = userSchema.extend({
  login: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9._-]{3,40}$/, "Логин: 3–40 символов, латиница, цифры, точка, дефис."),
  password: z.string().min(10, "Пароль: не короче 10 символов.").max(200),
});

export async function createUser(
  db: Db,
  actor: Actor,
  raw: { login: string; name: string; role: string; departmentId: string | null; password: string },
) {
  requireAdmin(actor);
  const parsed = newUserSchema.safeParse({ ...raw, departmentId: raw.departmentId || null });
  if (!parsed.success) throw invalid(Object.values(fields(parsed.error))[0], fields(parsed.error));
  const u = parsed.data;
  try {
    await db.tx(async (q) => {
      await q.query(
        "INSERT INTO users (login, name, role, department_id, password_hash) VALUES ($1,$2,$3,$4,$5)",
        [u.login, u.name, u.role, u.departmentId, hashPassword(u.password)],
      );
      await audit(q, actor, "Создан пользователь", `${u.name} (${u.login}), роль ${u.role}`);
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw invalid("Такой логин уже занят.", { login: "Такой логин уже занят." });
    throw e;
  }
}

// ---------- Параметры ----------

export async function getAdminSettings(db: Queryable, actor: Actor) {
  requireAdmin(actor);
  const rows = await db.query<{ key: string; value: string }>("SELECT key, value FROM settings");
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    fallbackAssigneeId: Number(map.get("fallback_assignee_id")) || null,
    firstResponseHours: Number(map.get("first_response_hours")) || 24,
  };
}

export async function saveSettings(
  db: Db,
  actor: Actor,
  raw: { fallbackAssigneeId: string; firstResponseHours: string },
) {
  requireAdmin(actor);
  const hours = Number(raw.firstResponseHours);
  const fallback = Number(raw.fallbackAssigneeId);
  if (!Number.isInteger(hours) || hours < 1 || hours > 720)
    throw invalid("Проверьте поле.", { firstResponseHours: "Укажите целое число часов от 1 до 720." });
  await db.tx(async (q) => {
    const [u] = await q.query<{ name: string }>(
      "SELECT name FROM users WHERE id = $1 AND is_active AND role <> 'employee'",
      [fallback],
    );
    if (!u) throw invalid("Проверьте поле.", { fallbackAssigneeId: "Выберите активного пользователя." });
    for (const [k, v] of [
      ["fallback_assignee_id", String(fallback)],
      ["first_response_hours", String(hours)],
    ]) {
      await q.query(
        "INSERT INTO settings (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
        [k, v],
      );
    }
    await audit(q, actor, "Изменены параметры", `Резервный ответственный: ${u.name}; первый ответ: ${hours} ч`);
  });
}

export async function listAudit(db: Queryable, actor: Actor) {
  requireAdmin(actor);
  return db.query<{ id: number; actor_name: string | null; action: string; details: string; created_at: Date }>(
    `SELECT a.id, u.name AS actor_name, a.action, a.details, a.created_at
       FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id ORDER BY a.id DESC LIMIT 30`,
  );
}
