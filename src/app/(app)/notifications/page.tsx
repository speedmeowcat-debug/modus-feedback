import type { Metadata } from "next";
import Link from "next/link";
import { Bell } from "lucide-react";
import { markAllReadAction } from "@/app/actions";
import { Button, Card, EmptyState, PageHeader, cx } from "@/components/ui";
import { getDb } from "@/db";
import { requireActor } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";
import { listNotifications } from "@/lib/services/notifications";

export const metadata: Metadata = { title: "Уведомления" };

export default async function NotificationsPage() {
  const actor = await requireActor();
  const rows = await listNotifications(await getDb(), actor);
  const unread = rows.filter((r) => !r.read_at).length;
  return (
    <div className="mx-auto max-w-[760px]">
      <PageHeader
        title="Уведомления"
        description="Назначения, смена статуса, запросы уточнений и новые комментарии по вашим обращениям."
        actions={
          unread > 0 ? (
            <form action={markAllReadAction}>
              <Button type="submit">Отметить все прочитанными</Button>
            </form>
          ) : undefined
        }
      />
      <Card>
        {rows.length === 0 ? (
          <EmptyState icon={<Bell className="size-5" aria-hidden />} title="Уведомлений пока нет">
            Здесь появится сообщение, когда по вашему обращению что-то изменится или вам назначат новое.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((n) => {
              const body = (
                <>
                  <span
                    aria-hidden
                    className={cx("mt-[7px] size-2 shrink-0 rounded-full", n.read_at ? "bg-transparent" : "bg-accent")}
                  />
                  <span className="min-w-0 flex-1">
                    <span className={cx("block break-words", !n.read_at && "font-medium")}>
                      {!n.read_at && <span className="sr-only">Новое: </span>}
                      {n.text}
                    </span>
                    <span className="text-sm text-muted">{fmtDateTime(n.created_at)}</span>
                  </span>
                </>
              );
              return (
                <li key={n.id}>
                  {n.public_id ? (
                    <Link href={`/tickets/${n.public_id}`} className="flex gap-3 px-4 py-3.5 hover:bg-sunken/70 sm:px-5">
                      {body}
                    </Link>
                  ) : (
                    <div className="flex gap-3 px-4 py-3.5 sm:px-5">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
