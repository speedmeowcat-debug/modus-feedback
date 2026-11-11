import type { Metadata } from "next";
import { Card, SectionTitle, Tag } from "@/components/ui";
import { getDb } from "@/db";
import { requireActor } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/domain";
import { listUsers } from "@/lib/services/admin";
import { listFormOptions } from "@/lib/services/tickets";
import { UserCreateForm, UserEditForm } from "../admin-forms";

export const metadata: Metadata = { title: "Пользователи" };

export default async function UsersPage() {
  const actor = await requireActor();
  if (actor.role !== "admin") return null;
  const db = await getDb();
  const [users, { departments }] = await Promise.all([listUsers(db, actor), listFormOptions(db)]);
  return (
    <div className="space-y-5">
      <Card>
        <div className="px-4 pt-5 sm:px-5">
          <SectionTitle hint="Нажмите на строку, чтобы изменить роль, подразделение или отметить отсутствие">
            Пользователи ({users.length})
          </SectionTitle>
        </div>
        <ul className="divide-y divide-line border-t border-line">
          {users.map((u) => (
            <li key={u.id}>
              <details className="group">
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-sunken/70 sm:px-5 [&::-webkit-details-marker]:hidden">
                  <span className="min-w-0 flex-[2_1_220px]">
                    <span className="block truncate font-medium">{u.name}</span>
                    <span className="block truncate text-sm text-muted">
                      {u.login} · {u.department_name ?? "без подразделения"}
                    </span>
                  </span>
                  <span className="flex flex-[1_1_200px] flex-wrap items-center gap-1.5">
                    <Tag tone={u.role === "admin" ? "info" : "neutral"}>{ROLE_LABEL[u.role]}</Tag>
                    {u.is_absent && <Tag tone="warn">Отсутствует</Tag>}
                    {!u.is_active && <Tag tone="danger">Отключён</Tag>}
                    {u.is_demo && <Tag>Demo</Tag>}
                  </span>
                  <span className="num w-44 text-sm text-muted">
                    {u.role === "employee" ? "" : `в работе: ${u.open_assigned} · правил: ${u.rules}`}
                  </span>
                  <span className="text-sm text-accent-ink group-open:hidden">Изменить</span>
                  <span className="hidden text-sm text-muted group-open:inline">Свернуть</span>
                </summary>
                <UserEditForm u={u} departments={departments} isSelf={u.id === actor.id} />
              </details>
            </li>
          ))}
        </ul>
      </Card>
      <Card className="p-5 sm:p-6">
        <SectionTitle hint="Пароль хранится только в виде хэша">Новый пользователь</SectionTitle>
        <UserCreateForm departments={departments} />
      </Card>
    </div>
  );
}
