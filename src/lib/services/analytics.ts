import { Params, type Queryable } from "../../db";
import { FINAL_STATUSES, type Actor, type Status, type TicketType } from "../domain";
import { forbidden } from "../errors";
import { clusters, tokenize } from "../similarity";
import { getFirstResponseHours, scopeSql } from "./tickets";

export type Source = "all" | "live" | "dataset";

const FINAL_SQL = FINAL_STATUSES.map((s) => `'${s}'`).join(",");

/**
 * Сводка считается запросами к сохранённым обращениям в пределах видимости пользователя:
 * администратор видит всё, руководитель видит своё подразделение и обращения, где он участвует.
 */
export async function computeAnalytics(db: Queryable, actor: Actor, source: Source) {
  if (actor.role !== "admin" && actor.role !== "manager") throw forbidden();
  const p = new Params();
  const conds = [scopeSql(actor, p)];
  if (source === "live") conds.push("NOT t.is_dataset");
  if (source === "dataset") conds.push("t.is_dataset");
  const where = conds.join(" AND ");
  const scopeValues = [...p.values];
  const frh = p.add(await getFirstResponseHours(db));

  const [totals] = await db.query<{
    total: number;
    finished: number;
    closed: number;
    implemented: number;
    rejected: number;
    with_resolution: number;
    overdue: number;
    no_response: number;
    responded: number;
    avg_first_response_h: number | null;
    synthetic_in_response: number;
    avg_finish_days: number | null;
    finished_with_dates: number;
  }>(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE t.status IN (${FINAL_SQL}))::int AS finished,
            count(*) FILTER (WHERE t.status = 'closed')::int AS closed,
            count(*) FILTER (WHERE t.status = 'implemented')::int AS implemented,
            count(*) FILTER (WHERE t.status = 'rejected')::int AS rejected,
            count(*) FILTER (WHERE t.resolution IS NOT NULL)::int AS with_resolution,
            count(*) FILTER (WHERE t.status NOT IN (${FINAL_SQL}) AND t.due_at < now())::int AS overdue,
            count(*) FILTER (WHERE t.status = 'new' AND t.first_response_at IS NULL
                               AND t.created_at < now() - make_interval(hours => ${frh}::int))::int AS no_response,
            count(t.first_response_at)::int AS responded,
            (avg(extract(epoch FROM t.first_response_at - t.created_at)) / 3600)::float AS avg_first_response_h,
            count(*) FILTER (WHERE t.first_response_at IS NOT NULL AND t.dates_synthetic)::int AS synthetic_in_response,
            (avg(extract(epoch FROM t.finished_at - t.created_at)) / 86400)::float AS avg_finish_days,
            count(t.finished_at)::int AS finished_with_dates
       FROM tickets t WHERE ${where}`,
    p.values,
  );

  const byType = await db.query<{ type: TicketType; c: number; finished: number }>(
    `SELECT t.type, count(*)::int AS c, count(*) FILTER (WHERE t.status IN (${FINAL_SQL}))::int AS finished
       FROM tickets t WHERE ${where} GROUP BY t.type ORDER BY c DESC`,
    scopeValues,
  );
  const byStatus = await db.query<{ status: Status; c: number }>(
    `SELECT t.status, count(*)::int AS c FROM tickets t WHERE ${where} GROUP BY t.status`,
    scopeValues,
  );
  const byCategory = await db.query<{ id: number; name: string; c: number; problems: number; open: number }>(
    `SELECT c.id, c.name, count(*)::int AS c,
            count(*) FILTER (WHERE t.type = 'problem')::int AS problems,
            count(*) FILTER (WHERE t.status NOT IN (${FINAL_SQL}))::int AS open
       FROM tickets t JOIN categories c ON c.id = t.category_id
      WHERE ${where} GROUP BY c.id, c.name ORDER BY c DESC, c.name`,
    scopeValues,
  );
  const byDepartment = await db.query<{ id: number | null; name: string | null; c: number; overdue: number }>(
    `SELECT d.id, d.name, count(*)::int AS c,
            count(*) FILTER (WHERE t.status NOT IN (${FINAL_SQL}) AND t.due_at < now())::int AS overdue
       FROM tickets t LEFT JOIN departments d ON d.id = t.department_id
      WHERE ${where} GROUP BY d.id, d.name ORDER BY c DESC, d.name`,
    scopeValues,
  );

  // Повторяющиеся темы: группы обращений с пересекающимся текстом (без отзывов).
  const texts = await db.query<{
    id: number;
    public_id: string;
    category_id: number;
    category_name: string;
    status: Status;
    type: TicketType;
    title: string | null;
    description: string;
    proposed_solution: string | null;
  }>(
    `SELECT t.id, t.public_id, t.category_id, c.name AS category_name, t.status, t.type,
            t.title, t.description, t.proposed_solution
       FROM tickets t JOIN categories c ON c.id = t.category_id
      WHERE ${where} AND t.type <> 'praise' ORDER BY t.id`,
    scopeValues,
  );
  const byId = new Map(texts.map((t) => [t.id, t]));
  const groups = clusters(
    texts.map((t) => ({
      id: t.id,
      categoryId: t.category_id,
      tokens: tokenize([t.title, t.description, t.proposed_solution].filter(Boolean).join(" ")),
    })),
  ).map((ids) =>
    ids.map((id) => {
      const t = byId.get(id)!;
      return {
        public_id: t.public_id,
        category_name: t.category_name,
        status: t.status,
        type: t.type,
        excerpt: t.title ?? t.description.slice(0, 120),
      };
    }),
  );

  return { totals, byType, byStatus, byCategory, byDepartment, groups };
}
