import type { Queryable } from "../../db";
import { TYPE_LABEL, type TicketType } from "../domain";

export type RouteResult = {
  assigneeId: number | null;
  assigneeName: string | null;
  viaFallback: boolean;
  /** Пояснение для истории обращения и для проверки правил в настройках. */
  reason: string;
};

export async function getSetting(q: Queryable, key: string): Promise<string | null> {
  const [r] = await q.query<{ value: string }>("SELECT value FROM settings WHERE key = $1", [key]);
  return r?.value ?? null;
}

/**
 * Подбирает ответственного.
 * 1. Берутся правила категории, подходящие по типу и подразделению; чем точнее правило, тем выше.
 * 2. Первый доступный (активен и не отмечен как отсутствующий) ответственный получает обращение.
 * 3. Если правила нет или все ответственные недоступны, обращение уходит резервному ответственному.
 * 4. Если недоступен и он, обращение остаётся без ответственного и видно администраторам.
 */
export async function resolveAssignee(
  q: Queryable,
  input: { categoryId: number; type: TicketType; departmentId: number | null },
): Promise<RouteResult> {
  const rules = await q.query<{
    type: string | null;
    department_id: number | null;
    department_name: string | null;
    assignee_id: number;
    name: string;
    is_active: boolean;
    is_absent: boolean;
  }>(
    `SELECT r.type, r.department_id, d.name AS department_name, r.assignee_id, u.name, u.is_active, u.is_absent
       FROM routing_rules r
       JOIN users u ON u.id = r.assignee_id
       LEFT JOIN departments d ON d.id = r.department_id
      WHERE r.category_id = $1
        AND (r.type IS NULL OR r.type = $2)
        AND (r.department_id IS NULL OR r.department_id = $3)
      ORDER BY (CASE WHEN r.type IS NULL THEN 0 ELSE 2 END
              + CASE WHEN r.department_id IS NULL THEN 0 ELSE 1 END) DESC, r.id`,
    [input.categoryId, input.type, input.departmentId],
  );

  const skipped: string[] = [];
  for (const r of rules) {
    if (r.is_active && !r.is_absent) {
      const parts = ["категория"];
      if (r.type) parts.push(`тип «${TYPE_LABEL[r.type as TicketType]}»`);
      if (r.department_id) parts.push(`подразделение «${r.department_name}»`);
      const tail = skipped.length ? ` Пропущены: ${skipped.join(", ")}.` : "";
      return {
        assigneeId: r.assignee_id,
        assigneeName: r.name,
        viaFallback: false,
        reason: `По правилу маршрутизации (${parts.join(", ")}).${tail}`,
      };
    }
    skipped.push(`${r.name} (${r.is_active ? "отсутствует" : "учётная запись отключена"})`);
  }

  const why = rules.length
    ? `Ответственный по правилу недоступен: ${skipped.join(", ")}.`
    : "Для категории нет подходящего правила маршрутизации.";

  const fallbackId = Number(await getSetting(q, "fallback_assignee_id")) || null;
  const candidates = await q.query<{ id: number; name: string }>(
    `SELECT id, name FROM users
      WHERE is_active AND NOT is_absent AND (id = $1 OR role = 'admin')
      ORDER BY (id = $1) DESC, id LIMIT 1`,
    [fallbackId],
  );
  if (candidates[0]) {
    return {
      assigneeId: candidates[0].id,
      assigneeName: candidates[0].name,
      viaFallback: true,
      reason: `${why} Обращение передано резервному ответственному.`,
    };
  }
  return {
    assigneeId: null,
    assigneeName: null,
    viaFallback: true,
    reason: `${why} Резервный ответственный тоже недоступен, обращение ждёт ручного назначения.`,
  };
}
