import type { Queryable } from "../../db";
import type { Actor } from "../domain";

export type NotificationRow = {
  id: number;
  text: string;
  public_id: string | null;
  created_at: Date;
  read_at: Date | null;
};

export async function listNotifications(db: Queryable, actor: Actor) {
  return db.query<NotificationRow>(
    `SELECT n.id, n.text, t.public_id, n.created_at, n.read_at
       FROM notifications n LEFT JOIN tickets t ON t.id = n.ticket_id
      WHERE n.user_id = $1 ORDER BY n.id DESC LIMIT 50`,
    [actor.id],
  );
}

export async function unreadCount(db: Queryable, actor: Actor): Promise<number> {
  const [r] = await db.query<{ c: number }>(
    "SELECT count(*)::int AS c FROM notifications WHERE user_id = $1 AND read_at IS NULL",
    [actor.id],
  );
  return r.c;
}

export async function markAllRead(db: Queryable, actor: Actor) {
  await db.query("UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL", [actor.id]);
}

/** Открытие обращения гасит уведомления по нему. */
export async function markTicketRead(db: Queryable, actor: Actor, publicId: string) {
  await db.query(
    `UPDATE notifications n SET read_at = now()
       FROM tickets t
      WHERE t.id = n.ticket_id AND t.public_id = $2 AND n.user_id = $1 AND n.read_at IS NULL`,
    [actor.id, publicId],
  );
}
